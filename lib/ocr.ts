import fetch from "node-fetch"

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
  const buffer = await baixarArquivo(link)

  let texto = ""
  try {
    texto = await extrairTextoPDF(buffer)
    console.log("TEXTO EXTRAÍDO:", texto.slice(0, 300))
  } catch (err) {
    console.error("Erro extração PDF:", err)
  }

  if (!texto || texto.trim().length === 0) {
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const temCnpj = ["61.895.820/0001-83", "61895820000183", "61.895.820/0001 83"].some(v => texto.includes(v))
  if (!temCnpj) {
    console.log("CNPJ não encontrado")
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const linhas = texto.split("\n").map((l: string) => l.trim()).filter(Boolean)
  const textoUnico = linhas.join(" ")

  let numeroNfse = "não encontrado"
  const nfseMatch = textoUnico.match(/N[úu]mero\s+da\s+NFS-?e\s+(\d+)/i)
  if (nfseMatch) {
    numeroNfse = nfseMatch[1]
  } else {
    for (let i = 0; i < linhas.length; i++) {
      if (/N[úu]mero\s+da\s+NFS-?e/i.test(linhas[i])) {
        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const m = linhas[j].match(/^(\d+)$/)
          if (m) { numeroNfse = m[1]; break }
        }
      }
    }
  }

  let valorDetectado = "não encontrado"
  const valorMatch = textoUnico.match(/Valor\s+L[íi]quido\s+da\s+NFS-?e\s+R\$\s*([\d.,]+)/i)
  if (valorMatch) {
    valorDetectado = valorMatch[1].trim()
  } else {
    for (let i = 0; i < linhas.length; i++) {
      if (/Valor\s+L[íi]quido\s+da\s+NFS-?e/i.test(linhas[i])) {
        for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
          const m = linhas[j].match(/R\$\s*([\d.,]+)/)
          if (m) { valorDetectado = m[1].trim(); break }
        }
      }
    }
  }

  if (valorDetectado === "não encontrado") {
    const all = [...textoUnico.matchAll(/R\$\s*([\d.,]+)/gi)]
    if (all.length > 0) valorDetectado = all[all.length - 1][1].trim()
  }

  const norm = (v: string) => v.replace(/\./g, "").replace(",", ".").trim()
  const statusValidacao = norm(valorDetectado) === norm(valorEsperado) ? "VALIDADO" : "DIVERGENTE"

  console.log("NFS-e:", numeroNfse, "| Status:", statusValidacao, "| Detectado:", valorDetectado)
  return { numeroNfse, statusValidacao, valorDetectado }
}