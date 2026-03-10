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

    // Tenta URL alternativa se ainda for HTML
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

async function obterTokenVision(): Promise<string> {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n")
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL ?? ""
  if (!privateKey || !clientEmail) throw new Error("Credenciais Google não configuradas")

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url")

  const { createSign } = await import("crypto")
  const sign = createSign("RSA-SHA256")
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(privateKey, "base64url")
  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json() as any
  if (!tokenData.access_token) throw new Error(`Token falhou: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

async function ocr_imagem(base64Content: string, accessToken: string): Promise<string> {
  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      requests: [{ image: { content: base64Content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }],
    }),
  })
  const data = await res.json() as any
  return data.responses?.[0]?.fullTextAnnotation?.text ?? ""
}

async function ocr_pdf(base64Content: string, accessToken: string): Promise<string> {
  const res = await fetch("https://vision.googleapis.com/v1/files:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      requests: [{
        inputConfig: { content: base64Content, mimeType: "application/pdf" },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        pages: [1, 2, 3],
      }],
    }),
  })
  const data = await res.json() as any
  const responses = data.responses?.[0]?.responses ?? []
  return responses.map((r: any) => r.fullTextAnnotation?.text ?? "").join("\n")
}

async function extrairTextoViaVision(buffer: Buffer, tipo: "pdf" | "image"): Promise<string> {
  const accessToken = await obterTokenVision()
  const base64Content = buffer.toString("base64")

  if (tipo === "pdf") {
    const textoPdf = await ocr_pdf(base64Content, accessToken)
    if (textoPdf.trim().length > 20) return textoPdf
    // PDF escaneado — fallback para modo imagem
    console.log("PDF vazio via files:annotate, tentando como imagem...")
    return await ocr_imagem(base64Content, accessToken)
  }

  return await ocr_imagem(base64Content, accessToken)
}

export async function lerNotaLocal(link: string, valorEsperado: string) {
  const { buffer, contentType } = await baixarArquivo(link)
  const tipo = detectarTipo(buffer, contentType)

  console.log(`tipo=${tipo} contentType=${contentType} tamanho=${buffer.length}`)

  if (tipo === "unknown") throw new Error("Formato não suportado: " + contentType)

  const texto = await extrairTextoViaVision(buffer, tipo)
  console.log(`Texto extraído (200 chars): ${texto.slice(0, 200)}`)

  const textoNormalizado = texto.replace(/\s+/g, " ")
  const cnpjVariantes = [
    "61.895.820/0001-83", "61895820000183",
    "61.895.820/0001 83", "61895820/0001-83",
    "61.895.820", "61895820",
  ]
  const temCnpj = cnpjVariantes.some(v => textoNormalizado.includes(v))

  if (!temCnpj) {
    console.log("CNPJ Scorpions não encontrado")
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0)
  const textoUnico = linhas.join(" ")

  // Número NFS-e
  let numeroNfse = "não encontrado"
  const padroesNum = [
    /N[úu]mero\s+(?:da\s+)?NFS-?e[:\s]+(\d+)/i,
    /NFS-?e\s+n[°º\.]\s*(\d+)/i,
    /Nota\s+Fiscal.*?n[°º\.]\s*(\d+)/i,
  ]
  for (const p of padroesNum) {
    const m = textoUnico.match(p)
    if (m) { numeroNfse = m[1]; break }
  }
  if (numeroNfse === "não encontrado") {
    for (let i = 0; i < linhas.length; i++) {
      if (/N[úu]mero\s+da\s+NFS-?e/i.test(linhas[i])) {
        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const m = linhas[j].match(/^(\d+)$/)
          if (m) { numeroNfse = m[1]; break }
        }
      }
    }
  }

  // Valor detectado
  let valorDetectado = "não encontrado"
  const padroesVal = [
    /Valor\s+L[íi]quido\s+da\s+NFS-?e\s*[:\s]\s*R?\$?\s*([\d.,]+)/i,
    /Valor\s+L[íi]quido\s*[:\s]\s*R?\$?\s*([\d.,]+)/i,
    /Valor\s+Total\s*[:\s]\s*R?\$?\s*([\d.,]+)/i,
    /Valor\s+do\s+Servi[çc]o\s*[:\s]\s*R?\$?\s*([\d.,]+)/i,
  ]
  for (const p of padroesVal) {
    const m = textoUnico.match(p)
    if (m) { valorDetectado = m[1].trim(); break }
  }
  if (valorDetectado === "não encontrado") {
    for (let i = 0; i < linhas.length; i++) {
      if (/Valor\s+L[íi]quido/i.test(linhas[i])) {
        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const m = linhas[j].match(/R?\$?\s*([\d.,]+)/)
          if (m) { valorDetectado = m[1].trim(); break }
        }
      }
    }
  }
  if (valorDetectado === "não encontrado") {
    const todos = [...textoUnico.matchAll(/R\$\s*([\d.,]+)/gi)]
    if (todos.length > 0) valorDetectado = todos[todos.length - 1][1].trim()
  }

  const normalizar = (v: string) => v.replace(/\./g, "").replace(",", ".").trim()
  const statusValidacao =
    valorDetectado !== "não encontrado" &&
    normalizar(valorDetectado) === normalizar(valorEsperado)
      ? "VALIDADO"
      : "DIVERGENTE"

  console.log(`NFS-e=${numeroNfse} valor=${valorDetectado} status=${statusValidacao}`)
  return { numeroNfse, statusValidacao, valorDetectado }
}
