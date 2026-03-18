"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts"
import {
  Upload, X, Search, TrendingUp, Users, CheckCircle,
  Clock, ChevronUp, ChevronDown, Minus, Filter, Bike,
  Truck, AlertTriangle, Ban, Save, Trash2, Edit2,
  Check, RefreshCw, History
} from "lucide-react"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface TurnoInfo { nome: string; status: string; horas: number }

interface EntregadorDia {
  data: string; id: string; nome: string; bloco: string; veiculo: string
  compareceu: string; tempoOnline: number; aceitas: number; entregues: number
  canceladas: number; recusadasTotal: number; recusadasManual: number
  recusadasAuto: number; taxaPontualidade: number; tempoMedioEntrega: number
  acima55min: number; emAtraso: number; muitoAtrasado: number
  turnos: TurnoInfo[]; turnosOn: string[]
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toNum(v: any): number {
  if (v === null || v === undefined || v === "-" || v === "") return 0
  const n = Number(v); return isNaN(n) ? 0 : n
}

function parseData(v: any): string {
  if (!v && v !== 0) return ""
  const s = String(v).replace(".0", "").trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
  const n = Number(s)
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const date = XLSX.SSF.parse_date_code(n)
    return `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`
  }
  return s
}

function parseTurnos(v: any): TurnoInfo[] {
  if (!v) return []
  return String(v).split("|").map(seg => {
    const p = seg.split(",")
    return { nome: p[0] ?? "", status: p[1] ?? "", horas: parseFloat((p[2] ?? "0").replace("h", "")) || 0 }
  }).filter(t => t.nome)
}

function pct(v: number) { return `${(v * 100).toFixed(1)}%` }
function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }

// Gera nome de semana automático a partir dos dados
function gerarNomeSemana(dados: EntregadorDia[]): string {
  if (!dados.length) return ""
  const datas = [...new Set(dados.map(d => d.data))].sort()
  return `${datas[0].slice(0, 5)} - ${datas[datas.length - 1].slice(0, 5)}`
}

const TURNOS_LISTA = ["11:00-15:00", "15:00-18:00", "18:00-22:00", "22:00-24:00"]
const TURNO_CORES: Record<string, string> = {
  "11:00-15:00": "#38bdf8", "15:00-18:00": "#fb923c",
  "18:00-22:00": "#a78bfa", "22:00-24:00": "#f472b6",
}
type SortKey = "nome" | "entregues" | "aceitas" | "canceladas" | "taxaPontualidade" |
  "tempoMedioEntrega" | "tempoOnline" | "recusadasManual" | "recusadasAuto"

// ─── PARSE EXCEL ──────────────────────────────────────────────────────────────

function parseExcel(file: File): Promise<EntregadorDia[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: "array", cellDates: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const parsed: EntregadorDia[] = []
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]
          if (!r) continue
          const num0 = Number(String(r[0] ?? "").replace(".0", "").trim())
          if (isNaN(num0) || num0 < 20000000) continue
          const dataFmt = parseData(r[0])
          if (!dataFmt || !r[2]) continue
          const turnos = parseTurnos(r[6])
          const turnosOn = turnos.filter(t => t.status === "On-Shift" && t.horas > 0).map(t => t.nome)
          parsed.push({
            data: dataFmt, id: String(r[1] ?? ""),
            nome: `${String(r[2] ?? "").trim()} ${String(r[3] ?? "").trim()}`.trim(),
            bloco: String(r[4] ?? ""), veiculo: String(r[5] ?? ""),
            compareceu: String(r[7] ?? ""), tempoOnline: toNum(r[8]),
            aceitas: toNum(r[9]), entregues: toNum(r[11]), canceladas: toNum(r[13]),
            recusadasTotal: toNum(r[14]), recusadasManual: toNum(r[15]), recusadasAuto: toNum(r[16]),
            taxaPontualidade: toNum(r[19]), tempoMedioEntrega: toNum(r[22]),
            acima55min: toNum(r[23]), emAtraso: toNum(r[24]), muitoAtrasado: toNum(r[25]),
            turnos, turnosOn,
          })
        }
        resolve(parsed)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export function AbaPerformance() {
  const [dados, setDados] = useState<EntregadorDia[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [dragOver, setDragOver] = useState(false)

  // Histórico
  const [semanas, setSemanas] = useState<string[]>([])
  const [semanaSel, setSemanaSel] = useState("")
  const [modoHistorico, setModoHistorico] = useState(false)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msgSalvar, setMsgSalvar] = useState("")
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState("")
  const [nomeSemanaAtual, setNomeSemanaAtual] = useState("")
  const jaFoiSalvo = useRef<Set<string>>(new Set())

  // Filtros
  const [filtroNome, setFiltroNome] = useState("")
  const [filtroId, setFiltroId] = useState("")
  const [filtroData, setFiltroData] = useState("")
  const [filtroTurno, setFiltroTurno] = useState("")
  const [filtroVeiculo, setFiltroVeiculo] = useState("")
  const [filtroCompareceu, setFiltroCompareceu] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("entregues")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // ─── Carregar lista de semanas salvas ────────────────────────────────────

  useEffect(() => {
    carregarSemanas(true)
  }, [])

  async function carregarSemanas(autoLoad = false) {
    try {
      const res = await fetch("/api/performance-sheets?acao=listar")
      const json = await res.json()
      if (json.semanas) {
        setSemanas(json.semanas)
        // Auto-load da semana mais recente ao abrir a página
        if (autoLoad && json.semanas.length > 0) {
          await verSemana(json.semanas[0])
        }
      }
    } catch {}
  }

  // ─── Auto-save após carregar arquivo ─────────────────────────────────────

  useEffect(() => {
    if (!dados.length || modoHistorico) return
    const nome = gerarNomeSemana(dados)
    setNomeSemanaAtual(nome)
    if (jaFoiSalvo.current.has(nome)) return
    salvarSemana(nome, dados)
  }, [dados])

  async function salvarSemana(nome: string, dadosSalvar: EntregadorDia[]) {
    setSalvando(true)
    setMsgSalvar("")
    try {
      const res = await fetch("/api/performance-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "salvar", semana: nome, dados: dadosSalvar }),
      })
      const json = await res.json()
      if (json.ok) {
        jaFoiSalvo.current.add(nome)
        setMsgSalvar(`✓ Semana "${nome}" salva automaticamente`)
        await carregarSemanas()
      } else {
        setMsgSalvar(`✗ Erro ao salvar: ${json.erro}`)
      }
    } catch (e: any) {
      setMsgSalvar(`✗ ${e.message}`)
    } finally {
      setSalvando(false)
      setTimeout(() => setMsgSalvar(""), 5000)
    }
  }

  // ─── Carregar semana do histórico ─────────────────────────────────────────

  async function verSemana(semana: string) {
    if (!semana) {
      setModoHistorico(false); setSemanaSel(""); setDados([])
      setNomeArquivo(""); limparFiltros(); return
    }
    setCarregandoHistorico(true); setSemanaSel(semana)
    try {
      const res = await fetch(`/api/performance-sheets?acao=buscar&semana=${encodeURIComponent(semana)}`)
      const json = await res.json()
      if (json.dados?.length) {
        const reconstruido: EntregadorDia[] = json.dados.map((d: any) => ({
          ...d,
          id: String(d.id ?? d.nome ?? ""),
          tempoOnline: Number(d.tempoOnline) || 0,
          aceitas: Number(d.aceitas) || 0,
          entregues: Number(d.entregues) || 0,
          canceladas: Number(d.canceladas) || 0,
          recusadasTotal: Number(d.recusadasTotal) || 0,
          recusadasManual: Number(d.recusadasManual) || 0,
          recusadasAuto: Number(d.recusadasAuto) || 0,
          taxaPontualidade: Number(d.taxaPontualidade) || 0,
          tempoMedioEntrega: Number(d.tempoMedioEntrega) || 0,
          acima55min: Number(d.acima55min) || 0,
          emAtraso: Number(d.emAtraso) || 0,
          muitoAtrasado: Number(d.muitoAtrasado) || 0,
          turnos: [],
          turnosOn: d.turnosOn ? String(d.turnosOn).split("|").filter(Boolean) : [],
        }))
        setDados(reconstruido)
        setNomeSemanaAtual(semana)
        setModoHistorico(true)
        setNomeArquivo(`Histórico: ${semana}`)
        limparFiltros()
      }
    } catch (e: any) {
      setMsgSalvar(`✗ Erro ao carregar: ${e.message}`)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  // ─── Renomear semana ──────────────────────────────────────────────────────

  async function confirmarRenomear() {
    if (!novoNome.trim() || novoNome === nomeSemanaAtual) { setEditandoNome(false); return }
    try {
      const res = await fetch("/api/performance-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "renomear", semana: nomeSemanaAtual, novoNome: novoNome.trim() }),
      })
      const json = await res.json()
      if (json.ok) {
        jaFoiSalvo.current.delete(nomeSemanaAtual)
        jaFoiSalvo.current.add(novoNome.trim())
        setNomeSemanaAtual(novoNome.trim())
        setMsgSalvar(`✓ Renomeado para "${novoNome.trim()}"`)
        await carregarSemanas()
      } else {
        setMsgSalvar(`✗ ${json.erro}`)
      }
    } catch (e: any) {
      setMsgSalvar(`✗ ${e.message}`)
    } finally {
      setEditandoNome(false)
      setTimeout(() => setMsgSalvar(""), 4000)
    }
  }

  // ─── Excluir semana ───────────────────────────────────────────────────────

  async function excluirSemana() {
    if (!window.confirm(`Excluir a semana "${nomeSemanaAtual}" permanentemente?`)) return
    try {
      const res = await fetch("/api/performance-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "excluir", semana: nomeSemanaAtual }),
      })
      const json = await res.json()
      if (json.ok) {
        jaFoiSalvo.current.delete(nomeSemanaAtual)
        setDados([]); setNomeArquivo(""); setModoHistorico(false)
        setSemanaSel(""); setNomeSemanaAtual("")
        setMsgSalvar("✓ Semana excluída")
        await carregarSemanas()
      } else {
        setMsgSalvar(`✗ ${json.erro}`)
      }
    } catch (e: any) {
      setMsgSalvar(`✗ ${e.message}`)
    } finally {
      setTimeout(() => setMsgSalvar(""), 4000)
    }
  }

  // ─── Processar arquivo ────────────────────────────────────────────────────

  async function processarArquivo(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setErro("Envie um arquivo .xlsx ou .xls da Keeta"); return
    }
    setCarregando(true); setErro(""); setModoHistorico(false)
    try {
      const parsed = await parseExcel(file)
      if (!parsed.length) { setErro("Nenhum dado encontrado."); return }
      setDados(parsed); setNomeArquivo(file.name)
    } catch (e: any) { setErro("Erro ao processar: " + e.message) }
    finally { setCarregando(false) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  // ─── DADOS DERIVADOS ──────────────────────────────────────────────────────

  const datas = useMemo(() => Array.from(new Set(dados.map(d => d.data))).sort(), [dados])
  const veiculos = useMemo(() => Array.from(new Set(dados.map(d => d.veiculo))).filter(Boolean), [dados])

  const dadosFiltrados = useMemo(() => dados.filter(d => {
    if (filtroData && d.data !== filtroData) return false
    if (filtroTurno && !d.turnosOn.includes(filtroTurno)) return false
    if (filtroVeiculo && d.veiculo !== filtroVeiculo) return false
    if (filtroCompareceu && d.compareceu !== filtroCompareceu) return false
    return true
  }), [dados, filtroData, filtroTurno, filtroVeiculo, filtroCompareceu])

  const porEntregador = useMemo(() => {
    const map: Record<string, EntregadorDia[]> = {}
    // Agrupa por id para evitar conflito com nomes iguais
    dadosFiltrados.forEach(d => {
      const chave = d.id || d.nome
      if (!map[chave]) map[chave] = []
      map[chave].push(d)
    })
    return Object.entries(map).map(([chave, dias]) => ({
      id: dias[0]?.id ?? chave,
      nome: dias[0]?.nome ?? chave,
      veiculo: dias[0]?.veiculo ?? "",
      diasTrabalhados: dias.filter(d => d.tempoOnline > 0 || d.aceitas > 0).length,
      tempoOnline: avg(dias.filter(d => d.tempoOnline > 0).map(d => d.tempoOnline)),
      aceitas: dias.reduce((a, d) => a + d.aceitas, 0),
      entregues: dias.reduce((a, d) => a + d.entregues, 0),
      canceladas: dias.reduce((a, d) => a + d.canceladas, 0),
      recusadasTotal: dias.reduce((a, d) => a + d.recusadasTotal, 0),
      recusadasManual: dias.reduce((a, d) => a + d.recusadasManual, 0),
      recusadasAuto: dias.reduce((a, d) => a + d.recusadasAuto, 0),
      taxaPontualidade: avg(dias.filter(d => d.taxaPontualidade > 0).map(d => d.taxaPontualidade)),
      tempoMedioEntrega: avg(dias.filter(d => d.tempoMedioEntrega > 0).map(d => d.tempoMedioEntrega)),
      acima55min: avg(dias.filter(d => d.acima55min > 0).map(d => d.acima55min)),
    }))
  }, [dadosFiltrados])

  const listaFiltrada = useMemo(() => {
    let lista = porEntregador.filter(e => {
      if (filtroNome && !e.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false
      if (filtroId && !e.id.includes(filtroId)) return false
      return true
    })
    return lista.sort((a, b) => {
      const va = (a as any)[sortKey] ?? 0; const vb = (b as any)[sortKey] ?? 0
      return sortDir === "desc" ? vb - va : va - vb
    })
  }, [porEntregador, filtroNome, sortKey, sortDir])

  const kpis = useMemo(() => {
    const entregues = dadosFiltrados.reduce((a, d) => a + d.entregues, 0)
    const aceitas = dadosFiltrados.reduce((a, d) => a + d.aceitas, 0)
    const canceladas = dadosFiltrados.reduce((a, d) => a + d.canceladas, 0)
    const recManual = dadosFiltrados.reduce((a, d) => a + d.recusadasManual, 0)
    const recAuto = dadosFiltrados.reduce((a, d) => a + d.recusadasAuto, 0)
    const recTotal = recManual + recAuto
    const pont = dadosFiltrados.filter(d => d.taxaPontualidade > 0).map(d => d.taxaPontualidade)
    const txEntrega = aceitas ? entregues / aceitas : 0
    const txPontualidade = avg(pont)
    return {
      entregadores: new Set(dadosFiltrados.map(d => d.nome)).size,
      entregues, aceitas, canceladas, recManual, recAuto, recTotal,
      txEntrega, txPontualidade,
      subEntregues: aceitas ? `${((entregues / aceitas) * 100).toFixed(1)}% de aceitas` : null,
      subCanceladas: aceitas ? `${((canceladas / aceitas) * 100).toFixed(1)}% de aceitas` : null,
      subRecManual: recTotal ? `${((recManual / recTotal) * 100).toFixed(0)}% do total` : null,
      subRecAuto: recTotal ? `${((recAuto / recTotal) * 100).toFixed(0)}% do total` : null,
      subTxEntrega: txEntrega >= 0.95 ? "meta atingida" : txEntrega >= 0.85 ? "próximo da meta" : "abaixo da meta",
      subPontualidade: txPontualidade >= 0.9 ? "excelente" : txPontualidade >= 0.7 ? "regular" : "atenção",
    }
  }, [dadosFiltrados])

  const top10 = useMemo(() =>
    [...listaFiltrada].sort((a, b) => b.entregues - a.entregues).slice(0, 10)
      .map(e => ({ nome: e.nome.split(" ")[0], entregues: e.entregues }))
  , [listaFiltrada])

  const dadosTurnos = useMemo(() => TURNOS_LISTA.map(turno => {
    const linhas = dadosFiltrados.filter(d => d.turnosOn.includes(turno))
    const riders = new Set(linhas.map(d => d.nome)).size
    const horas = linhas.reduce((a, d) => { const t = d.turnos.find(t => t.nome === turno); return a + (t?.horas ?? 0) }, 0)
    const aceitas = linhas.reduce((a, d) => a + d.aceitas, 0)
    const entregues = linhas.reduce((a, d) => a + d.entregues, 0)
    const canceladas = linhas.reduce((a, d) => a + d.canceladas, 0)
    const recManual = linhas.reduce((a, d) => a + d.recusadasManual, 0)
    const recAuto = linhas.reduce((a, d) => a + d.recusadasAuto, 0)
    const txEntrega = aceitas ? (entregues / aceitas) * 100 : 0
    return { turno, riders, horas: Math.round(horas * 10) / 10, aceitas, entregues, canceladas, recManual, recAuto, txEntrega: Math.round(txEntrega * 10) / 10 }
  }).filter(t => t.riders > 0), [dadosFiltrados])

  const recusadasPorTurno = useMemo(() =>
    dadosTurnos.map(t => ({ turno: t.turno.replace(":00", "h"), Manual: t.recManual, Automático: t.recAuto }))
  , [dadosTurnos])

  const heatmapData = useMemo(() => datas.map(data => {
    const row: any = { data: data.slice(0, 5) }
    TURNOS_LISTA.forEach(turno => {
      row[turno] = dadosFiltrados.filter(d => d.data === data && d.turnosOn.includes(turno)).reduce((a, d) => a + d.entregues, 0)
    })
    return row
  }), [dadosFiltrados, datas])

  const radarData = useMemo(() => dadosTurnos.map(t => ({
    turno: t.turno.replace(":00", "h"),
    "Taxa Entrega": t.txEntrega,
    "Riders": (t.riders / Math.max(...dadosTurnos.map(x => x.riders), 1)) * 100,
    "Horas": (t.horas / Math.max(...dadosTurnos.map(x => x.horas), 1)) * 100,
    "Entregas": (t.entregues / Math.max(...dadosTurnos.map(x => x.entregues), 1)) * 100,
  })), [dadosTurnos])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Minus size={11} color="#444" />
    return sortDir === "desc" ? <ChevronDown size={11} color="#FFD84D" /> : <ChevronUp size={11} color="#FFD84D" />
  }
  function limparFiltros() { setFiltroNome(""); setFiltroId(""); setFiltroData(""); setFiltroTurno(""); setFiltroVeiculo(""); setFiltroCompareceu("") }
  const temFiltroAtivo = !!(filtroData || filtroTurno || filtroVeiculo || filtroCompareceu || filtroNome || filtroId)

  // ─── TELA DE UPLOAD ───────────────────────────────────────────────────────

  if (!dados.length) {
    return (
      <div style={{ padding: "48px 40px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Performance</div>
          <div style={{ fontSize: 14, color: "#555" }}>Suba o Excel da Keeta ou carregue uma semana salva</div>
        </div>

        {/* Histórico de semanas */}
        {semanas.length > 0 && (
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <History size={14} color="#a78bfa" />
              <span style={{ fontFamily: "Syne, sans-serif", fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1.5 }}>Semanas Salvas</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {semanas.map(s => (
                <button key={s} onClick={() => verSemana(s)}
                  disabled={carregandoHistorico}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)", color: "#a78bfa", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.18)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.08)")}>
                  {carregandoHistorico ? "..." : s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload */}
        <label onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
          style={{ border: `2px dashed ${dragOver ? "#FFD84D" : "rgba(255,255,255,0.1)"}`, borderRadius: 16, padding: "44px 32px", cursor: "pointer", background: dragOver ? "rgba(255,216,77,0.04)" : "rgba(255,255,255,0.02)", transition: "all 0.2s", display: "block", textAlign: "center" }}>
          <Upload size={30} color={dragOver ? "#FFD84D" : "#444"} style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 15, color: dragOver ? "#FFD84D" : "#666", fontWeight: 600, marginBottom: 6 }}>
            {carregando ? "Processando..." : "Arraste o .xlsx aqui ou clique para selecionar"}
          </div>
          <div style={{ fontSize: 12, color: "#444" }}>Salva automaticamente no Google Sheets</div>
          <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => e.target.files?.[0] && processarArquivo(e.target.files[0])} />
        </label>

        {erro && <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13 }}>{erro}</div>}
      </div>
    )
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 40px", maxWidth: 1600, margin: "0 auto" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {/* Dropdown histórico */}
          {semanas.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <History size={13} color="#a78bfa" />
              <select value={modoHistorico ? nomeSemanaAtual : ""} onChange={e => verSemana(e.target.value)}
                style={{ background: "#0f0f0f", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", padding: "7px 12px", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, outline: "none", cursor: "pointer" }}>
                <option value="">Semana atual</option>
                {semanas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Nome da semana + editar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,216,77,0.06)", border: "1px solid rgba(255,216,77,0.2)", borderRadius: 8, padding: "6px 12px" }}>
            {editandoNome ? (
              <>
                <input autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") confirmarRenomear(); if (e.key === "Escape") setEditandoNome(false) }}
                  style={{ background: "transparent", border: "none", color: "#FFD84D", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, outline: "none", width: 140 }} />
                <button onClick={confirmarRenomear} style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", display: "flex" }}><Check size={14} /></button>
                <button onClick={() => setEditandoNome(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex" }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: "#FFD84D", fontWeight: 600 }}>{nomeSemanaAtual || nomeArquivo}</span>
                <button onClick={() => { setNovoNome(nomeSemanaAtual); setEditandoNome(true) }}
                  style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#FFD84D")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
                  <Edit2 size={13} />
                </button>
              </>
            )}
          </div>

          {/* Botão excluir */}
          {nomeSemanaAtual && (
            <button onClick={excluirSemana}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)", color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "DM Sans" }}>
              <Trash2 size={12} /> Excluir semana
            </button>
          )}

          {/* Trocar arquivo */}
          <button onClick={() => { setDados([]); setNomeArquivo(""); setModoHistorico(false); setNomeSemanaAtual(""); limparFiltros() }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#555", cursor: "pointer", fontSize: 12 }}>
            <Upload size={12} /> {modoHistorico ? "Subir novo" : "Trocar arquivo"}
          </button>
        </div>

        {/* Status salvar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {salvando && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
              <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Salvando...
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {msgSalvar && !salvando && (
            <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, background: msgSalvar.startsWith("✓") ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${msgSalvar.startsWith("✓") ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, color: msgSalvar.startsWith("✓") ? "#4ade80" : "#f87171" }}>
              {msgSalvar}
            </span>
          )}
          {modoHistorico && (
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>
              visualizando histórico
            </span>
          )}
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div style={{ background: "#0f0f0f", border: `1px solid ${temFiltroAtivo ? "rgba(255,216,77,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Filter size={13} color={temFiltroAtivo ? "#FFD84D" : "#555"} />
          <span style={{ fontSize: 11, color: temFiltroAtivo ? "#FFD84D" : "#555", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Filtros</span>
          {temFiltroAtivo && (
            <button onClick={limparFiltros} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(255,216,77,0.3)", background: "rgba(255,216,77,0.08)", color: "#FFD84D", cursor: "pointer", fontSize: 11 }}>
              <X size={10} /> Limpar
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {[
            { label: "Data", value: filtroData, set: setFiltroData, options: datas.map(d => ({ v: d, l: d })), ac: "#FFD84D" },
            { label: "Turno", value: filtroTurno, set: setFiltroTurno, options: TURNOS_LISTA.map(t => ({ v: t, l: t })), ac: TURNO_CORES[filtroTurno] || "#FFD84D" },
            { label: "Veículo", value: filtroVeiculo, set: setFiltroVeiculo, options: veiculos.map(v => ({ v, l: v })), ac: "#4ade80" },
            { label: "Compareceu", value: filtroCompareceu, set: setFiltroCompareceu, options: [{ v: "Yes", l: "Sim" }, { v: "No", l: "Não" }], ac: "#a78bfa" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{f.label}</div>
              <select value={f.value} onChange={e => f.set(e.target.value)}
                style={{ width: "100%", background: "#161616", border: `1px solid ${f.value ? `${f.ac}55` : "rgba(255,255,255,0.08)"}`, color: f.value ? f.ac : "#aaa", padding: "7px 10px", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12, outline: "none", cursor: "pointer" }}>
                <option value="">Todos</option>
                {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Entregador</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#161616", border: `1px solid ${filtroNome ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0 10px" }}>
              <Search size={13} color="#555" />
              <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="Nome..."
                style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontFamily: "DM Sans", fontSize: 12, padding: "7px 0", outline: "none" }} />
              {filtroNome && <button onClick={() => setFiltroNome("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex" }}><X size={12} /></button>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>ID</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#161616", border: `1px solid ${filtroId ? "rgba(255,216,77,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "0 10px" }}>
              <Search size={13} color="#555" />
              <input value={filtroId} onChange={e => setFiltroId(e.target.value)} placeholder="ID do entregador..."
                style={{ flex: 1, background: "transparent", border: "none", color: filtroId ? "#FFD84D" : "#fff", fontFamily: "DM Sans", fontSize: 12, padding: "7px 0", outline: "none" }} />
              {filtroId && <button onClick={() => setFiltroId("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex" }}><X size={12} /></button>}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Entregadores", value: kpis.entregadores, color: "#ce93d8", icon: <Users size={13} color="#ce93d8" />, fmt: "num", sub: null },
          { label: "Aceitas", value: kpis.aceitas, color: "#90caf9", icon: <CheckCircle size={13} color="#90caf9" />, fmt: "num", sub: null },
          { label: "Entregues", value: kpis.entregues, color: "#4ade80", icon: <TrendingUp size={13} color="#4ade80" />, fmt: "num", sub: kpis.subEntregues },
          { label: "Canceladas", value: kpis.canceladas, color: "#f87171", icon: <X size={13} color="#f87171" />, fmt: "num", sub: kpis.subCanceladas },
          { label: "Rec. Manual", value: kpis.recManual, color: "#fb923c", icon: <Ban size={13} color="#fb923c" />, fmt: "num", sub: kpis.subRecManual },
          { label: "Rec. Auto", value: kpis.recAuto, color: "#fbbf24", icon: <AlertTriangle size={13} color="#fbbf24" />, fmt: "num", sub: kpis.subRecAuto },
          { label: "Taxa Entrega", value: kpis.txEntrega, color: "#4ade80", icon: <CheckCircle size={13} color="#4ade80" />, fmt: "pct", sub: kpis.subTxEntrega },
          { label: "Pontualidade", value: kpis.txPontualidade, color: "#a78bfa", icon: <Clock size={13} color="#a78bfa" />, fmt: "pct", sub: kpis.subPontualidade },
        ].map((k, i) => (
          <div key={i} style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "11px 13px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.color }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1.5 }}>{k.label}</span>
              {k.icon}
            </div>
            <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 21, color: k.color, letterSpacing: 1 }}>
              {k.fmt === "pct" ? pct(k.value) : k.value.toLocaleString("pt-BR")}
            </div>
            {k.sub && (
              <div style={{ fontSize: 9, color: "#3a3a3a", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {k.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── ANÁLISE POR TURNO ── */}
      <SectionTitle>Análise por Turno</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${dadosTurnos.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {dadosTurnos.map(t => {
          const cor = TURNO_CORES[t.turno] ?? "#aaa"
          const ativo = filtroTurno === t.turno
          return (
            <div key={t.turno} onClick={() => setFiltroTurno(ativo ? "" : t.turno)}
              style={{ background: ativo ? `${cor}10` : "#0f0f0f", border: `1px solid ${ativo ? `${cor}55` : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: 15, cursor: "pointer", transition: "all 0.2s", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: cor }} />
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 700, color: cor, marginBottom: 10 }}>{t.turno}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {[
                  { label: "Riders", value: t.riders, color: "#fff" },
                  { label: "Horas", value: `${t.horas}h`, color: "#aaa" },
                  { label: "Entregues", value: t.entregues, color: "#4ade80" },
                  { label: "Tx Entrega", value: `${t.txEntrega.toFixed(0)}%`, color: t.txEntrega >= 90 ? "#4ade80" : "#fbbf24" },
                  { label: "Rec. Manual", value: t.recManual, color: "#fb923c" },
                  { label: "Rec. Auto", value: t.recAuto, color: "#fbbf24" },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontFamily: "Bebas Neue, sans-serif", color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {ativo && <div style={{ position: "absolute", top: 7, right: 7, fontSize: 9, color: cor, background: `${cor}20`, padding: "2px 6px", borderRadius: 8, border: `1px solid ${cor}44` }}>filtrado</div>}
            </div>
          )
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 22 }}>
        <ChartCard title="Entregas por Dia × Turno">
          <BarChart data={heatmapData} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="data" tick={{ fill: "#aaa", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans", color: "#555" }} />
            {TURNOS_LISTA.filter(t => dadosTurnos.some(d => d.turno === t)).map(t => (
              <Bar key={t} dataKey={t} fill={TURNO_CORES[t]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ChartCard>

        <ChartCard title="Recusadas por Turno" badge={{ label: "Manual vs Auto", color: "#fb923c" }}>
          <BarChart data={recusadasPorTurno} barSize={26}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="turno" tick={{ fill: "#aaa", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans", color: "#555" }} />
            <Bar dataKey="Manual" fill="#fb923c" stackId="a" />
            <Bar dataKey="Automático" fill="#fbbf24" radius={[3, 3, 0, 0]} stackId="a" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Performance por Turno">
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.05)" />
            <PolarAngleAxis dataKey="turno" tick={{ fill: "#666", fontSize: 10, fontFamily: "DM Sans" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {(["Taxa Entrega", "Riders", "Horas", "Entregas"] as const).map((key, i) => {
              const colors = ["#4ade80", "#38bdf8", "#fb923c", "#a78bfa"]
              return <Radar key={key} dataKey={key} stroke={colors[i]} fill={colors[i]} fillOpacity={0.08} strokeWidth={1.5} dot={false} />
            })}
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Sans", color: "#555" }} />
          </RadarChart>
        </ChartCard>
      </div>

      {/* ── RECUSADAS ── */}
      <SectionTitle>Detalhamento de Recusadas</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
        <ChartCard title="Top 8 — Rejeite Manual" badge={{ label: "pelo entregador", color: "#fb923c" }} icon={<Ban size={13} color="#fb923c" />}>
          <BarChart layout="vertical" barSize={14} data={[...listaFiltrada].sort((a, b) => b.recusadasManual - a.recusadasManual).slice(0, 8).map(e => ({ nome: e.nome.split(" ")[0], value: e.recusadasManual }))}>
            <XAxis type="number" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="nome" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} width={75} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} formatter={(v: any) => [v, "Manuais"]} />
            <Bar dataKey="value" fill="#fb923c" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top 8 — Recusa Automática" badge={{ label: "pelo sistema", color: "#fbbf24" }} icon={<AlertTriangle size={13} color="#fbbf24" />}>
          <BarChart layout="vertical" barSize={14} data={[...listaFiltrada].sort((a, b) => b.recusadasAuto - a.recusadasAuto).slice(0, 8).map(e => ({ nome: e.nome.split(" ")[0], value: e.recusadasAuto }))}>
            <XAxis type="number" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="nome" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} width={75} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} formatter={(v: any) => [v, "Automáticas"]} />
            <Bar dataKey="value" fill="#fbbf24" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      {/* ── TOP 10 ── */}
      <SectionTitle>Rankings</SectionTitle>
      <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Top 10 — Tarefas Entregues</div>
        <ResponsiveContainer width="100%" height={185}>
          <BarChart data={top10} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="nome" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} formatter={(v: any) => [v, "Entregues"]} />
            <Bar dataKey="entregues" radius={[4, 4, 0, 0]}>
              {top10.map((_, i) => <Cell key={i} fill={i === 0 ? "#FFD84D" : i === 1 ? "#ce93d8" : i === 2 ? "#90caf9" : "#4ade80"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── TABELA ── */}
      <SectionTitle>Detalhamento Individual</SectionTitle>
      <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5 }}>Por Entregador</div>
          <span style={{ fontSize: 12, color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px 10px", borderRadius: 20 }}>{listaFiltrada.length} entregadores</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {([
                  { label: "Entregador", key: "nome" }, { label: "Veículo", key: null }, { label: "Dias", key: null },
                  { label: "T.Online", key: "tempoOnline" }, { label: "Aceitas", key: "aceitas" }, { label: "Entregues", key: "entregues" },
                  { label: "Canceladas", key: "canceladas" }, { label: "Rec. Manual", key: "recusadasManual" }, { label: "Rec. Auto", key: "recusadasAuto" },
                  { label: "Pontualidade", key: "taxaPontualidade" }, { label: "T.Médio", key: "tempoMedioEntrega" }, { label: "Acima 55min", key: null }, { label: "Turnos", key: null },
                ] as { label: string; key: SortKey | null }[]).map((h, i) => (
                  <th key={i} onClick={() => h.key && toggleSort(h.key)}
                    style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, fontWeight: 500, cursor: h.key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{h.label}{h.key && <SortIcon k={h.key} />}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((e, i) => {
                const txEntrega = e.aceitas ? e.entregues / e.aceitas : 0
                const pontColor = e.taxaPontualidade >= 0.9 ? "#4ade80" : e.taxaPontualidade >= 0.7 ? "#fbbf24" : "#f87171"
                const entregaColor = txEntrega >= 0.9 ? "#4ade80" : txEntrega >= 0.7 ? "#fbbf24" : "#f87171"
                const totalRec = e.recusadasManual + e.recusadasAuto
                const turnosUnicos = Array.from(new Set(dadosFiltrados.filter(d => d.nome === e.nome).flatMap(d => d.turnosOn)))
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "9px 13px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(156,39,176,0.2)", border: "1px solid rgba(156,39,176,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#ce93d8", fontWeight: 700, flexShrink: 0 }}>{e.nome.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize: 13, color: "#e8e8f0", fontWeight: 600 }}>{e.nome}</div>
                          <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>{e.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 13px" }}>
                      <span style={{ fontSize: 11, color: e.veiculo === "Motorcycle" ? "#fbbf24" : "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                        {e.veiculo === "Motorcycle" ? <Truck size={12} /> : <Bike size={12} />}
                        {e.veiculo === "Motorcycle" ? "Moto" : "Bike"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "#666", textAlign: "center" }}>{e.diasTrabalhados}</td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "#aaa", textAlign: "center" }}>{e.tempoOnline.toFixed(1)}h</td>
                    <td style={{ padding: "9px 13px", fontSize: 13, color: "#90caf9", fontWeight: 700, textAlign: "center" }}>{e.aceitas}</td>
                    <td style={{ padding: "9px 13px", textAlign: "center" }}>
                      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700, color: entregaColor }}>{e.entregues}</span>
                      <span style={{ fontSize: 10, color: "#444", marginLeft: 4 }}>{pct(txEntrega)}</span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 13, color: e.canceladas > 2 ? "#f87171" : "#555", fontWeight: e.canceladas > 2 ? 700 : 400, textAlign: "center" }}>{e.canceladas}</td>
                    <td style={{ padding: "9px 13px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 12, color: e.recusadasManual > 10 ? "#fb923c" : "#555", fontWeight: e.recusadasManual > 10 ? 700 : 400 }}>{e.recusadasManual}</span>
                        {totalRec > 0 && <div style={{ width: 34, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ width: `${(e.recusadasManual / totalRec) * 100}%`, height: "100%", background: "#fb923c" }} /></div>}
                      </div>
                    </td>
                    <td style={{ padding: "9px 13px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 12, color: e.recusadasAuto > 10 ? "#fbbf24" : "#555", fontWeight: e.recusadasAuto > 10 ? 700 : 400 }}>{e.recusadasAuto}</span>
                        {totalRec > 0 && <div style={{ width: 34, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ width: `${(e.recusadasAuto / totalRec) * 100}%`, height: "100%", background: "#fbbf24" }} /></div>}
                      </div>
                    </td>
                    <td style={{ padding: "9px 13px", textAlign: "center" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${pontColor}15`, color: pontColor, border: `1px solid ${pontColor}30` }}>
                        {e.taxaPontualidade > 0 ? pct(e.taxaPontualidade) : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: e.tempoMedioEntrega > 40 ? "#fbbf24" : "#aaa", textAlign: "center" }}>{e.tempoMedioEntrega > 0 ? `${e.tempoMedioEntrega.toFixed(0)} min` : "—"}</td>
                    <td style={{ padding: "9px 13px", textAlign: "center" }}><span style={{ fontSize: 11, color: e.acima55min > 0.15 ? "#f87171" : "#555" }}>{pct(e.acima55min)}</span></td>
                    <td style={{ padding: "9px 13px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {turnosUnicos.map(t => (
                          <span key={t} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: `${TURNO_CORES[t] ?? "#888"}18`, color: TURNO_CORES[t] ?? "#888", border: `1px solid ${TURNO_CORES[t] ?? "#888"}30`, whiteSpace: "nowrap" }}>
                            {t.replace(":00", "h")}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── AUXILIARES ───────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
      {children}
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
    </div>
  )
}

function ChartCard({ title, children, badge, icon }: { title: string; children: React.ReactNode; badge?: { label: string; color: string }; icon?: React.ReactNode }) {
  return (
    <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {icon}
        <span style={{ fontFamily: "Syne, sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5 }}>{title}</span>
        {badge && <span style={{ fontSize: 10, color: badge.color, background: `${badge.color}18`, border: `1px solid ${badge.color}33`, padding: "2px 8px", borderRadius: 10 }}>{badge.label}</span>}
      </div>
      <ResponsiveContainer width="100%" height={200}>{children as any}</ResponsiveContainer>
    </div>
  )
}