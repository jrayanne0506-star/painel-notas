import { NextRequest, NextResponse } from "next/server"
import { lerNotaLocal } from "@/lib/ocr"
import { salvarResultadoNoSheets, invalidarCache } from "@/lib/sheets"

export async function POST(req: NextRequest) {
  try {
    const notas = await req.json()
    if (!Array.isArray(notas)) throw new Error("Esperado um array de notas")

    const resultados = []

    for (const nota of notas) {
      if (!nota.link) {
        resultados.push({ id: nota.id, erro: "Sem link" })
        continue
      }

      try {
        const resultado = await lerNotaLocal(nota.link, nota.valorEsperado)

        if (resultado.numeroNfse && resultado.numeroNfse !== "não encontrado" && resultado.numeroNfse !== "—") {
          // Usa nome para buscar a linha correta na planilha de Respostas
          // (mais confiável que id, que pode ser da planilha errada)
          const chave = nota.nome ?? nota.id
          await salvarResultadoNoSheets(chave, resultado.numeroNfse, resultado.statusValidacao)
        }

        resultados.push({ id: nota.id, nome: nota.nome, ...resultado })
      } catch (erroNota: any) {
        console.error(`Erro nota ${nota.id} (${nota.nome}):`, erroNota.message)
        resultados.push({ id: nota.id, erro: erroNota.message })
      }
    }

    invalidarCache()

    return NextResponse.json(resultados)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
