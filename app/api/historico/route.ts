import { NextResponse } from "next/server"
import { sheets, SHEET_ENTREGADORES_ID } from "@/lib/googleSheets"

// Abas que não são históricas (ignorar no seletor)
const ABAS_SISTEMA = ["Base_Entregadores", "Keeta", "Sheet1", "Página1", "Plan1"]

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const aba = searchParams.get("aba")

    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ENTREGADORES_ID })
    const todasAbas = meta.data.sheets?.map((s) => s.properties?.title ?? "") ?? []

    // Lista só as abas de histórico (que têm " a " no nome, formato período)
    const semanasAbas = todasAbas
      .filter((t) => t.includes(" a ") && !ABAS_SISTEMA.includes(t))
      .reverse()

    // Se pediu uma aba específica, retorna os dados dela
    if (aba && todasAbas.includes(aba)) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ENTREGADORES_ID,
        range: `${aba}!A1:I`,
      })
      const rows = res.data.values ?? []
      const dados = rows.slice(1).map((row) => ({
        nome:            row[0] ?? "",
        semana:          row[1] ?? "",
        valor:           row[2] ?? "",
        telefone:        row[3] ?? "",
        status:          row[4] ?? "",
        link:            row[5] ?? "",
        numeroNfse:      row[6] ?? "",
        statusValidacao: row[7] ?? "",
        salvoEm:         row[8] ?? "",
      }))
      return NextResponse.json({ aba, dados })
    }

    return NextResponse.json({ semanas: semanasAbas })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
