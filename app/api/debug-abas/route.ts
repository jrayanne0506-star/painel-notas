import { NextResponse } from "next/server"
import { sheets, SHEET_ENTREGADORES_ID, SHEET_NOTAS_ID } from "@/lib/googleSheets"

export async function GET() {
  const ent = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ENTREGADORES_ID })
  const notas = await sheets.spreadsheets.get({ spreadsheetId: SHEET_NOTAS_ID })

  return NextResponse.json({
    entregadores: ent.data.sheets?.map(s => s.properties?.title),
    notas: notas.data.sheets?.map(s => s.properties?.title),
  })
}
