import { sheets, SHEET_ENTREGADORES_ID, SHEET_NOTAS_ID } from "./googleSheets"

let memoriaCache: { timestamp: number; dados: any[] } | null = null
const CACHE_TTL = 30 * 1000

export function lerCache() {
  try {
    if (!memoriaCache) return null
    if (Date.now() - memoriaCache.timestamp > CACHE_TTL) {
      memoriaCache = null
      return null
    }
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
  const resEnt = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ENTREGADORES_ID,
    range: "'CONSULTA DE VALORES SEMANAL'!A1:C",
  })
  const rowsEnt = resEnt.data.values ?? []

  const resNotas = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_NOTAS_ID,
    range: "Respostas!A1:H",
  })
  const rowsNotas = resNotas.data.values ?? []

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
  // id = linha real na aba Respostas (para gravação correta)
  const mapaNotas: Record<string, any> = {}
  rowsNotas.slice(1).forEach((row: any, i: number) => {
    const nome = (row[1] ?? "").toString().trim().toLowerCase()
    if (nome) {
      mapaNotas[nome] = {
        id: String(i + 2), // linha real na planilha Respostas (1-indexed + header)
        link: row[4] ?? "",
        telefone: row[2] ?? "",
        status: "ENVIADO",
        numeroNfse: row[6] ?? "",
        statusValidacao: row[7] ?? "",
        // Guarda o nome original para lookup no salvarResultadoNoSheets
        nomeOriginal: (row[1] ?? "").toString().trim(),
      }
    }
  })

  return rowsEnt.slice(1).map((row: any, i: number) => {
    const nome = (row[0] ?? "").toString().trim()
    const semana = row[1] ?? ""
    const valor = row[2] ?? ""
    const nomeLower = nome.toLowerCase()

    const nota = mapaNotas[nomeLower]
    const telefone = nota?.telefone || mapaKeetaTelefone[nomeLower] || ""

    return {
      // CRÍTICO: só usa o id da aba Respostas se o entregador tem nota
      // Se não tem nota, id fica null — não deve ser usado para gravação
      id: nota?.id ?? null,
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

export async function salvarResultadoNoSheets(
  linhaSheetOuNome: number | string,
  numeroNfse: string,
  statusValidacao: string
) {
  // Busca a linha correta na aba Respostas pelo nome (mais confiável que id)
  const resNotas = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_NOTAS_ID,
    range: "Respostas!A1:H",
  })
  const rowsNotas = resNotas.data.values ?? []

  // Tenta encontrar pelo nome (passado como string) ou pelo número de linha
  let linhaReal: number | null = null

  if (typeof linhaSheetOuNome === "string" && isNaN(Number(linhaSheetOuNome))) {
    // É um nome — busca na coluna B (índice 1)
    const nomeBusca = linhaSheetOuNome.toLowerCase().trim()
    const idx = rowsNotas.findIndex(
      (row, i) => i > 0 && (row[1] ?? "").toString().trim().toLowerCase() === nomeBusca
    )
    if (idx !== -1) linhaReal = idx + 1 // +1 porque arrays são 0-indexed, sheets são 1-indexed
  } else {
    // É um número de linha direto
    linhaReal = Number(linhaSheetOuNome)
  }

  if (!linhaReal) {
    console.error(`Linha não encontrada para: ${linhaSheetOuNome}`)
    return
  }

  console.log(`Salvando linha ${linhaReal}: NFS-e=${numeroNfse} | Status=${statusValidacao}`)

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_NOTAS_ID,
    range: `Respostas!G${linhaReal}:H${linhaReal}`,
    valueInputOption: "RAW",
    requestBody: { values: [[numeroNfse, statusValidacao]] },
  })

  invalidarCache()
}
