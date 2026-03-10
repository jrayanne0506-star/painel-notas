import { NextRequest, NextResponse } from "next/server";
import { lerNotaLocal } from "@/lib/ocr";
import { salvarResultadoNoSheets } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const notas = await req.json();
    if (!Array.isArray(notas)) throw new Error("Esperado um array de notas");

    const resultados = [];

    for (const nota of notas) {
      if (!nota.link) {
        resultados.push({ id: nota.id, erro: "Sem link" });
        continue;
      }

      try {
        const resultado = await lerNotaLocal(nota.link, nota.valorEsperado);
        await salvarResultadoNoSheets(Number(nota.id), resultado.numeroNfse, resultado.statusValidacao);
        resultados.push({ id: nota.id, ...resultado });
      } catch (erroNota: any) {
        resultados.push({ id: nota.id, erro: erroNota.message });
      }
    }

    return NextResponse.json(resultados);
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 });
  }
}