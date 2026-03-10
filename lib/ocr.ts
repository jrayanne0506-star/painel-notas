import fetch from "node-fetch"

async function baixarArquivo(link: string): Promise<{ buffer: Buffer; contentType: string }> {
  const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error("Link inválido")

  const fileId = idMatch[1]
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" })
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo")

  let buffer = Buffer.from(await res.arrayBuffer())
  let contentType = res.headers.get("content-type") ?? ""

  const primeiros = buffer.slice(0, 300).toString("utf-8")
  if (contentType.includes("text/html") || primeiros.includes("<!DOC") || primeiros.includes("<html")) {
    const html = buffer.toString("utf-8")
    const tokenMatch =
      html.match(/confirm=([a-zA-Z0-9_-]+)/) ||
      html.match(/name="confirm"\s+value="([^"]+)"/) ||
      html.match(/"confirm":"([^"]+)"/)
    const token = tokenMatch ? tokenMatch[1] : "t"
    const urlConfirm = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${token}`
    const res2 = await fetch(urlConfirm, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" })
    if (!res2.ok) throw new Error("Falha no download com confirmação")
    buffer = Buffer.from(await res2.arrayBuffer())
    contentType = res2.headers.get("content-type") ?? ""

    const primeiros2 = buffer.slice(0, 100).toString("utf-8")
    if (contentType.includes("text/html") || primeiros2.includes("<!DOC")) {
      const urlAlt = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
      const res3 = await fetch(urlAlt, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" })
      if (res3.ok) {
        buffer = Buffer.from(await res3.arrayBuffer())
        contentType = res3.headers.get("content-type") ?? ""
      }
    }
  }

  return { buffer, contentType }
}

function detectarTipo(buffer: Buffer, contentType: string): "pdf" | "image" | "unknown" {
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "pdf"
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return "image"
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image"
  if (contentType.includes("pdf")) return "pdf"
  if (contentType.includes("image") || contentType.includes("jpeg") || contentType.includes("png")) return "image"
  return "unknown"
}

async function lerComClaude(buffer: Buffer, tipo: "pdf" | "image", valorEsperado: string): Promise<{
  numeroNfse: string
  statusValidacao: string
  valorDetectado: string
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada")

  const base64 = buffer.toString("base64")
  const mediaType = tipo === "pdf" ? "application/pdf" : "image/jpeg"

  const prompt = `Você está analisando um documento fiscal brasileiro (NFS-e ou nota fiscal).

Extraia as seguintes informações:
1. Número da NFS-e (campo "Número da NFS-e" ou similar)
2. Valor Líquido da NFS-e (campo "Valor Líquido da NFS-e" ou "Valor Total")
3. Se o CNPJ "61.895.820/0001-83" (Scorpions Delivery) aparece no documento como TOMADOR DO SERVIÇO

Responda APENAS em JSON, sem nenhum texto adicional, neste formato exato:
{
  "numeroNfse": "número aqui ou null se não encontrado",
  "valorLiquido": "valor aqui sem R$ (ex: 103,20) ou null se não encontrado",
  "temCnpjScorpions": true ou false
}

Valor esperado para comparação: ${valorEsperado}`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: tipo === "pdf" ? "document" : "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json() as any

  if (data.error) {
    console.error("Claude API error:", JSON.stringify(data.error))
    throw new Error(`Claude API: ${data.error.message}`)
  }

  const texto = data.content?.[0]?.text ?? ""
  console.log(`Claude resposta: ${texto}`)

  let parsed: any = {}
  try {
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error("Erro ao parsear resposta Claude:", texto)
    throw new Error("Resposta inválida do Claude")
  }

  const { numeroNfse, valorLiquido, temCnpjScorpions } = parsed

  if (!temCnpjScorpions) {
    console.log("CNPJ Scorpions não encontrado pelo Claude")
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const numFinal = numeroNfse ?? "não encontrado"
  const valorFinal = valorLiquido ?? "não encontrado"

  const normalizar = (v: string) => String(v).replace(/\./g, "").replace(",", ".").trim()
  const statusValidacao =
    valorFinal !== "não encontrado" && valorFinal !== null &&
    normalizar(String(valorFinal)) === normalizar(valorEsperado)
      ? "VALIDADO"
      : "DIVERGENTE"

  console.log(`NFS-e=${numFinal} valor=${valorFinal} esperado=${valorEsperado} status=${statusValidacao}`)

  return {
    numeroNfse: String(numFinal),
    statusValidacao,
    valorDetectado: String(valorFinal),
  }
}

export async function lerNotaLocal(link: string, valorEsperado: string) {
  const { buffer, contentType } = await baixarArquivo(link)
  const tipo = detectarTipo(buffer, contentType)

  console.log(`tipo=${tipo} contentType=${contentType} tamanho=${buffer.length}`)

  if (tipo === "unknown") throw new Error("Formato não suportado: " + contentType)

  return await lerComClaude(buffer, tipo, valorEsperado)
}
