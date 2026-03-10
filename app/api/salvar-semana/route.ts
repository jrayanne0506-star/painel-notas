import { NextResponse } from "next/server"
import { sheets, SHEET_ENTREGADORES_ID } from "@/lib/googleSheets"
import { buscarNotasCruzadas } from "@/lib/sheets"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const dados = await buscarNotasCruzadas()

    if (!dados || dados.length === 0) {
      return NextResponse.json({ erro: "Nenhum dado para salvar." }, { status: 422 })
    }

    const nomeAba = body.nomeAba || new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")

    // Verifica se a aba já existe na planilha de entregadores
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ENTREGADORES_ID })
    const abas = meta.data.sheets?.map((s) => s.properties?.title) ?? []

    if (!abas.includes(nomeAba)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ENTREGADORES_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: nomeAba } } }],
        },
      })
    }

    const agora = new Date().toLocaleString("pt-BR")
    const valores = [
      ["Nome", "Semana", "Valor", "Telefone", "Status", "Link Nota", "NFS-e", "Validação", "Salvo em"],
      ...dados.map((item: any) => [
        item.nome,
        item.semana,
        item.valor,
        item.telefone || "",
        item.status,
        item.link || "",
        item.numeroNfse || "",
        item.statusValidacao || "",
        agora,
      ]),
    ]

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ENTREGADORES_ID,
      range: `${nomeAba}!A:I`,
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ENTREGADORES_ID,
      range: `${nomeAba}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: valores },
    })

    return NextResponse.json({
      sucesso: true,
      aba: nomeAba,
      total: dados.length,
      mensagem: `${dados.length} registros salvos em "${nomeAba}"!`,
    })
  } catch (err: any) {
    console.error("❌ Erro ao salvar semana:", err.message)
    return NextResponse.json({ erro: err.message ?? "Erro desconhecido" }, { status: 500 })
  }
}
