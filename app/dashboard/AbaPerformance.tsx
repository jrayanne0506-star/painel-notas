"use client"

import { useState, useMemo } from "react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell
} from "recharts"
import {
  Upload, X, Search, TrendingUp, TrendingDown,
  Users, CheckCircle, Clock, ChevronUp, ChevronDown, Minus
} from "lucide-react"

// ─── TIPOS ────────────────────────────────────────────────────────────────
interface EntregadorDia {
  data: string
  id: string
  nome: string
  bloco: string
  veiculo: string
  tempoOnline: number
  aceitas: number
  entregues: number
  canceladas: number
  recusadas: number
  recusadasEntregador: number
  taxaPontualidade: number
  tempoMedioEntrega: number
  acima55min: number
  emAtraso: number
  muitoAtrasado: number
  compareceu: string
}

// ─── UTILS ─────────────────────────────────────────────────────────────────
function toNum(v: any): number {
  if (v === null || v === undefined || v === "-" || v === "") return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

type SortKey = "nome" | "entregues" | "aceitas" | "canceladas" | "taxaPontualidade" | "tempoMedioEntrega" | "tempoOnline"

// ─── PARSER DO EXCEL ──────────────────────────────────────────────────────
function parseExcel(file: File): Promise<EntregadorDia[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

        const parsed: EntregadorDia[] = []
        // linhas 0 e 1 são cabeçalho, dados começam na linha 2
        for (let i = 2; i < rows.length; i++) {
          const r = rows[i]
          if (!r[0] || !r[2]) continue

          const dataStr = String(r[0]).replace(".0", "")
          const fmt = `${dataStr.slice(6, 8)}/${dataStr.slice(4, 6)}/${dataStr.slice(0, 4)}`

          parsed.push({
            data: fmt,
            id: String(r[1] ?? ""),
            nome: `${String(r[2] ?? "").trim()} ${String(r[3] ?? "").trim()}`.trim(),
            bloco: String(r[4] ?? ""),
            veiculo: String(r[5] ?? ""),
            compareceu: String(r[7] ?? ""),
            tempoOnline: toNum(r[8]),
            aceitas: toNum(r[9]),
            entregues: toNum(r[11]),
            canceladas: toNum(r[13]),
            recusadas: toNum(r[14]),
            recusadasEntregador: toNum(r[15]),
            taxaPontualidade: toNum(r[19]),
            tempoMedioEntrega: toNum(r[22]),
            acima55min: toNum(r[23]),
            emAtraso: toNum(r[24]),
            muitoAtrasado: toNum(r[25]),
          })
        }
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
export function AbaPerformance() {
  const [dados, setDados] = useState<EntregadorDia[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [dragOver, setDragOver] = useState(false)

  const [filtroNome, setFiltroNome] = useState("")
  const [filtroData, setFiltroData] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("entregues")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  async function processarArquivo(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setErro("Envie um arquivo .xlsx ou .xls da Keeta")
      return
    }
    setCarregando(true)
    setErro("")
    try {
      const parsed = await parseExcel(file)
      if (parsed.length === 0) {
        setErro("Nenhum dado encontrado no arquivo. Verifique se é o Excel correto da Keeta.")
        return
      }
      setDados(parsed)
      setNomeArquivo(file.name)
    } catch (e: any) {
      setErro("Erro ao processar o arquivo: " + e.message)
    } finally {
      setCarregando(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  const datas = useMemo(() => {
    const set = new Set(dados.map(d => d.data))
    return Array.from(set).sort()
  }, [dados])

  const dadosFiltradosData = useMemo(() => {
    if (!filtroData) return dados
    return dados.filter(d => d.data === filtroData)
  }, [dados, filtroData])

  const porEntregador = useMemo(() => {
    const map: Record<string, EntregadorDia[]> = {}
    dadosFiltradosData.forEach(d => {
      if (!map[d.nome]) map[d.nome] = []
      map[d.nome].push(d)
    })
    return Object.entries(map).map(([nome, dias]) => ({
      nome,
      diasTrabalhados: dias.length,
      tempoOnline: avg(dias.map(d => d.tempoOnline)),
      aceitas: dias.reduce((a, d) => a + d.aceitas, 0),
      entregues: dias.reduce((a, d) => a + d.entregues, 0),
      canceladas: dias.reduce((a, d) => a + d.canceladas, 0),
      recusadas: dias.reduce((a, d) => a + d.recusadas, 0),
      taxaPontualidade: avg(dias.filter(d => d.taxaPontualidade > 0).map(d => d.taxaPontualidade)),
      tempoMedioEntrega: avg(dias.filter(d => d.tempoMedioEntrega > 0).map(d => d.tempoMedioEntrega)),
      acima55min: avg(dias.filter(d => d.acima55min >= 0).map(d => d.acima55min)),
    }))
  }, [dadosFiltradosData])

  const listaFiltrada = useMemo(() => {
    let lista = porEntregador.filter(e =>
      !filtroNome || e.nome.toLowerCase().includes(filtroNome.toLowerCase())
    )
    lista = lista.sort((a, b) => {
      const va = (a as any)[sortKey] ?? 0
      const vb = (b as any)[sortKey] ?? 0
      return sortDir === "desc" ? vb - va : va - vb
    })
    return lista
  }, [porEntregador, filtroNome, sortKey, sortDir])

  const kpis = useMemo(() => {
    const total = dadosFiltradosData
    const entregues = total.reduce((a, d) => a + d.entregues, 0)
    const aceitas = total.reduce((a, d) => a + d.aceitas, 0)
    const canceladas = total.reduce((a, d) => a + d.canceladas, 0)
    const recusadas = total.reduce((a, d) => a + d.recusadas, 0)
    const pontualidades = total.filter(d => d.taxaPontualidade > 0).map(d => d.taxaPontualidade)
    const tempos = total.filter(d => d.tempoMedioEntrega > 0).map(d => d.tempoMedioEntrega)
    return {
      entregadores: new Set(total.map(d => d.nome)).size,
      entregues,
      aceitas,
      canceladas,
      recusadas,
      txEntrega: aceitas ? entregues / aceitas : 0,
      txPontualidade: avg(pontualidades),
      tempoMedio: avg(tempos),
    }
  }, [dadosFiltradosData])

  const top10 = useMemo(() => {
    return [...listaFiltrada]
      .sort((a, b) => b.entregues - a.entregues)
      .slice(0, 10)
      .map(e => ({ nome: e.nome.split(" ")[0], entregues: e.entregues, pontualidade: Math.round(e.taxaPontualidade * 100) }))
  }, [listaFiltrada])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Minus size={11} color="#444" />
    return sortDir === "desc" ? <ChevronDown size={11} color="#FFD84D" /> : <ChevronUp size={11} color="#FFD84D" />
  }

  // ── TELA DE UPLOAD ──────────────────────────────────────────────────────
  if (!dados.length) {
    return (
      <div style={{ padding: "60px 40px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          Aba de Performance
        </div>
        <div style={{ fontSize: 14, color: "#555", marginBottom: 40 }}>
          Faça upload do Excel exportado da Keeta para visualizar a performance dos entregadores
        </div>

        <label
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          style={{
            border: `2px dashed ${dragOver ? "#FFD84D" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 16,
            padding: "48px 32px",
            cursor: "pointer",
            background: dragOver ? "rgba(255,216,77,0.04)" : "rgba(255,255,255,0.02)",
            transition: "all 0.2s",
            display: "block",
          }}
        >
          <Upload size={32} color={dragOver ? "#FFD84D" : "#444"} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 15, color: dragOver ? "#FFD84D" : "#666", fontWeight: 600, marginBottom: 8 }}>
            {carregando ? "Processando..." : "Arraste o arquivo aqui ou clique para selecionar"}
          </div>
          <div style={{ fontSize: 12, color: "#444" }}>Aceita .xlsx exportado da Keeta</div>
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={e => e.target.files?.[0] && processarArquivo(e.target.files[0])}
          />
        </label>

        {erro && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13 }}>
            {erro}
          </div>
        )}
      </div>
    )
  }

  // ── DASHBOARD ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1600, margin: "0 auto" }}>

      {/* ── BARRA SUPERIOR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Arquivo</div>
          <div style={{ fontSize: 13, color: "#FFD84D", fontWeight: 600, background: "rgba(255,216,77,0.08)", border: "1px solid rgba(255,216,77,0.2)", padding: "6px 12px", borderRadius: 8 }}>
            📄 {nomeArquivo}
          </div>
          <button
            onClick={() => { setDados([]); setNomeArquivo(""); setFiltroData(""); setFiltroNome("") }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#666", cursor: "pointer", fontSize: 12 }}
          >
            <X size={12} /> Trocar arquivo
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Data</div>
          <select
            value={filtroData}
            onChange={e => setFiltroData(e.target.value)}
            style={{ background: "#0f0f0f", border: `1px solid ${filtroData ? "rgba(255,216,77,0.4)" : "rgba(255,255,255,0.1)"}`, color: filtroData ? "#FFD84D" : "#aaa", padding: "8px 14px", borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer" }}
          >
            <option value="">Todos os dias</option>
            {datas.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {filtroData && (
            <button onClick={() => setFiltroData("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Entregadores", value: kpis.entregadores, color: "#ce93d8", icon: <Users size={16} color="#ce93d8" />, fmt: "num" },
          { label: "Tarefas aceitas", value: kpis.aceitas, color: "#90caf9", icon: <CheckCircle size={16} color="#90caf9" />, fmt: "num" },
          { label: "Entregues", value: kpis.entregues, color: "#4ade80", icon: <TrendingUp size={16} color="#4ade80" />, fmt: "num" },
          { label: "Canceladas", value: kpis.canceladas, color: "#f87171", icon: <X size={16} color="#f87171" />, fmt: "num" },
          { label: "Recusadas", value: kpis.recusadas, color: "#fbbf24", icon: <TrendingDown size={16} color="#fbbf24" />, fmt: "num" },
          { label: "Taxa entrega", value: kpis.txEntrega, color: "#4ade80", icon: <CheckCircle size={16} color="#4ade80" />, fmt: "pct" },
          { label: "Pontualidade", value: kpis.txPontualidade, color: "#a78bfa", icon: <Clock size={16} color="#a78bfa" />, fmt: "pct" },
        ].map((k, i) => (
          <div key={i} style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.color }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1.5 }}>{k.label}</span>
              {k.icon}
            </div>
            <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 24, color: k.color, letterSpacing: 1 }}>
              {k.fmt === "pct" ? pct(k.value) : k.value.toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>

      {/* ── GRÁFICO TOP 10 */}
      <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 20 }}>
          Top 10 — Tarefas Entregues
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={top10} barSize={22}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="nome" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }}
              formatter={(v: any, name: any) => [name === "entregues" ? v : `${v}%`, name === "entregues" ? "Entregues" : "Pontualidade"]}
            />
            <Bar dataKey="entregues" name="entregues" radius={[4, 4, 0, 0]}>
              {top10.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "#FFD84D" : i === 1 ? "#ce93d8" : i === 2 ? "#90caf9" : "#4ade80"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── TABELA */}
      <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5 }}>
            Detalhamento por Entregador
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={13} color="#555" />
            <input
              value={filtroNome}
              onChange={e => setFiltroNome(e.target.value)}
              placeholder="Buscar entregador..."
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 13, outline: "none", width: 200 }}
            />
            <span style={{ fontSize: 12, color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "4px 10px", borderRadius: 20 }}>
              {listaFiltrada.length} entregadores
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Entregador", key: "nome" as SortKey },
                  { label: "Dias", key: null },
                  { label: "T. Online (h)", key: "tempoOnline" as SortKey },
                  { label: "Aceitas", key: "aceitas" as SortKey },
                  { label: "Entregues", key: "entregues" as SortKey },
                  { label: "Canceladas", key: "canceladas" as SortKey },
                  { label: "Recusadas", key: null },
                  { label: "Pontualidade", key: "taxaPontualidade" as SortKey },
                  { label: "T. Médio (min)", key: "tempoMedioEntrega" as SortKey },
                  { label: "Acima 55min", key: null },
                ].map((h, i) => (
                  <th key={i}
                    onClick={() => h.key && toggleSort(h.key)}
                    style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, fontWeight: 500, cursor: h.key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {h.label}
                      {h.key && <SortIcon k={h.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((e, i) => {
                const txEntrega = e.aceitas ? e.entregues / e.aceitas : 0
                const pontColor = e.taxaPontualidade >= 0.9 ? "#4ade80" : e.taxaPontualidade >= 0.7 ? "#fbbf24" : "#f87171"
                const entregaColor = txEntrega >= 0.9 ? "#4ade80" : txEntrega >= 0.7 ? "#fbbf24" : "#f87171"
                return (
                  <tr key={i}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#e8e8f0", fontWeight: 600, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(156,39,176,0.2)", border: "1px solid rgba(156,39,176,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#ce93d8", fontWeight: 700, flexShrink: 0 }}>
                          {e.nome.charAt(0)}
                        </div>
                        {e.nome}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#888", textAlign: "center" }}>{e.diasTrabalhados}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#aaa", textAlign: "center" }}>{e.tempoOnline.toFixed(1)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#90caf9", fontWeight: 700, textAlign: "center" }}>{e.aceitas}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 700, color: entregaColor }}>{e.entregues}</span>
                      <span style={{ fontSize: 10, color: "#444", marginLeft: 4 }}>{pct(txEntrega)}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: e.canceladas > 2 ? "#f87171" : "#666", fontWeight: e.canceladas > 2 ? 700 : 400, textAlign: "center" }}>{e.canceladas}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: e.recusadas > 5 ? "#fbbf24" : "#555", textAlign: "center" }}>{e.recusadas}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${pontColor}15`, color: pontColor, border: `1px solid ${pontColor}30` }}>
                        {e.taxaPontualidade > 0 ? pct(e.taxaPontualidade) : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: e.tempoMedioEntrega > 40 ? "#fbbf24" : "#aaa", textAlign: "center" }}>
                      {e.tempoMedioEntrega > 0 ? `${e.tempoMedioEntrega.toFixed(0)} min` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ fontSize: 12, color: e.acima55min > 0.15 ? "#f87171" : "#555" }}>
                        {pct(e.acima55min)}
                      </span>
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
