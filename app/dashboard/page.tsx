"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { Users, CheckCircle, AlertCircle, DollarSign, LogOut, Search, X, Download, Save, BarChart2, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { useRouter } from "next/navigation"

export default function Painel() {
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
    fetch("/api/notas")
      .then(res => res.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : []
        setDados(lista)
      })
      .catch(() => setDados([]))
  }, [])

  useEffect(() => {
    fetch("/api/historico")
      .then(res => res.json())
      .then(data => { if (data.semanas) setSemanas(data.semanas) })
      .catch(() => {})
  }, [])

  async function sincronizar() {
    setSincronizando(true)
    setMsgSalvar("")

    try {
      const timestamp = Date.now()
      const resNotas = await fetch(`/api/notas?t=${timestamp}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      })

      if (!resNotas.ok) throw new Error("Erro ao buscar notas")

      const listaAtualizada = await resNotas.json()
      const novasNotas = Array.isArray(listaAtualizada) ? listaAtualizada : []
      setDados(novasNotas)

      setMsgSalvar("✓ Sincronização concluída com sucesso!")
    } catch (e: any) {
      setMsgSalvar(`✗ Erro: ${e.message}`)
    } finally {
      setSincronizando(false)
      setTimeout(() => setMsgSalvar(""), 5000)
    }
  }

  async function salvarSemana() {
    if (!periodoSalvar[0] || !periodoSalvar[1]) return
    setMsgSalvar("")
    setModalSalvar(false)
    const inicio = periodoSalvar[0].toLocaleDateString("pt-BR").replace(/\//g, "-")
    const fim = periodoSalvar[1].toLocaleDateString("pt-BR").replace(/\//g, "-")
    const nomeAba = `${inicio} a ${fim}`
    try {
      const res = await fetch("/api/salvar-semana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeAba }),
      })
      const json = await res.json()
      if (json.sucesso) {
        setMsgSalvar(`✓ ${json.mensagem}`)
        setPeriodoSalvar([null, null])
        const hist = await fetch("/api/historico").then(r => r.json())
        if (hist.semanas) setSemanas(hist.semanas)
      } else {
        setMsgSalvar(`✗ ${json.erro ?? "Erro ao salvar"}`)
      }
    } catch {
      setMsgSalvar("✗ Erro ao conectar com o servidor")
    } finally {
      setTimeout(() => setMsgSalvar(""), 5000)
    }
  }

  async function verHistorico(aba: string) {
    if (!aba) {
      setModoHistorico(false)
      setDadosHistorico([])
      setSemanaSelecionada("")
      return
    }
    const res = await fetch(`/api/historico?aba=${encodeURIComponent(aba)}`)
    const json = await res.json()
    if (json.dados) {
      setDadosHistorico(json.dados)
      setSemanaSelecionada(aba)
      setModoHistorico(true)
    }
  }

  function exportarCSV() {
    const cabecalho = ["Nome", "Semana", "Valor", "Telefone", "Status", "NFS-e", "Validação"]
    const fonte = modoHistorico ? dadosHistorico : filtrados
    const linhas = fonte.map((item: any) => [
      item.nome,
      item.semana,
      item.valor,
      item.telefone || "",
      item.status,
      item.numeroNfse || "",
      item.statusValidacao || "",
    ])
    const conteudo = [cabecalho, ...linhas]
      .map(row => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `entregadores_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function sair() { router.push("/login") }

  const safeDados = Array.isArray(dados) ? dados : []
  const fonteCards = modoHistorico ? dadosHistorico : safeDados
  const totalEntregadores = fonteCards.length
  const enviadas = fonteCards.filter(i => i.status === "ENVIADO").length
  const pendentes = fonteCards.filter(i => i.status === "PENDENTE").length
  const valorTotal = fonteCards.reduce((acc, i) => {
    const v = Number(String(i.valor).replace(",", "."))
    return acc + (isNaN(v) ? 0 : v)
  }, 0)

  const dadosGrafico = [
    { status: "Enviadas", quantidade: enviadas },
    { status: "Pendentes", quantidade: pendentes }
  ]

  const fonteDados = modoHistorico ? dadosHistorico : safeDados

  const filtrados = fonteDados.filter((item) => {
    if (!aplicarFiltro) return true
    if (!modoHistorico && filtroSemana[0] && filtroSemana[1]) {
      const inicio = new Date(filtroSemana[0])
      const fim = new Date(filtroSemana[1])
      const dataItem = new Date(item.semana)
      if (dataItem < inicio || dataItem > fim) return false
    }
    if (!modoHistorico && filtroDia) {
      const diaFiltro = new Date(filtroDia).toLocaleDateString("pt-BR")
      const diaItem = new Date(item.semana).toLocaleDateString("pt-BR")
      if (diaFiltro !== diaItem) return false
    }
    if (filtroValidacao && item.statusValidacao !== filtroValidacao) return false
    return (
      (!filtroNome || item.nome?.toLowerCase().includes(filtroNome.toLowerCase())) &&
      (!filtroTelefone || item.telefone?.includes(filtroTelefone)) &&
      (!filtroStatus || item.status === filtroStatus)
    )
  })

  function pesquisar() { setAplicarFiltro(true) }
  function limpar() {
    setFiltroSemana([null, null])
    setFiltroDia(null)
    setFiltroNome("")
    setFiltroTelefone("")
    setFiltroStatus("")
    setFiltroValidacao("")
    setAplicarFiltro(false)
  }

  const validacaoBadge = (status: string, link: string) => {
    if (status === "VALIDADO") return { label: "Validado", bg: "rgba(46,125,50,0.15)", color: "#4caf50", border: "rgba(76,175,80,0.3)", icon: "✓" }
    if (status === "DIVERGENTE") return { label: "Divergente", bg: "rgba(230,81,0,0.15)", color: "#ff9800", border: "rgba(255,152,0,0.3)", icon: "⚠" }
    if (status === "NÃO É NOTA") return { label: "Não é nota", bg: "rgba(183,28,28,0.15)", color: "#ef5350", border: "rgba(239,83,80,0.3)", icon: "✗" }
    if (link) return { label: "Aguardando", bg: "rgba(255,255,255,0.05)", color: "#888", border: "rgba(255,255,255,0.1)", icon: "⏳" }
    return { label: "—", bg: "transparent", color: "#555", border: "transparent", icon: "" }
  }

  function whatsappLink(telefone: string, nome: string) {
    const num = telefone.replace(/\D/g, "")
    const numFinal = num.startsWith("55") ? num : `55${num}`
    const msg = encodeURIComponent(
      `Olá ${nome}! 👋 Identificamos que sua nota fiscal referente à semana ainda não foi enviada. Por favor, envie o quanto antes para regularizar seu pagamento. Obrigado!`
    )
    return `https://wa.me/${numFinal}?text=${msg}`
  }

  function telegramLink(telefone: string) {
    const num = telefone.replace(/\D/g, "")
    const numFinal = num.startsWith("55") ? `+${num}` : `+55${num}`
    return `https://t.me/${numFinal}`
  }

  function telegramMsg(nome: string) {
    return `Olá ${nome}! 👋 Identificamos que sua nota fiscal referente à semana ainda não foi enviada. Por favor, envie o quanto antes para regularizar seu pagamento. Obrigado!`
  }

  function abrirTelegram(telefone: string, nome: string) {
    navigator.clipboard.writeText(telegramMsg(nome))
    window.open(telegramLink(telefone), "_blank")
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8f0; font-family: 'DM Sans', sans-serif; }
        .painel-root { min-height: 100vh; background: #0a0a0f; padding: 0; }

        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 28px 40px; border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,15,0.85); backdrop-filter: blur(20px);
          position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 40px rgba(0,0,0,0.4);
        }
        .header-brand { display: flex; align-items: center; gap: 18px; }
        .header-logo { font-size: 48px; line-height: 1; filter: drop-shadow(0 0 18px rgba(180,60,220,0.8)); animation: floatScorpion 3s ease-in-out infinite; }
        @keyframes floatScorpion { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        .header-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; letter-spacing: -0.8px; color: #fff; background: linear-gradient(135deg, #fff 40%, #ce93d8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; }
        .header-subtitle { font-size: 11px; color: #666; letter-spacing: 3px; text-transform: uppercase; margin-top: 3px; }
        .header-actions { display: flex; align-items: center; gap: 10px; }

        .btn-salvar { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(76,175,80,0.25); background: rgba(76,175,80,0.08); color: #66bb6a; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-salvar:hover:not(:disabled) { background: rgba(76,175,80,0.15); border-color: rgba(76,175,80,0.4); transform: translateY(-1px); }
        .btn-salvar:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-sincronizar { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(100,181,246,0.25); background: rgba(100,181,246,0.08); color: #90caf9; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-sincronizar:hover:not(:disabled) { background: rgba(100,181,246,0.15); border-color: rgba(100,181,246,0.4); transform: translateY(-1px); }
        .btn-sincronizar:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes syncRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .btn-sincronizar.sincronizando svg { animation: syncRotate 1s linear infinite; }

        .msg-salvar { font-size: 12px; padding: 6px 12px; border-radius: 6px; background: rgba(76,175,80,0.08); border: 1px solid rgba(76,175,80,0.2); color: #66bb6a; }
        .msg-salvar.erro { background: rgba(239,83,80,0.08); border-color: rgba(239,83,80,0.2); color: #ef5350; }

        .btn-comparativo { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(167,139,250,0.25); background: rgba(167,139,250,0.08); color: #a78bfa; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-comparativo:hover { background: rgba(167,139,250,0.15); border-color: rgba(167,139,250,0.4); transform: translateY(-1px); }

        .btn-export { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(100,181,246,0.25); background: rgba(100,181,246,0.08); color: #90caf9; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-export:hover { background: rgba(100,181,246,0.15); border-color: rgba(100,181,246,0.4); transform: translateY(-1px); }

        .btn-sair { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #aaa; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-sair:hover { background: rgba(239,83,80,0.1); border-color: rgba(239,83,80,0.3); color: #ef5350; }

        .main { padding: 36px 40px; max-width: 1600px; margin: 0 auto; }

        .banner-aviso { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-radius: 10px; background: rgba(255,152,0,0.08); border: 1px solid rgba(255,152,0,0.25); color: #ffb74d; font-size: 13px; font-weight: 500; margin-bottom: 20px; }
        .banner-aviso-texto { display: flex; align-items: center; gap: 10px; }
        .btn-fechar-aviso { background: none; border: none; color: #ffb74d; cursor: pointer; padding: 2px; opacity: 0.6; transition: opacity 0.2s; flex-shrink: 0; }
        .btn-fechar-aviso:hover { opacity: 1; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 22px 24px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .stat-card::before { content: ''; position: absolute; inset: 0; background: var(--card-glow); opacity: 0; transition: opacity 0.2s; border-radius: inherit; }
        .stat-card:hover::before { opacity: 1; }
        .stat-card:hover { border-color: var(--card-accent); transform: translateY(-2px); }
        .stat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; background: var(--card-icon-bg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .stat-value { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700; color: #fff; line-height: 1; }

        .bottom-section { display: grid; grid-template-columns: 280px 1fr; gap: 20px; margin-bottom: 28px; }
        .chart-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 24px; }
        .chart-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px; }

        .filters-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 24px; }
        .filters-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; align-items: end; }
        .filter-field { display: flex; flex-direction: column; gap: 6px; }
        .filter-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
        .filter-input, .filter-select { padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s; width: 100%; }
        .filter-input:focus, .filter-select:focus { border-color: rgba(156,39,176,0.5); }
        .filter-select option { background: #1a1a2e; }
        .datepicker-wrap .react-datepicker-wrapper { width: 100%; }
        .datepicker-wrap input { padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; width: 100%; transition: border-color 0.2s; }
        .datepicker-wrap input:focus { border-color: rgba(156,39,176,0.5); }
        .filters-actions { display: flex; gap: 10px; align-items: flex-end; }

        .btn-primary { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 8px; border: none; background: linear-gradient(135deg, #7b1fa2, #9c27b0); color: #fff; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-primary:hover { background: linear-gradient(135deg, #8e24aa, #ab47bc); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(156,39,176,0.35); }
        .btn-secondary { display: flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #888; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-secondary:hover { background: rgba(255,255,255,0.08); color: #ccc; }

        .table-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
        .table-header-bar { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .table-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1.5px; }
        .table-count { font-size: 12px; color: #555; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); padding: 4px 10px; border-radius: 20px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { border-bottom: 1px solid rgba(255,255,255,0.06); }
        th { padding: 12px 16px; text-align: left; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500; color: #555; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
        tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        tbody tr:hover { background: rgba(255,255,255,0.03); }
        tbody tr:last-child { border-bottom: none; }
        td { padding: 13px 16px; font-size: 13px; color: #ccc; white-space: nowrap; }
        .td-nome { font-weight: 500; color: #e8e8f0; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .td-valor { font-family: 'Syne', sans-serif; font-weight: 600; color: #e8e8f0; }

        .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
        .status-enviado { background: rgba(46,125,50,0.12); color: #66bb6a; border: 1px solid rgba(102,187,106,0.2); }
        .status-pendente { background: rgba(183,28,28,0.12); color: #ef9a9a; border: 1px solid rgba(239,154,154,0.2); }

        .link-nota { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(156,39,176,0.25); background: rgba(156,39,176,0.08); color: #ce93d8; text-decoration: none; font-size: 12px; font-weight: 500; transition: all 0.2s; }
        .link-nota:hover { background: rgba(156,39,176,0.18); border-color: rgba(156,39,176,0.5); color: #e1bee7; }

        .btn-whatsapp { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(37,211,102,0.25); background: rgba(37,211,102,0.08); color: #25d366; text-decoration: none; font-size: 12px; font-weight: 600; transition: all 0.2s; }
        .btn-whatsapp:hover { background: rgba(37,211,102,0.18); border-color: rgba(37,211,102,0.45); transform: translateY(-1px); }

        .btn-telegram { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(41,182,246,0.25); background: rgba(41,182,246,0.08); color: #29b6f6; text-decoration: none; font-size: 12px; font-weight: 600; transition: all 0.2s; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-telegram:hover { background: rgba(41,182,246,0.18); border-color: rgba(41,182,246,0.45); transform: translateY(-1px); }

        .acoes-cell { display: flex; flex-direction: column; gap: 5px; }
        .sem-telefone { font-size: 11px; color: #444; font-style: italic; }
        .nfse-num { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; }
        .validacao-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-box { background: #13131a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; width: 380px; display: flex; flex-direction: column; gap: 20px; }
        .modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #fff; }
        .modal-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

        .custom-tooltip { background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #e0e0e0; }
      `}</style>

      <div className="painel-root">
        <header className="header">
          <div className="header-brand">
            <div className="header-logo">🦂</div>
            <div>
              <div className="header-title">Scorpions Delivery</div>
              <div className="header-subtitle">Painel de Notas Fiscais</div>
            </div>
          </div>
          <div className="header-actions">
            {msgSalvar && (
              <span className={`msg-salvar ${msgSalvar.startsWith("✗") ? "erro" : ""}`}>
                {msgSalvar}
              </span>
            )}
            <button
              className={`btn-sincronizar ${sincronizando ? "sincronizando" : ""}`}
              onClick={sincronizar}
              disabled={sincronizando}
              title="Sincronizar dados da planilha"
            >
              <RefreshCw size={14} />
              {sincronizando ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button className="btn-salvar" onClick={() => setModalSalvar(true)}>
              <Save size={14} />
              Salvar Semana
            </button>
            <button className="btn-comparativo" onClick={() => router.push("/comparativo")}>
              <BarChart2 size={14} />
              Comparativo
            </button>
            <button className="btn-export" onClick={exportarCSV}>
              <Download size={14} />
              Exportar CSV
            </button>
            <button className="btn-sair" onClick={sair}>
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </header>

        <main className="main">
          {!avisoFechado && (
            <div className="banner-aviso">
              <div className="banner-aviso-texto">
                ⚠️ <span>Lembre-se de clicar em <strong>Salvar Semana</strong> antes de apagar os dados das planilhas!</span>
              </div>
              <button className="btn-fechar-aviso" onClick={() => setAvisoFechado(true)}>
                <X size={16} />
              </button>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card" onClick={limpar}
              style={{ "--card-accent": "rgba(156,39,176,0.3)", "--card-glow": "linear-gradient(135deg, rgba(156,39,176,0.05), transparent)", "--card-icon-bg": "rgba(156,39,176,0.15)" } as any}>
              <div className="stat-icon-wrap"><Users size={20} color="#ce93d8" /></div>
              <div><div className="stat-label">Entregadores</div><div className="stat-value">{totalEntregadores}</div></div>
            </div>
            <div className="stat-card" onClick={() => { setFiltroStatus("ENVIADO"); setAplicarFiltro(true) }}
              style={{ "--card-accent": "rgba(76,175,80,0.3)", "--card-glow": "linear-gradient(135deg, rgba(76,175,80,0.05), transparent)", "--card-icon-bg": "rgba(76,175,80,0.15)" } as any}>
              <div className="stat-icon-wrap"><CheckCircle size={20} color="#66bb6a" /></div>
              <div><div className="stat-label">Enviadas</div><div className="stat-value">{enviadas}</div></div>
            </div>
            <div className="stat-card" onClick={() => { setFiltroStatus("PENDENTE"); setAplicarFiltro(true) }}
              style={{ "--card-accent": "rgba(239,83,80,0.3)", "--card-glow": "linear-gradient(135deg, rgba(239,83,80,0.05), transparent)", "--card-icon-bg": "rgba(239,83,80,0.15)" } as any}>
              <div className="stat-icon-wrap"><AlertCircle size={20} color="#ef9a9a" /></div>
              <div><div className="stat-label">Pendentes</div><div className="stat-value">{pendentes}</div></div>
            </div>
            <div className="stat-card"
              style={{ "--card-accent": "rgba(100,181,246,0.3)", "--card-glow": "linear-gradient(135deg, rgba(100,181,246,0.05), transparent)", "--card-icon-bg": "rgba(100,181,246,0.15)" } as any}>
              <div className="stat-icon-wrap"><DollarSign size={20} color="#90caf9" /></div>
              <div>
                <div className="stat-label">Valor Total</div>
                <div className="stat-value" style={{ fontSize: "18px" }}>R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="bottom-section">
            <div className="chart-card">
              <div className="chart-title">Status</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dadosGrafico} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="status" tick={{ fill: "#555", fontSize: 12, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#555", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="custom-tooltip">{payload[0].name}: <strong>{payload[0].value}</strong></div>
                  ) : null} />
                  <Bar dataKey="quantidade" fill="#7b1fa2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="filters-card">
              <div className="filters-title"><Search size={14} color="#666" />Filtros</div>
              <div className="filters-grid">
                {!modoHistorico && (
                  <>
                    <div className="filter-field">
                      <div className="filter-label">Período</div>
                      <div className="datepicker-wrap">
                        <DatePicker selectsRange startDate={filtroSemana[0]} endDate={filtroSemana[1]}
                          onChange={(update) => { setFiltroSemana(update); setFiltroDia(null) }}
                          dateFormat="dd/MM/yyyy" placeholderText="Data início → Data fim" calendarStartDay={1} />
                      </div>
                    </div>
                    <div className="filter-field">
                      <div className="filter-label">Dia específico</div>
                      <div className="datepicker-wrap">
                        <DatePicker selected={filtroDia}
                          onChange={(date: any) => { setFiltroDia(date); setFiltroSemana([null, null]) }}
                          dateFormat="dd/MM/yyyy" placeholderText="Selecione um dia" calendarStartDay={1} isClearable />
                      </div>
                    </div>
                  </>
                )}
                <div className="filter-field">
                  <div className="filter-label">Nome</div>
                  <input className="filter-input" placeholder="Buscar por nome" value={filtroNome} onChange={e => setFiltroNome(e.target.value)} />
                </div>
                <div className="filter-field">
                  <div className="filter-label">Telefone</div>
                  <input className="filter-input" placeholder="Buscar por telefone" value={filtroTelefone} onChange={e => setFiltroTelefone(e.target.value)} />
                </div>
                <div className="filter-field">
                  <div className="filter-label">Status</div>
                  <select className="filter-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="ENVIADO">Enviadas</option>
                    <option value="PENDENTE">Pendentes</option>
                  </select>
                </div>
                <div className="filter-field">
                  <div className="filter-label">Validação</div>
                  <select className="filter-select" value={filtroValidacao} onChange={e => setFiltroValidacao(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="VALIDADO">Validado</option>
                    <option value="DIVERGENTE">Divergente</option>
                    <option value="NÃO É NOTA">Não é nota</option>
                  </select>
                </div>
                <div className="filter-field">
                  <div className="filter-label">Semana salva</div>
                  <select className="filter-select" value={semanaSelecionada} onChange={(e) => verHistorico(e.target.value)}>
                    <option value="">Semana atual</option>
                    {semanas.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
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
              <div className="table-title">Registros</div>
              <div className="table-count">{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th><th>Semana</th><th>Valor</th><th>Telefone</th>
                    <th>Status</th><th>Nota</th><th>NFS-e</th><th>Validação</th><th>Ação</th>
                  </tr>
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
                        <td>
                          <span className={`status-pill ${item.status === "ENVIADO" ? "status-enviado" : "status-pendente"}`}>
                            {item.status === "ENVIADO" ? "●" : "○"} {item.status}
                          </span>
                        </td>
                        <td>
                          {item.link
                            ? <a href={item.link} target="_blank" className="link-nota">↗ Abrir</a>
                            : <span style={{ color: "#444" }}>—</span>}
                        </td>
                        <td>
                          {item.numeroNfse && item.statusValidacao !== "NÃO É NOTA"
                            ? <span className="nfse-num">#{item.numeroNfse}</span>
                            : item.link ? <span style={{ color: "#444" }}>⏳</span> : <span style={{ color: "#444" }}>—</span>}
                        </td>
                        <td>
                          {badge.label !== "—" ? (
                            <span className="validacao-badge" style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>
                              {badge.icon} {badge.label}
                            </span>
                          ) : <span style={{ color: "#444" }}>—</span>}
                        </td>
                        <td>
                          {isPendente && item.telefone ? (
                            <div className="acoes-cell">
                              <a href={whatsappLink(item.telefone, item.nome)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                                💬 WhatsApp
                              </a>
                              <button onClick={() => abrirTelegram(item.telefone, item.nome)} className="btn-telegram">
                                ✈️ Telegram
                              </button>
                            </div>
                          ) : isPendente && !item.telefone ? (
                            <span className="sem-telefone">sem telefone</span>
                          ) : (
                            <span style={{ color: "#444" }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {modalSalvar && (
        <div className="modal-overlay" onClick={() => setModalSalvar(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💾 Salvar Semana</div>
            <div>
              <div className="modal-label">Selecione o período da semana</div>
              <div className="datepicker-wrap">
                <DatePicker selectsRange startDate={periodoSalvar[0]} endDate={periodoSalvar[1]}
                  onChange={(update) => setPeriodoSalvar(update)}
                  dateFormat="dd/MM/yyyy" placeholderText="Ex: 23/02/2026 a 01/03/2026"
                  calendarStartDay={1} inline />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setModalSalvar(false); setPeriodoSalvar([null, null]) }}>
                <X size={13} /> Cancelar
              </button>
              <button className="btn-salvar" onClick={salvarSemana} disabled={!periodoSalvar[0] || !periodoSalvar[1]}>
                <Save size={13} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
