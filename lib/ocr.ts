import fetch from "node-fetch";
import pdf from "pdf-parse";

async function baixarArquivo(link: string): Promise<{ buffer: Buffer; contentType: string }> {
  const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error("Link inválido")

  const fileId = idMatch[1]
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo")

  let buffer = Buffer.from(await res.arrayBuffer())
  let contentType = res.headers.get("content-type") ?? ""

  // Se o Drive retornou HTML (página de confirmação de vírus), tenta com confirm token
  const primeiros = buffer.slice(0, 200).toString("utf-8")
  if (contentType.includes("text/html") || primeiros.includes("<!DOC") || primeiros.includes("<html")) {
    const html = buffer.toString("utf-8")
    const tokenMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/) ||
                       html.match(/name="confirm"\s+value="([^"]+)"/)
    const token = tokenMatch ? tokenMatch[1] : "t"
    const urlConfirm = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${token}`
    const res2 = await fetch(urlConfirm)
    if (!res2.ok) throw new Error("Falha no download com confirmação")
    buffer = Buffer.from(await res2.arrayBuffer())
    contentType = res2.headers.get("content-type") ?? ""
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

async function extrairTexto(buffer: Buffer, tipo: "pdf" | "image"): Promise<string> {
  if (tipo === "pdf") {
    try {
      // O pdf-parse lê o buffer e extrai todo o texto digital do PDF
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error("Erro no pdf-parse:", error);
      throw new Error("Falha ao ler o texto do PDF.");
    }
  } else {
    // Como o pdf-parse só lê PDF, vamos retornar um erro amigável se for imagem por enquanto
    throw new Error("O sistema atual está configurado apenas para ler arquivos PDF. Imagens não suportadas no momento.");
  }
}

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
  const accessToken = tokenData.access_token
  if (!accessToken) throw new Error("Falha ao obter token da Vision API")

  const base64Content = buffer.toString("base64")

  if (tipo === "pdf") {
    const visionRes = await fetch("https://vision.googleapis.com/v1/files:annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        requests: [{
          inputConfig: { content: base64Content, mimeType: "application/pdf" },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: [1, 2, 3],
        }]
      }),
    })
    const visionData = await visionRes.json() as any
    const responses = visionData.responses?.[0]?.responses ?? []
    return responses.map((r: any) => r.fullTextAnnotation?.text ?? "").join("\n")
  } else {
    const visionRes = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        requests: [{ image: { content: base64Content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }]
      }),
    })
    const visionData = await visionRes.json() as any
    return visionData.responses?.[0]?.fullTextAnnotation?.text ?? ""
  }
}

export async function lerNotaLocal(link: string, valorEsperado: string) {
  const { buffer, contentType } = await baixarArquivo(link)
  const tipo = detectarTipo(buffer, contentType)

  if (tipo === "unknown") {
    throw new Error("Formato não suportado: " + contentType)
  }

  const texto = await extrairTexto(buffer, tipo)

  const textoNormalizado = texto.replace(/\s+/g, " ")
  const cnpjVariantes = [
    "61.895.820/0001-83",
    "61895820000183",
    "61.895.820/0001 83",
    "61895820/0001-83",
  ]
  const temCnpj = cnpjVariantes.some(v => textoNormalizado.includes(v))

  if (!temCnpj) {
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0)
  const textoUnico = linhas.join(" ")

  let numeroNfse = "não encontrado"
  let valorDetectado = "não encontrado"

  const nfseMatch = textoUnico.match(/N[úu]mero\s+da\s+NFS-?e\s+(\d+)/i)
  if (nfseMatch) {
    numeroNfse = nfseMatch[1]
  } else {
    for (let i = 0; i < linhas.length; i++) {
      if (/N[úu]mero\s+da\s+NFS-?e/i.test(linhas[i])) {
        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const match = linhas[j].match(/^(\d+)$/)
          if (match) { numeroNfse = match[1]; break }
        }
      }
    }
  }

  const valorMatch = textoUnico.match(/Valor\s+L[íi]quido\s+da\s+NFS-?e\s+R\$\s*([\d.,]+)/i)
  if (valorMatch) {
    valorDetectado = valorMatch[1].trim()
  } else {
    for (let i = 0; i < linhas.length; i++) {
      if (/Valor\s+L[íi]quido\s+da\s+NFS-?e/i.test(linhas[i])) {
        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const match = linhas[j].match(/R\$\s*([\d.,]+)/)
          if (match) { valorDetectado = match[1].trim(); break }
        }
      }
    }
  }

  if (valorDetectado === "não encontrado") {
    const matches = [...textoUnico.matchAll(/R\$\s*([\d.,]+)/gi)]
    if (matches.length > 0) {
      valorDetectado = matches[matches.length - 1][1].trim()
    }
  }

  const normalizar = (v: string) => v.replace(/\./g, "").replace(",", ".").trim()
  const statusValidacao =
    valorDetectado !== "não encontrado" &&
    normalizar(valorDetectado) === normalizar(valorEsperado)
      ? "VALIDADO"
      : "DIVERGENTE"

  return { numeroNfse, statusValidacao, valorDetectado }
}
