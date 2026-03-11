"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend
} from "recharts"
import {
  Users, CheckCircle, AlertCircle, DollarSign, LogOut,
  Search, X, Download, Save, BarChart2, RefreshCw,
  Plus, Trash2, Edit2, Check, TrendingUp, TrendingDown, Wallet, Receipt
} from "lucide-react"
import { useEffect, useState } from "react"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { useRouter } from "next/navigation"
import { AbaPerformance } from "./AbaPerformance"

type StatusDespesa = "PAGO" | "PENDENTE" | "CANCELADO"
type Aba = "notas" | "despesas" | "performance"

interface Despesa {
  id: string
  nome: string
  valor: number
  status: StatusDespesa
  semana: string
  categoria: string
  criadaEm: string
}

interface SemanaFinanceira {
  semana: string
  receita: number
  despesas: number
  lucro: number
}

async function sheetsGet(aba: string) {
  const res = await fetch(`/api/sheets?aba=${aba}`)
  return res.json()
}

async function sheetsPost(body: object) {
  await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function semanaAtual() {
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - hoje.getDay() + 1)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `${fmt(inicio)} - ${fmt(fim)}`
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const CATEGORIAS_DEFAULT = [
  "Aluguel", "Salários", "Combustível", "Manutenção",
  "Impostos", "Internet", "Telefone", "Outros"
]

export function AbaDespesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [receitas, setReceitas] = useState<Record<string, number>>({})
  const [semanas, setSemanas] = useState<string[]>([])
  const [semanaSel, setSemanaSel] = useState(semanaAtual())
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT)
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState("")
  const [filtroSemanaTabela, setFiltroSemanaTabela] = useState("")
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formNome, setFormNome] = useState("")
  const [formValor, setFormValor] = useState("")
  const [formCategoria, setFormCategoria] = useState(CATEGORIAS_DEFAULT[0])
  const [formStatus, setFormStatus] = useState<StatusDespesa>("PENDENTE")
  const [novaCategoria, setNovaCategoria] = useState("")
  const [mostrarNovaCategoria, setMostrarNovaCategoria] = useState(false)
  const [editandoReceita, setEditandoReceita] = useState(false)
  const [inputReceita, setInputReceita] = useState("")
  const [modalNovaSemana, setModalNovaSemana] = useState(false)
  const [novaSemanaInput, setNovaSemanaInput] = useState("")

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErroCarregamento("")
      try {
        const [rawDesp, rawRec] = await Promise.all([
          sheetsGet("despesas"),
          sheetsGet("receitas"),
        ])
        if (rawDesp?.erro || rawRec?.erro) {
          setErroCarregamento(rawDesp?.erro || rawRec?.erro)
          setCarregando(false)
          return
        }
        const desp: Despesa[] = (Array.isArray(rawDesp) ? rawDesp : [])
          .map((r: any) => ({
            id: String(r.id ?? ""),
            nome: String(r.nome ?? ""),
            valor: Number(r.valor ?? 0),
            status: (r.status ?? "PENDENTE") as StatusDespesa,
            semana: String(r.semana ?? ""),
            categoria: String(r.categoria ?? ""),
            criadaEm: String(r.criadaEm ?? new Date().toISOString()),
          }))
          .filter(d => d.id && d.semana)
        const rec: Record<string, number> = {}
        ;(Array.isArray(rawRec) ? rawRec : []).forEach((r: any) => {
          if (r.semana) rec[String(r.semana)] = Number(r.valor ?? 0)
        })
        setDespesas(desp)
        setReceitas(rec)
        const semanasUnicas = Array.from(
          new Set([semanaAtual(), ...desp.map(x => x.semana)])
        ).sort().reverse()
        setSemanas(semanasUnicas)
        if (semanasUnicas.includes(semanaAtual())) {
          setSemanaSel(semanaAtual())
        } else if (semanasUnicas.length > 0) {
          setSemanaSel(semanasUnicas[0])
        }
      } catch (e: any) {
        setErroCarregamento(e.message || "Erro desconhecido")
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  const despSemana = despesas.filter(d => d.semana === semanaSel)
  const receitaSemana = receitas[semanaSel] || 0
  const totalPago = despSemana.filter(d => d.status === "PAGO").reduce((a, d) => a + d.valor, 0)
  const totalPendente = despSemana.filter(d => d.status === "PENDENTE").reduce((a, d) => a + d.valor, 0)
  const totalDespesas = totalPago + totalPendente
  const lucroLiquido = receitaSemana - totalDespesas
  const maiorDespesa = despSemana.filter(d => d.status !== "CANCELADO").sort((a, b) => b.valor - a.valor)[0]
  const despExibidas = filtroSemanaTabela ? despesas.filter(d => d.semana === filtroSemanaTabela) : despSemana
  const totalExibidoPago = despExibidas.filter(d => d.status === "PAGO").reduce((a, d) => a + d.valor, 0)
  const totalExibidoPendente = despExibidas.filter(d => d.status === "PENDENTE").reduce((a, d) => a + d.valor, 0)
  const totalExibido = totalExibidoPago + totalExibidoPendente
  const lucroExibido = (filtroSemanaTabela ? (receitas[filtroSemanaTabela] || 0) : receitaSemana) - totalExibido
  const dadosComparativo: SemanaFinanceira[] = semanas.slice(0, 8).reverse().map(s => {
    const ds = despesas.filter(d => d.semana === s)
    const rec = receitas[s] || 0
    const desp = ds.filter(d => d.status !== "CANCELADO").reduce((a, d) => a + d.valor, 0)
    return { semana: s, receita: rec, despesas: desp, lucro: rec - desp }
  })
  const porCategoria = despExibidas.filter(d => d.status !== "CANCELADO").reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + d.valor
    return acc
  }, {} as Record<string, number>)
  const dadosCategoria = Object.entries(porCategoria).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val)

  async function salvarDespesa(d: Despesa) {
    await sheetsPost({ aba: "despesas", acao: "upsert", dados: { id: d.id, nome: d.nome, valor: d.valor, status: d.status, semana: d.semana, categoria: d.categoria, criadaEm: d.criadaEm } })
  }
  async function excluirDespesaSheets(id: string) {
    await sheetsPost({ aba: "despesas", acao: "delete", dados: { campo: "id", valor: id } })
  }
  function atualizarSemanas(lista: Despesa[]) {
    const s = Array.from(new Set([semanaAtual(), semanaSel, ...lista.map(x => x.semana)])).sort().reverse()
    setSemanas(s)
  }
  function abrirForm(d?: Despesa) {
    if (d) {
      setEditandoId(d.id); setFormNome(d.nome); setFormValor(String(d.valor)); setFormCategoria(d.categoria); setFormStatus(d.status)
    } else {
      setEditandoId(null); setFormNome(""); setFormValor(""); setFormCategoria(categorias[0]); setFormStatus("PENDENTE")
    }
    setFormAberto(true)
  }
  async function confirmarForm() {
    if (!formNome.trim() || !formValor) return
    const val = parseFloat(formValor.replace(",", "."))
    if (isNaN(val)) return
    if (editandoId) {
      const novas = despesas.map(d => d.id === editandoId ? { ...d, nome: formNome.trim(), valor: val, categoria: formCategoria, status: formStatus } : d)
      setDespesas(novas); atualizarSemanas(novas)
      const atualizada = novas.find(d => d.id === editandoId)!
      await salvarDespesa(atualizada)
    } else {
      const nova: Despesa = { id: gerarId(), nome: formNome.trim(), valor: val, status: formStatus, semana: semanaSel, categoria: formCategoria, criadaEm: new Date().toISOString() }
      const novas = [...despesas, nova]
      setDespesas(novas); atualizarSemanas(novas)
      await salvarDespesa(nova)
    }
    setFormAberto(false)
  }
  async function excluir(id: string) {
    const novas = despesas.filter(d => d.id !== id)
    setDespesas(novas); atualizarSemanas(novas)
    await excluirDespesaSheets(id)
  }
  async function alterarStatus(id: string, status: StatusDespesa) {
    const novas = despesas.map(d => d.id === id ? { ...d, status } : d)
    setDespesas(novas)
    const atualizada = novas.find(d => d.id === id)!
    await salvarDespesa(atualizada)
  }
  async function salvarReceita() {
    const val = parseFloat(inputReceita.replace(",", "."))
    if (isNaN(val)) return
    const novas = { ...receitas, [semanaSel]: val }
    setReceitas(novas); setEditandoReceita(false)
    await sheetsPost({ aba: "receitas", acao: "upsert-receita", dados: { semana: semanaSel, valor: val } })
  }
  function adicionarCategoria() {
    if (!novaCategoria.trim()) return
    const nova = novaCategoria.trim()
    if (!categorias.includes(nova)) { setCategorias([...categorias, nova]); setFormCategoria(nova) }
    setNovaCategoria(""); setMostrarNovaCategoria(false)
  }
  function criarSemana() {
    if (!novaSemanaInput.trim()) return
    const s = Array.from(new Set([novaSemanaInput.trim(), ...semanas])).sort().reverse()
    setSemanas(s); setSemanaSel(novaSemanaInput.trim()); setModalNovaSemana(false); setNovaSemanaInput("")
  }
  async function excluirSemana() {
    if (!window.confirm(`Excluir a semana "${semanaSel}" e todas as suas despesas?`)) return
    const novasDespesas = despesas.filter(d => d.semana !== semanaSel)
    setDespesas(novasDespesas)
    const novasReceitas = { ...receitas }
    delete novasReceitas[semanaSel]
    setReceitas(novasReceitas)
    const novasSemanas = semanas.filter(s => s !== semanaSel)
    const lista = novasSemanas.length ? novasSemanas : [semanaAtual()]
    setSemanas(lista); setSemanaSel(lista[0])
    await sheetsPost({ aba: "despesas", acao: "delete-semana", dados: { semana: semanaSel } })
    await sheetsPost({ aba: "receitas", acao: "delete", dados: { campo: "semana", valor: semanaSel } })
  }
  function exportarCSVSemana() {
    const cabecalho = ["Nome", "Categoria", "Valor (R$)", "Status", "Semana", "Criada em"]
    const linhas = despExibidas.map(d => [d.nome, d.categoria, d.valor.toFixed(2).replace(".", ","), d.status, d.semana, new Date(d.criadaEm).toLocaleString("pt-BR")])
    const conteudo = [cabecalho, ...linhas].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `despesas_${(filtroSemanaTabela || semanaSel).replace(/\//g, "-")}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const statusConfig = {
    PAGO: { label: "Pago", bg: "rgba(74,222,128,0.1)", color: "#4ade80", border: "rgba(74,222,128,0.25)" },
    PENDENTE: { label: "Pendente", bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.25)" },
    CANCELADO: { label: "Cancelado", bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.25)" },
  }

  if (carregando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#555", fontSize: 14, gap: 12 }}>
      <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />Carregando dados da planilha...
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
  if (erroCarregamento) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "#f87171", fontSize: 14, gap: 12 }}>
      <X size={20} />Erro ao carregar: {erroCarregamento}
      <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer", fontFamily: "DM Sans", fontSize: 13 }}>Tentar novamente</button>
    </div>
  )

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Semana</div>
          <select value={semanaSel} onChange={e => { setSemanaSel(e.target.value); setFiltroSemanaTabela("") }} style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 14px", borderRadius: 8, fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer" }}>
            {semanas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setModalNovaSemana(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,216,77,0.25)", background: "rgba(255,216,77,0.08)", color: "#FFD84D", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Plus size={13} /> Nova semana</button>
          <button onClick={excluirSemana} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(239,83,80,0.25)", background: "rgba(239,83,80,0.08)", color: "#f87171", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Trash2 size={13} /> Excluir semana</button>
          <button onClick={exportarCSVSemana} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(100,181,246,0.25)", background: "rgba(100,181,246,0.08)", color: "#90caf9", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Download size={13} /> Exportar CSV</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "10px 16px" }}>
          <span style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Receita OL</span>
          {editandoReceita ? (
            <>
              <input autoFocus value={inputReceita} onChange={e => setInputReceita(e.target.value)} onKeyDown={e => e.key === "Enter" && salvarReceita()} placeholder="0,00" style={{ background: "transparent", border: "none", borderBottom: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, width: 100, outline: "none", textAlign: "right" }} />
              <button onClick={salvarReceita} style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", display: "flex" }}><Check size={16} /></button>
              <button onClick={() => setEditandoReceita(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex" }}><X size={14} /></button>
            </>
          ) : (
            <>
              <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, color: "#4ade80", letterSpacing: 1 }}>R$ {receitaSemana.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              <button onClick={() => { setInputReceita(String(receitaSemana)); setEditandoReceita(true) }} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "#4ade80")} onMouseLeave={e => (e.currentTarget.style.color = "#555")}><Edit2 size={14} /></button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Receita", value: receitaSemana, color: "#4ade80", icon: <TrendingUp size={18} color="#4ade80" /> },
          { label: "Despesas pagas", value: totalPago, color: "#f87171", icon: <TrendingDown size={18} color="#f87171" /> },
          { label: "Pendente", value: totalPendente, color: "#fbbf24", icon: <AlertCircle size={18} color="#fbbf24" /> },
          { label: "Lucro líquido", value: lucroLiquido, color: lucroLiquido >= 0 ? "#4ade80" : "#f87171", icon: <Wallet size={18} color={lucroLiquido >= 0 ? "#4ade80" : "#f87171"} /> },
          { label: "Maior despesa", value: maiorDespesa?.valor || 0, color: "#a78bfa", sub: maiorDespesa?.nome, icon: <DollarSign size={18} color="#a78bfa" /> },
        ].map((k, i) => (
          <div key={i} style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.color }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1.5 }}>{k.label}</span>{k.icon}
            </div>
            <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 26, color: k.color, letterSpacing: 1 }}>R$ {k.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            {k.sub && <div style={{ fontSize: 11, color: "#555", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 20 }}>Comparativo Semanal</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosComparativo} barSize={18} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="semana" tick={{ fill: "#444", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Sans", color: "#666" }} />
              <Bar dataKey="receita" name="Receita" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 20 }}>Evolução do Lucro</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosComparativo}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="semana" tick={{ fill: "#444", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#FFD84D" strokeWidth={2} dot={{ fill: "#FFD84D", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {dadosCategoria.length > 0 && (
        <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, marginBottom: 28 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 20 }}>Despesas por Categoria</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dadosCategoria} layout="vertical" barSize={16}>
              <XAxis type="number" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="cat" tick={{ fill: "#aaa", fontSize: 12, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12 }} formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Valor"]} />
              <Bar dataKey="val" fill="#a78bfa" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5 }}>Despesas {filtroSemanaTabela ? `— ${filtroSemanaTabela}` : `— ${semanaSel}`}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={13} color="#555" />
              <select value={filtroSemanaTabela} onChange={e => setFiltroSemanaTabela(e.target.value)} style={{ background: "#161616", border: `1px solid ${filtroSemanaTabela ? "rgba(255,216,77,0.4)" : "rgba(255,255,255,0.1)"}`, color: filtroSemanaTabela ? "#FFD84D" : "#666", padding: "6px 12px", borderRadius: 8, fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, outline: "none", cursor: "pointer" }}>
                <option value="">Semana selecionada</option>
                {semanas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {filtroSemanaTabela && <button onClick={() => setFiltroSemanaTabela("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", display: "flex", padding: 4 }}><X size={13} /></button>}
            </div>
            <span style={{ fontSize: 12, color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "4px 10px", borderRadius: 20 }}>{despExibidas.length} item{despExibidas.length !== 1 ? "s" : ""}</span>
            <button onClick={() => abrirForm()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #7b1fa2, #9c27b0)", color: "#fff", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")} onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}><Plus size={14} /> Adicionar despesa</button>
          </div>
        </div>

        {formAberto && (
          <div style={{ padding: "20px 24px", background: "rgba(156,39,176,0.04)", borderBottom: "1px solid rgba(156,39,176,0.15)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr 160px auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Nome da despesa</div>
                <input autoFocus value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Aluguel galpão" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 14, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Valor (R$)</div>
                <input value={formValor} onChange={e => setFormValor(e.target.value)} placeholder="0,00" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 14, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Categoria</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {mostrarNovaCategoria ? (
                    <div style={{ display: "flex", gap: 6, flex: 1 }}>
                      <input autoFocus value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionarCategoria()} placeholder="Nova categoria" style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,216,77,0.3)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 14, outline: "none" }} />
                      <button onClick={adicionarCategoria} style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "rgba(255,216,77,0.15)", color: "#FFD84D", cursor: "pointer" }}><Check size={14} /></button>
                      <button onClick={() => setMostrarNovaCategoria(false)} style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.05)", color: "#666", cursor: "pointer" }}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <select value={formCategoria} onChange={e => setFormCategoria(e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 14, outline: "none", cursor: "pointer" }}>
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => setMostrarNovaCategoria(true)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,216,77,0.25)", background: "rgba(255,216,77,0.08)", color: "#FFD84D", cursor: "pointer", display: "flex", alignItems: "center" }}><Plus size={14} /></button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Status</div>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as StatusDespesa)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 14, outline: "none", cursor: "pointer" }}>
                  <option value="PENDENTE">Pendente</option><option value="PAGO">Pago</option><option value="CANCELADO">Cancelado</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={confirmarForm} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #7b1fa2, #9c27b0)", color: "#fff", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{editandoId ? "Salvar" : "Adicionar"}</button>
                <button onClick={() => setFormAberto(false)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#666", cursor: "pointer" }}><X size={14} /></button>
              </div>
            </div>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Nome", "Categoria", "Valor", "Status", "Semana", "Ações"].map(h => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {despExibidas.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "#333", fontSize: 14 }}>Nenhuma despesa registrada para esta semana</td></tr>
              ) : despExibidas.map(d => {
                const sc = statusConfig[d.status]
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: d.status === "CANCELADO" ? 0.4 : 1 }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "14px 20px", fontSize: 14, color: "#e8e8f0", fontWeight: 500 }}>{d.nome}</td>
                    <td style={{ padding: "14px 20px" }}><span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>{d.categoria}</span></td>
                    <td style={{ padding: "14px 20px", fontFamily: "Syne, sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>R$ {d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <select value={d.status} onChange={e => alterarStatus(d.id, e.target.value as StatusDespesa)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                        <option value="PAGO">✓ Pago</option><option value="PENDENTE">⏳ Pendente</option><option value="CANCELADO">✗ Cancelado</option>
                      </select>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: "#666" }}>{d.semana}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => abrirForm(d)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(156,39,176,0.4)"; e.currentTarget.style.color = "#ce93d8" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#aaa" }}><Edit2 size={13} /></button>
                        <button onClick={() => excluir(d.id)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,83,80,0.4)"; e.currentTarget.style.color = "#ef5350" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#aaa" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {despExibidas.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                  <td colSpan={2} style={{ padding: "12px 20px", fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Total</td>
                  <td style={{ padding: "12px 20px", fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 700, color: "#f87171" }}>R$ {totalExibido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td colSpan={3} style={{ padding: "12px 20px", fontSize: 13, color: lucroExibido >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                    Lucro: R$ {lucroExibido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {filtroSemanaTabela && <span style={{ marginLeft: 12, fontSize: 11, color: "#FFD84D", fontWeight: 400 }}>filtro: {filtroSemanaTabela}</span>}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modalNovaSemana && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setModalNovaSemana(false)}>
          <div style={{ background: "#13131a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 32, width: 380, display: "flex", flexDirection: "column", gap: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>Nova Semana</div>
            <div>
              <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Nome da semana</div>
              <input autoFocus value={novaSemanaInput} onChange={e => setNovaSemanaInput(e.target.value)} onKeyDown={e => e.key === "Enter" && criarSemana()} placeholder="Ex: 10/03 - 16/03" style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "#fff", fontFamily: "DM Sans", fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModalNovaSemana(false)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#888", fontFamily: "DM Sans", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={criarSemana} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #7b1fa2, #9c27b0)", color: "#fff", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PAINEL PRINCIPAL ─────────────────────────────────────────────────────────
export default function Painel() {
  const [aba, setAba] = useState<Aba>("notas")
  const [dados, setDados] = useState<any[]>([])
  const [filtroSemana, setFiltroSemana] = useState<any>([null, null])
  const [filtroDia, setFiltroDia] = useState<any>(null)
  const [filtroNome, setFiltroNome] = useState("")
  const [filtroTelefone, setFiltroTelefone] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("")
  const [filtroValidacao, setFiltroValidacao] = useState("")
  const [aplicarFiltro, setAplicarFiltro] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [avisoFechado, setAvisoFechado] = useState(false)
  const [msgSalvar, setMsgSalvar] = useState("")
  const [modalSalvar, setModalSalvar] = useState(false)
  const [periodoSalvar, setPeriodoSalvar] = useState<any>([null, null])
  const [semanas, setSemanas] = useState<string[]>([])
  const [semanaSelecionada, setSemanaSelecionada] = useState("")
  const [dadosHistorico, setDadosHistorico] = useState<any[]>([])
  const [modoHistorico, setModoHistorico] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/notas").then(res => res.json()).then((data) => { setDados(Array.isArray(data) ? data : []) }).catch(() => setDados([]))
  }, [])

  useEffect(() => {
    fetch("/api/historico").then(res => res.json()).then(data => { if (data.semanas) setSemanas(data.semanas) }).catch(() => {})
  }, [])

  async function sincronizar() {
    setSincronizando(true); setMsgSalvar("")
    try {
      const resNotas = await fetch(`/api/notas?t=${Date.now()}`, { method: "GET", cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" } })
      if (!resNotas.ok) throw new Error("Erro ao buscar notas")
      const json = await resNotas.json()
      setDados(Array.isArray(json) ? json : [])
      setMsgSalvar("✓ Sincronização concluída com sucesso!")
    } catch (e: any) { setMsgSalvar(`✗ Erro: ${e.message}`) }
    finally { setSincronizando(false); setTimeout(() => setMsgSalvar(""), 5000) }
  }

  async function salvarSemana() {
    if (!periodoSalvar[0] || !periodoSalvar[1]) return
    setMsgSalvar(""); setModalSalvar(false)
    const inicio = periodoSalvar[0].toLocaleDateString("pt-BR").replace(/\//g, "-")
    const fim = periodoSalvar[1].toLocaleDateString("pt-BR").replace(/\//g, "-")
    try {
      const res = await fetch("/api/salvar-semana", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomeAba: `${inicio} a ${fim}` }) })
      const json = await res.json()
      if (json.sucesso) { setMsgSalvar(`✓ ${json.mensagem}`); setPeriodoSalvar([null, null]); const hist = await fetch("/api/historico").then(r => r.json()); if (hist.semanas) setSemanas(hist.semanas) }
      else setMsgSalvar(`✗ ${json.erro ?? "Erro ao salvar"}`)
    } catch { setMsgSalvar("✗ Erro ao conectar com o servidor") }
    finally { setTimeout(() => setMsgSalvar(""), 5000) }
  }

  async function verHistorico(semana: string) {
    if (!semana) { setModoHistorico(false); setDadosHistorico([]); setSemanaSelecionada(""); return }
    const res = await fetch(`/api/historico?aba=${encodeURIComponent(semana)}`)
    const json = await res.json()
    if (json.dados) { setDadosHistorico(json.dados); setSemanaSelecionada(semana); setModoHistorico(true) }
  }

  function exportarCSV() {
    const cabecalho = ["Nome", "Semana", "Valor", "Telefone", "Status", "NFS-e", "Validação"]
    const fonte = modoHistorico ? dadosHistorico : filtrados
    const linhas = fonte.map((item: any) => [item.nome, item.semana, item.valor, item.telefone || "", item.status, item.numeroNfse || "", item.statusValidacao || ""])
    const conteudo = [cabecalho, ...linhas].map(row => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `entregadores_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const safeDados = Array.isArray(dados) ? dados : []
  const fonteCards = modoHistorico ? dadosHistorico : safeDados
  const totalEntregadores = fonteCards.length
  const enviadas = fonteCards.filter(i => i.status === "ENVIADO").length
  const pendentes = fonteCards.filter(i => i.status === "PENDENTE").length
  const valorTotal = fonteCards.reduce((acc, i) => { const v = Number(String(i.valor).replace(",", ".")); return acc + (isNaN(v) ? 0 : v) }, 0)
  const dadosGrafico = [{ status: "Enviadas", quantidade: enviadas }, { status: "Pendentes", quantidade: pendentes }]
  const fonteDados = modoHistorico ? dadosHistorico : safeDados

  const filtrados = fonteDados.filter((item) => {
    if (!aplicarFiltro) return true
    if (!modoHistorico && filtroSemana[0] && filtroSemana[1]) { const inicio = new Date(filtroSemana[0]); const fim = new Date(filtroSemana[1]); const dataItem = new Date(item.semana); if (dataItem < inicio || dataItem > fim) return false }
    if (!modoHistorico && filtroDia) { const diaFiltro = new Date(filtroDia).toLocaleDateString("pt-BR"); const diaItem = new Date(item.semana).toLocaleDateString("pt-BR"); if (diaFiltro !== diaItem) return false }
    if (filtroValidacao && item.statusValidacao !== filtroValidacao) return false
    return (!filtroNome || item.nome?.toLowerCase().includes(filtroNome.toLowerCase())) && (!filtroTelefone || item.telefone?.includes(filtroTelefone)) && (!filtroStatus || item.status === filtroStatus)
  })

  function pesquisar() { setAplicarFiltro(true) }
  function limpar() { setFiltroSemana([null, null]); setFiltroDia(null); setFiltroNome(""); setFiltroTelefone(""); setFiltroStatus(""); setFiltroValidacao(""); setAplicarFiltro(false) }

  const validacaoBadge = (status: string, link: string) => {
    if (status === "VALIDADO") return { label: "Validado", bg: "rgba(46,125,50,0.15)", color: "#4caf50", border: "rgba(76,175,80,0.3)", icon: "✓" }
    if (status === "DIVERGENTE") return { label: "Divergente", bg: "rgba(230,81,0,0.15)", color: "#ff9800", border: "rgba(255,152,0,0.3)", icon: "⚠" }
    if (status === "NÃO É NOTA") return { label: "Não é nota", bg: "rgba(183,28,28,0.15)", color: "#ef5350", border: "rgba(239,83,80,0.3)", icon: "✗" }
    if (link) return { label: "Aguardando", bg: "rgba(255,255,255,0.05)", color: "#888", border: "rgba(255,255,255,0.1)", icon: "⏳" }
    return { label: "—", bg: "transparent", color: "#555", border: "transparent", icon: "" }
  }

  function whatsappLink(telefone: string, nome: string) {
    const num = telefone.replace(/\D/g, ""); const numFinal = num.startsWith("55") ? num : `55${num}`
    return `https://wa.me/${numFinal}?text=${encodeURIComponent(`Olá ${nome}! 👋 Identificamos que sua nota fiscal referente à semana ainda não foi enviada. Por favor, envie o quanto antes para regularizar seu pagamento. Obrigado!`)}`
  }
  function telegramLink(telefone: string) { const num = telefone.replace(/\D/g, ""); return `https://t.me/${num.startsWith("55") ? `+${num}` : `+55${num}`}` }
  function telegramMsg(nome: string) { return `Olá ${nome}! 👋 Identificamos que sua nota fiscal referente à semana ainda não foi enviada. Por favor, envie o quanto antes para regularizar seu pagamento. Obrigado!` }
  function abrirTelegram(telefone: string, nome: string) { navigator.clipboard.writeText(telegramMsg(nome)); window.open(telegramLink(telefone), "_blank") }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8f0; font-family: 'DM Sans', sans-serif; }
        .painel-root { min-height: 100vh; background: #0a0a0f; }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 22px 40px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,15,0.95); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 100; }
        .header-brand { display: flex; align-items: center; gap: 18px; }
        .header-logo { font-size: 40px; filter: drop-shadow(0 0 14px rgba(180,60,220,0.8)); animation: floatScorpion 3s ease-in-out infinite; }
        @keyframes floatScorpion { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .header-title { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #fff 40%, #ce93d8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .header-subtitle { font-size: 10px; color: #555; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .btn-h { display:flex; align-items:center; gap:7px; padding:8px 16px; border-radius:8px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .btn-sync { border:1px solid rgba(100,181,246,0.25); background:rgba(100,181,246,0.08); color:#90caf9; }
        .btn-sync:hover:not(:disabled) { background:rgba(100,181,246,0.15); transform:translateY(-1px); }
        .btn-sync:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-save { border:1px solid rgba(76,175,80,0.25); background:rgba(76,175,80,0.08); color:#66bb6a; }
        .btn-save:hover { background:rgba(76,175,80,0.15); transform:translateY(-1px); }
        .btn-exp { border:1px solid rgba(100,181,246,0.25); background:rgba(100,181,246,0.08); color:#90caf9; }
        .btn-exp:hover { background:rgba(100,181,246,0.15); transform:translateY(-1px); }
        .btn-comp { border:1px solid rgba(167,139,250,0.25); background:rgba(167,139,250,0.08); color:#a78bfa; }
        .btn-comp:hover { background:rgba(167,139,250,0.15); transform:translateY(-1px); }
        .btn-sair { border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:#aaa; }
        .btn-sair:hover { background:rgba(239,83,80,0.1); border-color:rgba(239,83,80,0.3); color:#ef5350; }
        @keyframes syncRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .sincronizando svg { animation: syncRotate 1s linear infinite; }
        .msg-ok { font-size:12px; padding:6px 12px; border-radius:6px; background:rgba(76,175,80,0.08); border:1px solid rgba(76,175,80,0.2); color:#66bb6a; }
        .msg-err { font-size:12px; padding:6px 12px; border-radius:6px; background:rgba(239,83,80,0.08); border:1px solid rgba(239,83,80,0.2); color:#ef5350; }
        .tabs-bar { display:flex; align-items:center; gap:2px; padding:0 40px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(10,10,15,0.8); }
        .tab-btn { display:flex; align-items:center; gap:8px; padding:14px 20px; border:none; background:transparent; color:#555; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; border-bottom:2px solid transparent; transition:all 0.2s; margin-bottom:-1px; }
        .tab-btn:hover { color:#aaa; }
        .tab-btn.ativa { color:#fff; border-bottom-color:#9c27b0; }
        .tab-btn.ativa-gold { color:#FFD84D; border-bottom-color:#FFD84D; }
        .tab-btn.ativa-green { color:#4ade80; border-bottom-color:#4ade80; }
        .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:28px; }
        .stat-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:22px 24px; display:flex; align-items:center; gap:16px; cursor:pointer; transition:all 0.2s; position:relative; overflow:hidden; }
        .stat-card:hover { transform:translateY(-2px); }
        .stat-icon-wrap { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stat-label { font-size:11px; color:#666; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
        .stat-value { font-family:'Syne',sans-serif; font-size:24px; font-weight:700; color:#fff; line-height:1; }
        .bottom-section { display:grid; grid-template-columns:280px 1fr; gap:20px; margin-bottom:28px; }
        .chart-card, .filters-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:24px; }
        .section-title { font-family:'Syne',sans-serif; font-size:13px; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:18px; display:flex; align-items:center; gap:8px; }
        .filters-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; align-items:end; }
        .filter-field { display:flex; flex-direction:column; gap:6px; }
        .filter-label { font-size:11px; color:#555; text-transform:uppercase; letter-spacing:1px; }
        .filter-input,.filter-select { padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#e0e0e0; font-family:'DM Sans',sans-serif; font-size:13px; outline:none; transition:border-color 0.2s; width:100%; }
        .filter-input:focus,.filter-select:focus { border-color:rgba(156,39,176,0.5); }
        .filter-select option { background:#1a1a2e; }
        .datepicker-wrap .react-datepicker-wrapper { width:100%; }
        .datepicker-wrap input { padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#e0e0e0; font-family:'DM Sans',sans-serif; font-size:13px; outline:none; width:100%; transition:border-color 0.2s; }
        .datepicker-wrap input:focus { border-color:rgba(156,39,176,0.5); }
        .filters-actions { display:flex; gap:10px; align-items:flex-end; }
        .btn-primary { display:flex; align-items:center; gap:7px; padding:9px 18px; border-radius:8px; border:none; background:linear-gradient(135deg,#7b1fa2,#9c27b0); color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .btn-primary:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(156,39,176,0.35); }
        .btn-secondary { display:flex; align-items:center; gap:7px; padding:9px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#888; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .btn-secondary:hover { background:rgba(255,255,255,0.08); color:#ccc; }
        .table-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:14px; overflow:hidden; }
        .table-header-bar { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .table-count { font-size:12px; color:#555; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); padding:4px 10px; border-radius:20px; }
        .table-wrap { overflow-x:auto; }
        table { width:100%; border-collapse:collapse; }
        thead tr { border-bottom:1px solid rgba(255,255,255,0.06); }
        th { padding:12px 16px; text-align:left; font-family:'DM Sans',sans-serif; font-size:11px; font-weight:500; color:#555; text-transform:uppercase; letter-spacing:1px; white-space:nowrap; }
        tbody tr { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s; }
        tbody tr:hover { background:rgba(255,255,255,0.03); }
        tbody tr:last-child { border-bottom:none; }
        td { padding:13px 16px; font-size:13px; color:#ccc; white-space:nowrap; }
        .td-nome { font-weight:500; color:#e8e8f0; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .td-valor { font-family:'Syne',sans-serif; font-weight:600; color:#e8e8f0; }
        .status-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:0.5px; }
        .status-enviado { background:rgba(46,125,50,0.12); color:#66bb6a; border:1px solid rgba(102,187,106,0.2); }
        .status-pendente { background:rgba(183,28,28,0.12); color:#ef9a9a; border:1px solid rgba(239,154,154,0.2); }
        .link-nota { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:6px; border:1px solid rgba(156,39,176,0.25); background:rgba(156,39,176,0.08); color:#ce93d8; text-decoration:none; font-size:12px; font-weight:500; transition:all 0.2s; }
        .link-nota:hover { background:rgba(156,39,176,0.18); }
        .btn-whatsapp { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:6px; border:1px solid rgba(37,211,102,0.25); background:rgba(37,211,102,0.08); color:#25d366; text-decoration:none; font-size:12px; font-weight:600; transition:all 0.2s; }
        .btn-whatsapp:hover { background:rgba(37,211,102,0.18); transform:translateY(-1px); }
        .btn-telegram { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:6px; background:rgba(41,182,246,0.08); color:#29b6f6; text-decoration:none; font-size:12px; font-weight:600; transition:all 0.2s; cursor:pointer; font-family:'DM Sans',sans-serif; border:1px solid rgba(41,182,246,0.25); }
        .btn-telegram:hover { background:rgba(41,182,246,0.18); transform:translateY(-1px); }
        .acoes-cell { display:flex; flex-direction:column; gap:5px; }
        .sem-telefone { font-size:11px; color:#444; font-style:italic; }
        .nfse-num { font-family:'Syne',sans-serif; font-size:13px; font-weight:700; color:#fff; }
        .validacao-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; }
        .modal-box { background:#13131a; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:32px; width:380px; display:flex; flex-direction:column; gap:20px; }
        .modal-title { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; color:#fff; }
        .modal-label { font-size:11px; color:#555; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
        .modal-actions { display:flex; gap:10px; justify-content:flex-end; }
        .custom-tooltip { background:#1a1a2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 14px; font-family:'DM Sans',sans-serif; font-size:13px; color:#e0e0e0; }
        .banner-aviso { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 20px; border-radius:10px; background:rgba(255,152,0,0.08); border:1px solid rgba(255,152,0,0.25); color:#ffb74d; font-size:13px; font-weight:500; margin-bottom:20px; }
      `}</style>

      <div className="painel-root">
        <header className="header">
          <div className="header-brand">
            <div className="header-logo">🦂</div>
            <div>
              <div className="header-title">Scorpions Delivery</div>
              <div className="header-subtitle">Painel Financeiro</div>
            </div>
          </div>
          <div className="header-actions">
            {msgSalvar && <span className={msgSalvar.startsWith("✗") ? "msg-err" : "msg-ok"}>{msgSalvar}</span>}
            {aba === "notas" && <>
              <button className={`btn-h btn-sync ${sincronizando ? "sincronizando" : ""}`} onClick={sincronizar} disabled={sincronizando}>
                <RefreshCw size={14} />{sincronizando ? "Sincronizando..." : "Sincronizar"}
              </button>
              <button className="btn-h btn-save" onClick={() => setModalSalvar(true)}><Save size={14} />Salvar Semana</button>
              <button className="btn-h btn-comp" onClick={() => router.push("/comparativo")}><BarChart2 size={14} />Comparativo</button>
              <button className="btn-h btn-exp" onClick={exportarCSV}><Download size={14} />Exportar CSV</button>
            </>}
            <button className="btn-h btn-sair" onClick={() => router.push("/login")}><LogOut size={14} />Sair</button>
          </div>
        </header>

        {/* ── TABS */}
        <div className="tabs-bar">
          <button className={`tab-btn ${aba === "notas" ? "ativa" : ""}`} onClick={() => setAba("notas")}>
            <Users size={15} /> Notas Fiscais
          </button>
          <button className={`tab-btn ${aba === "despesas" ? "ativa-gold" : ""}`} onClick={() => setAba("despesas")}>
            <Receipt size={15} /> Despesas & Financeiro
          </button>
          <button className={`tab-btn ${aba === "performance" ? "ativa-green" : ""}`} onClick={() => setAba("performance")}>
            <BarChart2 size={15} /> Performance
          </button>
        </div>

        {/* ── ABA NOTAS */}
        {aba === "notas" && (
          <main style={{ padding: "36px 40px", maxWidth: 1600, margin: "0 auto" }}>
            {!avisoFechado && (
              <div className="banner-aviso">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>⚠️ <span>Lembre-se de clicar em <strong>Salvar Semana</strong> antes de apagar os dados!</span></div>
                <button onClick={() => setAvisoFechado(true)} style={{ background: "none", border: "none", color: "#ffb74d", cursor: "pointer", opacity: 0.6 }}><X size={16} /></button>
              </div>
            )}

            <div className="stats-grid">
              {[
                { label: "Entregadores", value: totalEntregadores, icon: <Users size={20} color="#ce93d8" />, bg: "rgba(156,39,176,0.15)", accent: "rgba(156,39,176,0.3)", onClick: limpar },
                { label: "Enviadas", value: enviadas, icon: <CheckCircle size={20} color="#66bb6a" />, bg: "rgba(76,175,80,0.15)", accent: "rgba(76,175,80,0.3)", onClick: () => { setFiltroStatus("ENVIADO"); setAplicarFiltro(true) } },
                { label: "Pendentes", value: pendentes, icon: <AlertCircle size={20} color="#ef9a9a" />, bg: "rgba(239,83,80,0.15)", accent: "rgba(239,83,80,0.3)", onClick: () => { setFiltroStatus("PENDENTE"); setAplicarFiltro(true) } },
                { label: "Valor Total", value: `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: <DollarSign size={20} color="#90caf9" />, bg: "rgba(100,181,246,0.15)", accent: "rgba(100,181,246,0.3)", onClick: () => {} },
              ].map((s, i) => (
                <div key={i} className="stat-card" onClick={s.onClick}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = s.accent)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>
                  <div className="stat-icon-wrap" style={{ background: s.bg }}>{s.icon}</div>
                  <div><div className="stat-label">{s.label}</div><div className="stat-value" style={{ fontSize: i === 3 ? "16px" : undefined }}>{s.value}</div></div>
                </div>
              ))}
            </div>

            <div className="bottom-section">
              <div className="chart-card">
                <div className="section-title">Status</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dadosGrafico} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="status" tick={{ fill: "#555", fontSize: 12, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="custom-tooltip">{payload[0].name}: <strong>{payload[0].value}</strong></div> : null} />
                    <Bar dataKey="quantidade" fill="#7b1fa2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="filters-card">
                <div className="section-title"><Search size={14} color="#666" />Filtros</div>
                <div className="filters-grid">
                  {!modoHistorico && (
                    <>
                      <div className="filter-field">
                        <div className="filter-label">Período</div>
                        <div className="datepicker-wrap">
                          <DatePicker selectsRange startDate={filtroSemana[0]} endDate={filtroSemana[1]} onChange={(u) => { setFiltroSemana(u); setFiltroDia(null) }} dateFormat="dd/MM/yyyy" placeholderText="Início → Fim" calendarStartDay={1} />
                        </div>
                      </div>
                      <div className="filter-field">
                        <div className="filter-label">Dia específico</div>
                        <div className="datepicker-wrap">
                          <DatePicker selected={filtroDia} onChange={(d: any) => { setFiltroDia(d); setFiltroSemana([null, null]) }} dateFormat="dd/MM/yyyy" placeholderText="Selecione um dia" calendarStartDay={1} isClearable />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="filter-field"><div className="filter-label">Nome</div><input className="filter-input" placeholder="Buscar por nome" value={filtroNome} onChange={e => setFiltroNome(e.target.value)} /></div>
                  <div className="filter-field"><div className="filter-label">Telefone</div><input className="filter-input" placeholder="Buscar por telefone" value={filtroTelefone} onChange={e => setFiltroTelefone(e.target.value)} /></div>
                  <div className="filter-field">
                    <div className="filter-label">Status</div>
                    <select className="filter-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                      <option value="">Todos</option><option value="ENVIADO">Enviadas</option><option value="PENDENTE">Pendentes</option>
                    </select>
                  </div>
                  <div className="filter-field">
                    <div className="filter-label">Validação</div>
                    <select className="filter-select" value={filtroValidacao} onChange={e => setFiltroValidacao(e.target.value)}>
                      <option value="">Todas</option><option value="VALIDADO">Validado</option><option value="DIVERGENTE">Divergente</option><option value="NÃO É NOTA">Não é nota</option>
                    </select>
                  </div>
                  <div className="filter-field">
                    <div className="filter-label">Semana salva</div>
                    <select className="filter-select" value={semanaSelecionada} onChange={e => verHistorico(e.target.value)}>
                      <option value="">Semana atual</option>
                      {semanas.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="filter-field">
                    <div className="filter-label">&nbsp;</div>
                    <div className="filters-actions">
                      <button className="btn-primary" onClick={pesquisar}><Search size={13} />Filtrar</button>
                      <button className="btn-secondary" onClick={limpar}><X size={13} />Limpar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="table-card">
              <div className="table-header-bar">
                <div className="section-title" style={{ margin: 0 }}>Registros</div>
                <div className="table-count">{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Nome</th><th>Semana</th><th>Valor</th><th>Telefone</th><th>Status</th><th>Nota</th><th>NFS-e</th><th>Validação</th><th>Ação</th></tr>
                  </thead>
                  <tbody>
                    {filtrados.map((item, i) => {
                      const badge = validacaoBadge(item.statusValidacao, item.link)
                      const isPendente = item.status === "PENDENTE"
                      return (
                        <tr key={i}>
                          <td className="td-nome" title={item.nome}>{item.nome}</td>
                          <td>{item.semana}</td>
                          <td className="td-valor">R$ {item.valor}</td>
                          <td>{item.telefone || <span style={{ color: "#444" }}>—</span>}</td>
                          <td><span className={`status-pill ${item.status === "ENVIADO" ? "status-enviado" : "status-pendente"}`}>{item.status === "ENVIADO" ? "●" : "○"} {item.status}</span></td>
                          <td>{item.link ? <a href={item.link} target="_blank" className="link-nota">↗ Abrir</a> : <span style={{ color: "#444" }}>—</span>}</td>
                          <td>{item.numeroNfse && item.statusValidacao !== "NÃO É NOTA" ? <span className="nfse-num">#{item.numeroNfse}</span> : item.link ? <span style={{ color: "#444" }}>⏳</span> : <span style={{ color: "#444" }}>—</span>}</td>
                          <td>{badge.label !== "—" ? <span className="validacao-badge" style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>{badge.icon} {badge.label}</span> : <span style={{ color: "#444" }}>—</span>}</td>
                          <td>
                            {isPendente && item.telefone ? (
                              <div className="acoes-cell">
                                <a href={whatsappLink(item.telefone, item.nome)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">💬 WhatsApp</a>
                                <button onClick={() => abrirTelegram(item.telefone, item.nome)} className="btn-telegram">✈️ Telegram</button>
                              </div>
                            ) : isPendente ? <span className="sem-telefone">sem telefone</span> : <span style={{ color: "#444" }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* ── ABA DESPESAS */}
        {aba === "despesas" && <AbaDespesas />}

        {/* ── ABA PERFORMANCE */}
        {aba === "performance" && <AbaPerformance />}
      </div>

      {modalSalvar && (
        <div className="modal-overlay" onClick={() => setModalSalvar(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💾 Salvar Semana</div>
            <div>
              <div className="modal-label">Selecione o período</div>
              <div className="datepicker-wrap">
                <DatePicker selectsRange startDate={periodoSalvar[0]} endDate={periodoSalvar[1]} onChange={u => setPeriodoSalvar(u)} dateFormat="dd/MM/yyyy" placeholderText="Início → Fim" calendarStartDay={1} inline />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setModalSalvar(false); setPeriodoSalvar([null, null]) }}><X size={13} />Cancelar</button>
              <button className="btn-save btn-h" onClick={salvarSemana} disabled={!periodoSalvar[0] || !periodoSalvar[1]}><Save size={13} />Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}