import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

const SPREADSHEET_ID = process.env.PERFORMANCE_SHEET_ID!

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.PERFORMANCE_CLIENT_EMAIL!,
      private_key: process.env.PERFORMANCE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

// GET /api/performance-sheets?acao=listar
// GET /api/performance-sheets?acao=buscar&semana=09/03 - 15/03
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const acao = searchParams.get("acao")
    const semana = searchParams.get("semana")

    const auth = getAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // Lista todas as abas disponíveis
    if (acao === "listar") {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
      const abas = (meta.data.sheets ?? [])
        .map(s => s.properties?.title ?? "")
        .filter(t => t.startsWith("perf_"))
        .map(t => t.replace("perf_", ""))
      return NextResponse.json({ semanas: abas })
    }

    // Busca dados de uma semana específica
    if (acao === "buscar" && semana) {
      const abaName = `perf_${semana}`
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${abaName}'!A1:Z5000`,
      })
      const rows = res.data.values ?? []
      if (rows.length < 2) return NextResponse.json({ dados: [] })

      const headers = rows[0] as string[]
      const dados = rows.slice(1).map(row => {
        const obj: Record<string, any> = {}
        headers.forEach((h, i) => { obj[h] = row[i] ?? "" })
        return obj
      })
      return NextResponse.json({ dados })
    }

    return NextResponse.json({ erro: "Ação inválida" }, { status: 400 })
  } catch (e: any) {
    console.error("GET performance-sheets error:", e.message)
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}

// POST /api/performance-sheets
// body: { acao: "salvar", semana: "09/03 - 15/03", dados: [...] }
// body: { acao: "renomear", semana: "09/03 - 15/03", novoNome: "..." }
// body: { acao: "excluir", semana: "09/03 - 15/03" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { acao, semana } = body

    const auth = getAuth()
    const sheets = google.sheets({ version: "v4", auth })

    // ── SALVAR ──────────────────────────────────────────────────────────────
    if (acao === "salvar") {
      const { dados } = body as { dados: Record<string, any>[] }
      if (!dados?.length) return NextResponse.json({ erro: "Sem dados" }, { status: 400 })

      const abaName = `perf_${semana}`

      // Verifica se a aba já existe
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
      const abaExiste = meta.data.sheets?.some(s => s.properties?.title === abaName)

      if (!abaExiste) {
        // Cria a aba
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{ addSheet: { properties: { title: abaName } } }],
          },
        })
      } else {
        // Limpa a aba existente
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${abaName}'!A1:Z5000`,
        })
      }

      // Monta os dados
      const headers = [
        "id", "data", "nome", "veiculo", "compareceu", "tempoOnline",
        "aceitas", "entregues", "canceladas",
        "recusadasTotal", "recusadasManual", "recusadasAuto",
        "taxaPontualidade", "tempoMedioEntrega", "acima55min",
        "emAtraso", "muitoAtrasado", "turnosOn"
      ]
      const rows = [
        headers,
        ...dados.map(d => headers.map(h => {
          const v = (d as any)[h]
          return Array.isArray(v) ? v.join("|") : (v ?? "")
        }))
      ]

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${abaName}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      })

      return NextResponse.json({ ok: true, semana, linhas: dados.length })
    }

    // ── RENOMEAR ─────────────────────────────────────────────────────────────
    if (acao === "renomear") {
      const { novoNome } = body
      const abaAtual = `perf_${semana}`
      const abaNova = `perf_${novoNome}`

      const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
      const aba = meta.data.sheets?.find(s => s.properties?.title === abaAtual)
      if (!aba) return NextResponse.json({ erro: "Semana não encontrada" }, { status: 404 })

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: { sheetId: aba.properties!.sheetId, title: abaNova },
              fields: "title",
            },
          }],
        },
      })
      return NextResponse.json({ ok: true })
    }

    // ── EXCLUIR ───────────────────────────────────────────────────────────────
    if (acao === "excluir") {
      const abaName = `perf_${semana}`
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
      const aba = meta.data.sheets?.find(s => s.properties?.title === abaName)
      if (!aba) return NextResponse.json({ erro: "Semana não encontrada" }, { status: 404 })

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: aba.properties!.sheetId } }],
        },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ erro: "Ação inválida" }, { status: 400 })
  } catch (e: any) {
    console.error("POST performance-sheets error:", e.message)
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}