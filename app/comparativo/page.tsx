"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts"
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react"

export default function Comparativo() {
  const [dados, setDados] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch("/api/historico")
        const json = await res.json()
        if (!json.semanas || json.semanas.length === 0) { setCarregando(false); return }
        const semanasOrdenadas = [...json.semanas].reverse()
        const resultados = await Promise.all(
          semanasOrdenadas.map(async (aba: string) => {
            const r = await fetch(`/api/historico?aba=${encodeURIComponent(aba)}`)
            const d = await r.json()
            const registros = d.dados ?? []
            const total = registros.length
            const enviadas = registros.filter((x: any) => x.status === "ENVIADO").length
            const pendentes = registros.filter((x: any) => x.status === "PENDENTE").length
            const taxa = total > 0 ? Math.round((enviadas / total) * 100) : 0
            const valorTotal = registros.reduce((acc: number, x: any) => {
              const v = Number(String(x.valor).replace(",", "."))
              return acc + (isNaN(v) ? 0 : v)
            }, 0)
            const partes = aba.split(" a ")
            const labelCurto = partes[0] ? partes[0].slice(0, 5) : aba.slice(0, 10)
            return { semana: aba, label: labelCurto, total, enviadas, pendentes, taxa, valorTotal }
          })
        )
        setDados(resultados)
      } catch (e) { console.error(e) }
      finally { setCarregando(false) }
    }
    carregar()
  }, [])

  const ultima = dados[dados.length - 1]
  const penultima = dados[dados.length - 2]

  function delta(key: string) {
    if (!ultima || !penultima) return null
    const diff = ultima[key] - penultima[key]
    const pct = penultima[key] !== 0 ? Math.round((diff / penultima[key]) * 100) : null
    return { diff, pct }
  }

  function sinal(key: string, inverter = false) {
    const d = delta(key)
    if (!d || d.diff === 0) return "neutro"
    return (d.diff > 0) !== inverter ? "alta" : "baixa"
  }

  const radarDados = ultima ? [
    { metric: "Taxa", valor: ultima.taxa },
    { metric: "Enviadas", valor: Math.min((ultima.enviadas / Math.max(...dados.map((d: any) => d.enviadas), 1)) * 100, 100) },
    { metric: "Total", valor: Math.min((ultima.total / Math.max(...dados.map((d: any) => d.total), 1)) * 100, 100) },
    { metric: "Valor", valor: Math.min((ultima.valorTotal / Math.max(...dados.map((d: any) => d.valorTotal), 1)) * 100, 100) },
    { metric: "Entrega", valor: Math.max(100 - (ultima.pendentes / Math.max(ultima.total, 1)) * 100, 0) },
  ] : []

  const CustomTooltip = ({ active, payload, label, fmt }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: "rgba(8,8,18,0.97)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px", padding: "14px 18px",
        fontFamily: "'DM Sans', sans-serif", backdropFilter: "blur(20px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ color: "#555", fontSize: "11px", marginBottom: "8px", letterSpacing: "1px", textTransform: "uppercase" }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, fontWeight: 700, fontSize: "16px", fontFamily: "'Syne', sans-serif" }}>
            {fmt ? fmt(p.value) : p.value}
          </div>
        ))}
      </div>
    )
  }

  const graficos = [
    { key: "taxa", titulo: "Taxa de Envio", cor: "#c084fc", fmt: (v: number) => `${v}%`, inv: false },
    { key: "valorTotal", titulo: "Valor Total Pago", cor: "#38bdf8", fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, inv: false },
    { key: "enviadas", titulo: "Notas Enviadas", cor: "#4ade80", fmt: (v: number) => `${v} notas`, inv: false },
    { key: "pendentes", titulo: "Pendentes", cor: "#fb923c", fmt: (v: number) => `${v} riders`, inv: true },
  ]

  const heroItems = [
    { key: "taxa", label: "Taxa de Envio", fmt: (v: number) => `${v}%`, c: "#c084fc", inv: false },
    { key: "valorTotal", label: "Valor Total", fmt: (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, c: "#38bdf8", inv: false },
    { key: "enviadas", label: "Notas Enviadas", fmt: (v: number) => `${v} notas`, c: "#4ade80", inv: false },
    { key: "pendentes", label: "Pendentes", fmt: (v: number) => `${v} riders`, c: "#fb923c", inv: true },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #06060f; color: #e8e8f0; font-family: 'DM Sans', sans-serif; }

        .root {
          min-height: 100vh; background: #06060f;
          background-image:
            radial-gradient(ellipse 100% 50% at 50% -10%, rgba(139,92,246,0.1) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(56,189,248,0.05) 0%, transparent 60%);
        }

        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 48px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(6,6,15,0.75); backdrop-filter: blur(30px);
          position: sticky; top: 0; z-index: 100;
        }
        .header-left { display: flex; align-items: center; gap: 24px; }
        .btn-back {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 14px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          color: #666; font-family: 'DM Sans', sans-serif;
          font-size: 13px; cursor: pointer; transition: all 0.2s;
        }
        .btn-back:hover { color: #ccc; background: rgba(255,255,255,0.07); }
        .h-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #fff 20%, #c084fc 90%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .h-sub { font-size: 10px; color: #3a3a4a; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
        .h-badge { font-size: 12px; color: #444; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 5px 12px; border-radius: 20px; }

        .main { padding: 36px 48px; max-width: 1600px; margin: 0 auto; }

        .chips { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 28px; padding-bottom: 4px; }
        .chips::-webkit-scrollbar { height: 2px; }
        .chips::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .chip { flex-shrink: 0; font-size: 11px; color: #3a3a4a; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 5px 12px; border-radius: 20px; white-space: nowrap; }

        .hero { display: grid; grid-template-columns: 1fr 300px; gap: 20px; margin-bottom: 28px; }
        .hero-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .hero-card {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px; padding: 22px; position: relative; overflow: hidden;
          transition: all 0.25s; cursor: default;
        }
        .hero-card:hover { border-color: var(--hc); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
        .hc-label { font-size: 10px; color: #3a3a4a; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
        .hc-value { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 10px; }
        .hc-value.small { font-size: 18px; }

        .dbadge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid; }
        .d-alta { background: rgba(74,222,128,0.08); color: #4ade80; border-color: rgba(74,222,128,0.18); }
        .d-baixa { background: rgba(251,113,133,0.08); color: #fb7185; border-color: rgba(251,113,133,0.18); }
        .d-neutro { background: rgba(255,255,255,0.03); color: #444; border-color: rgba(255,255,255,0.06); }

        .radar-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; }
        .r-title { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; align-self: flex-start; }
        .r-sub { font-size: 11px; color: #333; margin-bottom: 8px; align-self: flex-start; }

        .sec-title { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; color: #2a2a3a; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
        .sec-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.04), transparent); }

        .graficos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .grafico-card {
          background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px; padding: 22px; position: relative; overflow: hidden; transition: border-color 0.2s;
        }
        .grafico-card::before { content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1px; background: var(--gl); filter: blur(1px); }
        .grafico-card:hover { border-color: rgba(255,255,255,0.08); }
        .gc-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
        .gc-name { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 2px; }
        .gc-val { font-size: 11px; color: #444; }

        .loading { display: flex; align-items: center; justify-content: center; min-height: 70vh; gap: 14px; color: #2a2a3a; font-size: 14px; }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(192,132,252,0.12); border-top-color: #c084fc; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; gap: 10px; color: #2a2a3a; text-align: center; }
        .empty-ico { font-size: 56px; opacity: 0.25; }
      `}</style>

      <div className="root">
        <header className="header">
          <div className="header-left">
            <button className="btn-back" onClick={() => router.push("/dashboard")}>
              <ArrowLeft size={13} /> Painel
            </button>
            <div>
              <div className="h-title">📊 Comparativo</div>
              <div className="h-sub">Evolução semanal</div>
            </div>
          </div>
          {dados.length > 0 && <div className="h-badge">{dados.length} semana{dados.length !== 1 ? "s" : ""}</div>}
        </header>

        <main className="main">
          {carregando ? (
            <div className="loading"><div className="spinner" /> Carregando histórico...</div>
          ) : dados.length === 0 ? (
            <div className="empty">
              <div className="empty-ico">📭</div>
              <div style={{ fontSize: 15, color: "#444" }}>Nenhuma semana salva ainda</div>
              <div style={{ fontSize: 12, color: "#2a2a3a", maxWidth: 300 }}>
                No painel, clique em <strong style={{ color: "#c084fc" }}>Salvar Semana</strong> ao final de cada semana.
              </div>
            </div>
          ) : (
            <>
              <div className="chips">
                {dados.map((d, i) => <span key={i} className="chip">{d.semana}</span>)}
              </div>

              {/* HERO */}
              <div className="hero">
                <div className="hero-cards">
                  {heroItems.map((item) => {
                    const s = sinal(item.key, item.inv)
                    const d = delta(item.key)
                    const val = ultima ? ultima[item.key] : 0
                    return (
                      <div key={item.key} className="hero-card" style={{ "--hc": `${item.c}44` } as any}>
                        <div className="hc-label">{item.label}</div>
                        <div className={`hc-value ${item.key === "valorTotal" ? "small" : ""}`}>
                          {item.fmt(val)}
                        </div>
                        <div className={`dbadge d-${s}`}>
                          {s === "alta" ? <TrendingUp size={10} /> : s === "baixa" ? <TrendingDown size={10} /> : <Minus size={10} />}
                          {d?.pct !== null && d?.pct !== undefined ? `${d.pct > 0 ? "+" : ""}${d.pct}% vs anterior` : "primeira semana"}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="radar-card">
                  <div className="r-title">Última Semana</div>
                  <div className="r-sub">Performance relativa</div>
                  <ResponsiveContainer width="100%" height={210}>
                    <RadarChart data={radarDados}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "#444", fontSize: 11, fontFamily: "DM Sans" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="valor" stroke="#c084fc" fill="#c084fc" fillOpacity={0.12} strokeWidth={2} dot={{ fill: "#c084fc", r: 3 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  {ultima && <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>{ultima.semana}</div>}
                </div>
              </div>

              {/* GRAFICOS */}
              <div className="sec-title">Linha do tempo</div>
              <div className="graficos-grid">
                {graficos.map((g, gi) => {
                  const s = sinal(g.key, g.inv)
                  const d = delta(g.key)
                  return (
                    <div key={g.key} className="grafico-card" style={{ "--gl": `linear-gradient(90deg, transparent, ${g.cor}55, transparent)` } as any}>
                      <div className="gc-top">
                        <div>
                          <div className="gc-name">{g.titulo}</div>
                          <div className="gc-val">{ultima ? g.fmt(ultima[g.key]) : "—"}</div>
                        </div>
                        <div className={`dbadge d-${s}`}>
                          {s === "alta" ? <TrendingUp size={10} /> : s === "baixa" ? <TrendingDown size={10} /> : <Minus size={10} />}
                          {d?.pct !== null && d?.pct !== undefined ? `${d.pct > 0 ? "+" : ""}${d.pct}%` : "—"}
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={150}>
                        <AreaChart data={dados} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`g${gi}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={g.cor} stopOpacity={0.25} />
                              <stop offset="100%" stopColor={g.cor} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#2a2a3a", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={{ fill: "#2a2a3a", fontSize: 10, fontFamily: "DM Sans" }}
                            axisLine={false} tickLine={false} width={36}
                            tickFormatter={(v) => g.key === "valorTotal" ? `${(v/1000).toFixed(0)}k` : g.key === "taxa" ? `${v}%` : `${v}`}
                          />
                          <Tooltip content={<CustomTooltip fmt={g.fmt} />} />
                          <Area type="monotone" dataKey={g.key} stroke={g.cor} strokeWidth={2} fill={`url(#g${gi})`}
                            dot={{ fill: g.cor, r: 3, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: g.cor, stroke: "rgba(255,255,255,0.15)", strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
