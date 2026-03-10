import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { link } = await req.json()

    const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (!idMatch) return NextResponse.json({ erro: "Link inválido" }, { status: 400 })

    const fileId = idMatch[1]
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ erro: "Não foi possível baixar o arquivo" }, { status: 500 })

    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get("content-type") ?? ""

    // Detecta tipo
    let tipo: "pdf" | "image" | "unknown" = "unknown"
    if (buffer[0] === 0x25 && buffer[1] === 0x50) tipo = "pdf"
    else if (buffer[0] === 0xFF && buffer[1] === 0xD8) tipo = "image"
    else if (buffer[0] === 0x89 && buffer[1] === 0x50) tipo = "image"
    else if (contentType.includes("pdf")) tipo = "pdf"
    else if (contentType.includes("image")) tipo = "image"

    // Auth Vision API
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n")
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL ?? ""
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
    const accessToken = tokenData.access_token
    if (!accessToken) return NextResponse.json({ erro: "Falha no token", tokenData }, { status: 500 })

    const base64Content = buffer.toString("base64")
    let texto = ""
    let rawResponse: any = {}

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
      rawResponse = await visionRes.json() as any
      const responses = rawResponse.responses?.[0]?.responses ?? []
      texto = responses.map((r: any) => r.fullTextAnnotation?.text ?? "").join("\n")
    } else {
      const visionRes = await fetch("https://vision.googleapis.com/v1/images:annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          requests: [{ image: { content: base64Content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }]
        }),
      })
      rawResponse = await visionRes.json() as any
      texto = rawResponse.responses?.[0]?.fullTextAnnotation?.text ?? ""
    }

    return NextResponse.json({
      tipo,
      contentType,
      tamanhoBuffer: buffer.length,
      textoExtraido: texto,
      primeiros500chars: texto.substring(0, 500),
      temCnpj61895820: texto.includes("61.895.820") || texto.includes("61895820"),
      temScorpions: texto.toLowerCase().includes("scorpions"),
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}
