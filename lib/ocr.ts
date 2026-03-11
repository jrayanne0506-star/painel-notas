import fetch from "node-fetch"

// ✅ Polyfill para DOMMatrix — necessário no Node.js (Vercel não tem essa API do browser)
if (typeof globalThis.DOMMatrix === "undefined") {
  ;(globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true; isIdentity = true
    constructor(_init?: string | number[]) {}
    static fromMatrix() { return new DOMMatrix() }
    static fromFloat32Array() { return new DOMMatrix() }
    static fromFloat64Array() { return new DOMMatrix() }
    multiply() { return new DOMMatrix() }
    translate() { return new DOMMatrix() }
    scale() { return new DOMMatrix() }
    rotate() { return new DOMMatrix() }
    inverse() { return new DOMMatrix() }
    transformPoint(p?: any) { return p ?? { x: 0, y: 0, z: 0, w: 1 } }
    toFloat32Array() { return new Float32Array(16) }
    toFloat64Array() { return new Float64Array(16) }
    toJSON() { return {} }
  }
}

async function baixarArquivo(link: string): Promise<Buffer> {
  const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error("Link inválido")
  const fileId = idMatch[1]
  let res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`)
  let buffer = Buffer.from(await res.arrayBuffer())
  const primeiros = buffer.slice(0, 200).toString("utf-8")
  if (primeiros.includes("<!DOC") || primeiros.includes("<html")) {
    const html = buffer.toString("utf-8")
    const t = html.match(/confirm=([a-zA-Z0-9_-]+)/)?.[1] ?? "t"
    res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=${t}`)
    buffer = Buffer.from(await res.arrayBuffer())
  }
  return buffer
}

async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  let textoTotal = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const texto = content.items.map((item: any) => item.str).join(" ")
    textoTotal += texto + "\n"
  }
  return textoTotal
}

export async function lerNotaLocal(link: string, valorEsperado: string) {
  console.log("\n====== INICIANDO PROCESSAMENTO ======")
  console.log("Link:", link)
  console.log("Valor esperado:", valorEsperado)

  let buffer: Buffer
  try {
    buffer = await baixarArquivo(link)
    console.log("✓ PDF BAIXADO - Tamanho:", buffer.length, "bytes")
  } catch (err) {
    console.error("❌ ERRO AO BAIXAR PDF:", err)
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  let texto = ""
  try {
    texto = await extrairTextoPDF(buffer)
    console.log("✓ TEXTO EXTRAÍDO - Tamanho:", texto.length, "caracteres")
    console.log("✓ Primeiros 500 chars:", texto.slice(0, 500))
    console.log("✓ Últimos 500 chars:", texto.slice(-500))
  } catch (err) {
    console.error("❌ ERRO NA EXTRAÇÃO PDF:", err)
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  if (!texto || texto.trim().length === 0) {
    console.error("❌ TEXTO VAZIO após extração do PDF")
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  // DEBUG: Teste cada CNPJ individualmente
  const cnpjsParaTester = ["61.895.820/0001-83", "61895820000183", "61.895.820/0001 83"]
  console.log("\n--- TESTANDO CNPJ ---")
  cnpjsParaTester.forEach(cnpj => {
    const existe = texto.includes(cnpj)
    console.log(`  "${cnpj}" → ${existe ? "✓ ENCONTRADO" : "❌ NÃO ENCONTRADO"}`)
  })

  const temCnpj = cnpjsParaTester.some(v => texto.includes(v))
  if (!temCnpj) {
    console.log("❌ NENHUM CNPJ DA SCORPIONS ENCONTRADO")
    console.log("📋 Procurando por qualquer CNPJ no documento...")
    const cnpjsEncontrados = texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)
    if (cnpjsEncontrados) {
      console.log("   CNPJs encontrados:", cnpjsEncontrados)
    } else {
      console.log("   Nenhum CNPJ encontrado no formato esperado")
    }
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  console.log("✓ CNPJ da Scorpions encontrado - é uma nota válida")

  const linhas = texto.split("\n").map((l: string) => l.trim()).filter(Boolean)
  const textoUnico = linhas.join(" ")

  // ==================== BUSCA DO NÚMERO NFS-e ====================
  let numeroNfse = "não encontrado"

  const nfseMatch = textoUnico.match(/N[úu]mero\s+da\s+NFS[\s\-]*e[\s:]*(\d+)/i)
  if (nfseMatch) {
    numeroNfse = nfseMatch[1]
    console.log("✓ Número NFS-e encontrado via REGEX PRINCIPAL:", numeroNfse)
  } else {
    console.log("⚠️  Regex principal não encontrou - tentando busca em linhas...")

    for (let i = 0; i < linhas.length; i++) {
      if (/N[úu]mero\s+da\s+NFS[\s\-]*e/i.test(linhas[i])) {
        console.log(`  Linha ${i} contém "Número da NFS-e": "${linhas[i]}"`)

        const m = linhas[i].match(/(\d{2,6})/)
        if (m) {
          numeroNfse = m[1]
          console.log("✓ Número encontrado na MESMA LINHA:", numeroNfse)
          break
        }

        for (let j = i + 1; j < Math.min(i + 3, linhas.length); j++) {
          console.log(`  Checking linha ${j}: "${linhas[j]}"`)
          const m2 = linhas[j].match(/^(\d{2,6})/)
          if (m2) {
            numeroNfse = m2[1]
            console.log("✓ Número encontrado na LINHA SEGUINTE:", numeroNfse)
            break
          }
        }
        if (numeroNfse !== "não encontrado") break
      }
    }
  }

  if (numeroNfse === "não encontrado") {
    console.log("⚠️  Tentando FALLBACK - procurando número próximo a data...")
    const fallback = textoUnico.match(/\b(\d{2,6})\s+10\/03\/2026/)
    if (fallback) {
      numeroNfse = fallback[1]
      console.log("✓ Número encontrado via FALLBACK:", numeroNfse)
    } else {
      console.log("❌ FALLBACK também não encontrou número")
    }
  }

  // ==================== BUSCA DO VALOR ====================
  let valorDetectado = "não encontrado"

  const valorMatch = textoUnico.match(/Valor\s+L[íi]quido\s+da\s+NFS[\s\-]*e[\s:]*R\$\s*([\d.,]+)/i)
  if (valorMatch) {
    valorDetectado = valorMatch[1].trim()
    console.log("✓ Valor encontrado via REGEX:", valorDetectado)
  } else {
    console.log("⚠️  Regex de valor não funcionou - buscando em linhas...")

    for (let i = 0; i < linhas.length; i++) {
      if (/Valor\s+L[íi]quido\s+da\s+NFS[\s\-]*e/i.test(linhas[i])) {
        console.log(`  Linha ${i} contém "Valor Líquido": "${linhas[i]}"`)

        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const m = linhas[j].match(/R\$\s*([\d.,]+)/)
          if (m) {
            valorDetectado = m[1].trim()
            console.log("✓ Valor encontrado em linha subsequente:", valorDetectado)
            break
          }
        }
      }
    }
  }

  if (valorDetectado === "não encontrado") {
    console.log("⚠️  Tentando FALLBACK para valor - procurando último R$ no documento...")
    const all = [...textoUnico.matchAll(/R\$\s*([\d.,]+)/gi)]
    if (all.length > 0) {
      valorDetectado = all[all.length - 1][1].trim()
      console.log("✓ Valor encontrado (último R$):", valorDetectado)
    }
  }

  // ==================== VALIDAÇÃO ====================
  const norm = (v: string) => v.replace(/\./g, "").replace(",", ".").trim()
  const statusValidacao = norm(valorDetectado) === norm(valorEsperado) ? "VALIDADO" : "DIVERGENTE"

  console.log("\n========== RESULTADO FINAL ==========")
  console.log("Número NFS-e:", numeroNfse)
  console.log("Valor detectado:", valorDetectado)
  console.log("Valor esperado:", valorEsperado)
  console.log("Status:", statusValidacao)
  console.log("=====================================\n")

  return { numeroNfse, statusValidacao, valorDetectado }
}
