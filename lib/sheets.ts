import { sheets, SHEET_ENTREGADORES_ID, SHEET_NOTAS_ID } from "./googleSheets"

// Cache em memória (funciona na Vercel, reseta a cada deploy)
let memoriaCache: { timestamp: number; dados: any[] } | null = null
const CACHE_TTL = 5 * 60 * 1000

export function lerCache() {
  try {
    if (!memoriaCache) return null
    if (Date.now() - memoriaCache.timestamp > CACHE_TTL) return null
    return memoriaCache.dados
  } catch {
    return null
  }
}

export function salvarCache(dados: any[]) {
  memoriaCache = { timestamp: Date.now(), dados }
}

export function invalidarCache() {
  memoriaCache = null
}

export async function buscarNotasCruzadas() {
  // Planilha 1 - aba CONSULTA DE VALORES SEMANAL (nome exato)
  const resEnt = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ENTREGADORES_ID,
    range: "'CONSULTA DE VALORES SEMANAL'!A1:C",
  })
  const rowsEnt = resEnt.data.values ?? []

  // Planilha 2 - aba Respostas (nome exato)
  const resNotas = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_NOTAS_ID,
    range: "Respostas!A1:H",
  })
  const rowsNotas = resNotas.data.values ?? []

  // Aba Base_Entregadores - telefones de todos os riders (col C=Nome, D=Telefone)
  const mapaKeetaTelefone: Record<string, string> = {}
  try {
    const resBase = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ENTREGADORES_ID,
      range: "Base_Entregadores!C2:D",
    })
    const rowsBase = resBase.data.values ?? []
    rowsBase.forEach((row: any) => {
      const nome = (row[0] ?? "").toString().trim().toLowerCase()
      const telefone = (row[1] ?? "").toString().trim()
      if (nome && telefone) mapaKeetaTelefone[nome] = telefone
    })
  } catch {
    // Aba não encontrada — não quebra o fluxo
  }

  // Monta mapa de quem JÁ enviou nota (pelo nome)
  const mapaNotas: Record<string, any> = {}
  rowsNotas.slice(1).forEach((row: any, i: number) => {
    const nome = (row[1] ?? "").toString().trim().toLowerCase()
    if (nome) {
      mapaNotas[nome] = {
        id: String(i + 2),
        link: row[4] ?? "",
        telefone: row[2] ?? "",
        status: "ENVIADO",
        numeroNfse: row[6] ?? "",
        statusValidacao: row[7] ?? "",
      }
    }
  })

  // Gera lista baseada na planilha 1 (todos os entregadores)
  return rowsEnt.slice(1).map((row: any, i: number) => {
    const nome = (row[0] ?? "").toString().trim()
    const semana = row[1] ?? ""
    const valor = row[2] ?? ""
    const nomeLower = nome.toLowerCase()

    const nota = mapaNotas[nomeLower]

    // Telefone: prioriza o da nota enviada, depois busca na Base_Entregadores
    const telefone = nota?.telefone || mapaKeetaTelefone[nomeLower] || ""

    return {
      id: nota?.id ?? String(i + 2),
      nome,
      semana,
      valor,
      telefone,
      link: nota?.link ?? "",
      status: nota ? "ENVIADO" : "PENDENTE",
      numeroNfse: nota?.numeroNfse ?? "",
      statusValidacao: nota?.statusValidacao ?? "",
    }
  })
}

export async function salvarResultadoNoSheets(linhaSheet: number, numeroNfse: string, statusValidacao: string) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_NOTAS_ID,
    range: `G${linhaSheet}:H${linhaSheet}`,
    valueInputOption: "RAW",
    requestBody: { values: [[numeroNfse, statusValidacao]] },
  })
  invalidarCache()
}
