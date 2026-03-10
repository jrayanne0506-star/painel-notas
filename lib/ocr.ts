import fetch from "node-fetch"
import pdf from "pdf-parse"

async function baixarArquivo(link: string): Promise<Buffer> {
  const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error("Link inválido")
  const fileId = idMatch[1]
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo")
  let buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get("content-type") ?? ""
  const primeiros = buffer.slice(0, 200).toString("utf-8")
  if (contentType.includes("text/html") || primeiros.includes("<!DOC") || primeiros.includes("<html")) {
    const html = buffer.toString("utf-8")
    const tokenMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/) || html.match(/name="confirm"\s+value="([^"]+)"/)
    const token = tokenMatch ? tokenMatch[1] : "t"
    const urlConfirm = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${token}`
    const res2 = await fetch(urlConfirm)
    if (!res2.ok) throw new Error("Falha no download com confirmação")
    buffer = Buffer.from(await res2.arrayBuffer())
  }
  return buffer
}

export async function lerNotaLocal(link: string, valorEsperado: string) {
  const buffer = await baixarArquivo(link)
  console.log("✅ Arquivo baixado:", buffer.length, "bytes")

  let texto = ""
  try {
    const data = await pdf(buffer)
    texto = data.text || ""
    console.log("✅ pdf-parse extraiu", texto.length, "caracteres")
  } catch (err) {
    console.error("❌ Erro pdf-parse:", err)
  }

  if (!texto || texto.trim().length === 0) {
    console.log("❌ Nenhum texto extraído")
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }

  const cnpjVariantes = ["61.895.820/0001-83","61895820000183","61.895.820/0001 83","61895820/0001-83"]
  const temCnpj = cnpjVariantes.some(v => texto.includes(v))
  if (!temCnpj) {
    console.log("❌ CNPJ não encontrado")
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" }
  }
  console.log("✅ CNPJ encontrado")

  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0)
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
    const matches = [...textoUnico.matchAll(/R\$\s*([\d.,]+)/gi)]
    if (matches.length > 0) valorDetectado = matches[matches.length - 1][1].trim()
  }

  const normalizar = (v: string) => v.replace(/\./g, "").replace(",", ".").trim()
  const statusValidacao = valorDetectado !== "não encontrado" && normalizar(valorDetectado) === normalizar(valorEsperado) ? "VALIDADO" : "DIVERGENTE"

  console.log("NFS-e:", numeroNfse, "| Status:", statusValidacao, "| Detectado:", valorDetectado, "| Esperado:", valorEsperado)
  return { numeroNfse, statusValidacao, valorDetectado }
}
