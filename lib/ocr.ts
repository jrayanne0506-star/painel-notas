import fetch from "node-fetch";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const CNPJ_SCORPIONS = "61.895.820/0001-83";

function detectarTipo(buffer: Buffer, contentType: string): "pdf" | "image" | "unknown" {
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "pdf";
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return "image";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("image") || contentType.includes("jpeg") || contentType.includes("png")) return "image";
  return "unknown";
}

export async function lerNotaLocal(link: string, valorEsperado: string) {
  const idMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) throw new Error("Link inválido");

  const fileId = idMatch[1];
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo");

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "";
  const tipo = detectarTipo(buffer, contentType);
  const tmpBase = path.join(os.tmpdir(), `nota_${Date.now()}`);
  let texto = "";

  if (tipo === "image") {
    const tmpImg = tmpBase + ".jpg";
    fs.writeFileSync(tmpImg, buffer);
    try {
      execSync(`/opt/homebrew/bin/tesseract "${tmpImg}" "${tmpBase}" -l por`);
      texto = fs.readFileSync(tmpBase + ".txt", "utf-8");
    } catch {
      throw new Error("Erro ao processar imagem com tesseract");
    } finally {
      try { fs.unlinkSync(tmpImg); } catch {}
      try { fs.unlinkSync(tmpBase + ".txt"); } catch {}
    }
  } else if (tipo === "pdf") {
    const tmpPdf = tmpBase + ".pdf";
    const tmpTxt = tmpBase + ".txt";
    fs.writeFileSync(tmpPdf, buffer);
    try {
      execSync(`/opt/homebrew/bin/pdftotext "${tmpPdf}" "${tmpTxt}"`);
      texto = fs.readFileSync(tmpTxt, "utf-8");
    } catch {
      throw new Error("Erro ao processar PDF");
    } finally {
      try { fs.unlinkSync(tmpPdf); } catch {}
      try { fs.unlinkSync(tmpTxt); } catch {}
    }
  } else {
    throw new Error("Formato não suportado: " + contentType);
  }

  // Salva texto extraído para debug
  fs.writeFileSync("/tmp/debug_nota.txt", texto, "utf-8");

  if (!texto.includes(CNPJ_SCORPIONS)) {
    return { numeroNfse: "—", statusValidacao: "NÃO É NOTA", valorDetectado: "—" };
  }

  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let numeroNfse = "não encontrado";
  let valorDetectado = "não encontrado";

  for (let i = 0; i < linhas.length; i++) {
    if (/N[úu]mero\s+da\s+NFS-?e/i.test(linhas[i])) {
      for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
        const match = linhas[j].match(/^(\d+)$/);
        if (match) { numeroNfse = match[1]; break; }
      }
    }
    if (/Valor\s+L[íi]quido\s+da\s+NFS-?e/i.test(linhas[i])) {
      for (let j = i + 1; j < Math.min(i + 5, linhas.length); j++) {
        const match = linhas[j].match(/R\$\s*([\d.,]+)/);
        if (match) { valorDetectado = match[1].trim(); break; }
      }
    }
  }

  const normalizar = (v: string) => v.replace(/\./g, "").replace(",", ".").trim();
  const statusValidacao =
    valorDetectado !== "não encontrado" &&
    normalizar(valorDetectado) === normalizar(valorEsperado)
      ? "VALIDADO"
      : "DIVERGENTE";

  return { numeroNfse, statusValidacao, valorDetectado };
}
