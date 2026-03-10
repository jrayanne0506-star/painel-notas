import fetch from "node-fetch"

const CNPJ_SCORPIONS = "61.895.820/0001-83"

async function baixarArquivo(link: string): Promise<{ buffer: Buffer; contentType: string }> {
  const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error("Link inválido")

  const fileId = idMatch[1]
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo")

  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get("content-type") ?? ""
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

async function extrairTextoViaVision(buffer: Buffer, tipo: "pdf" | "image"): Promise<string> {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n")
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL ?? ""

  // Gera JWT para autenticar na Vision API
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

  // Troca JWT por access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json() as any
  const accessToken = tokenData.access_token
  if (!accessToken) throw new Error("Falha ao obter token da Vision API")

  const base64Content = buffer.toString("base64")

  let requestBody: any

  if (tipo === "pdf") {
    // Para PDF usa document text detection
    requestBody = {
      requests: [{
        inputConfig: {
          content: base64Content,
          mimeType: "application/pdf",
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        pages: [1, 2, 3],
      }]
    }

    const visionRes = await fetch(
      "https://vision.googleapis.com/v1/files:annotate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      }
    )
    const visionData = await visionRes.json() as any
    const responses = visionData.responses?.[0]?.responses ?? []
    return responses.map((r: any) => r.fullTextAnnotation?.text ?? "").join("\n")

  } else {
    // Para imagem usa image text detection
    requestBody = {
      requests: [{
        image: { content: base64Content },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      }]
    }

    const visionRes = await fetch(
      "https://vision.googleapis.com/v1/images:annotate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      }
    )
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

  const texto = await extrairTextoViaVision(buffer, tipo)

  if (!texto.includes(CNPJ_SCORPIONS)) {
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0)
  let numeroNfse = "não encontrado"
  let valorDetectado = "não encontrado"

  for (let i = 0; i < linhas.length; i++) {
    if (/N[úu]mero\s+da\s+NFS-?e/i.test(linhas[i])) {
      for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
        const match = linhas[j].match(/^(\d+)$/)
        if (match) { numeroNfse = match[1]; break }
      }
    }
    if (/Valor\s+L[íi]quido\s+da\s+NFS-?e/i.test(linhas[i])) {
      for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
        const match = linhas[j].match(/R\$\s*([\d.,]+)/)
        if (match) { valorDetectado = match[1].trim(); break }
      }
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
