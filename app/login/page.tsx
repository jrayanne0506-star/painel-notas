"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Login() {
  const [usuario, setUsuario] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const usuariosValidos = [
    { usuario: "admin", senha: "135791" },
    { usuario: "teste", senha: "teste" }
  ]

  function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro("")
    setTimeout(() => {
      const valido = usuariosValidos.find(u => u.usuario === usuario && u.senha === senha)
      if (valido) {
        router.push("/dashboard")
      } else {
        setErro("Usuário ou senha incorretos")
        setLoading(false)
      }
    }, 600)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0f;
          font-family: 'DM Sans', sans-serif;
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          position: relative;
          overflow: hidden;
        }

        /* Background orbs */
        .login-root::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(123,31,162,0.12) 0%, transparent 70%);
          top: -150px;
          left: -150px;
          pointer-events: none;
        }

        .login-root::after {
          content: '';
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74,20,140,0.1) 0%, transparent 70%);
          bottom: -100px;
          right: -100px;
          pointer-events: none;
        }

        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 48px 44px;
          backdrop-filter: blur(20px);
          box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(123,31,162,0.15);
        }

        .login-brand {
          text-align: center;
          margin-bottom: 40px;
        }

        .login-scorpion {
          font-size: 56px;
          line-height: 1;
          display: block;
          margin-bottom: 16px;
          filter: drop-shadow(0 0 20px rgba(180,60,220,0.7));
          animation: floatScorpion 3s ease-in-out infinite;
        }

        @keyframes floatScorpion {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }

        .login-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff 40%, #ce93d8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 12px;
          color: #555;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          margin-top: 6px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .field-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 11px;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .login-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #e8e8f0;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .login-input::placeholder { color: #444; }

        .login-input:focus {
          border-color: rgba(156,39,176,0.5);
          background: rgba(156,39,176,0.05);
        }

        .erro-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.2);
          color: #ef9a9a;
          font-size: 13px;
          font-weight: 500;
        }

        .btn-entrar {
          width: 100%;
          padding: 13px 0;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #7b1fa2, #9c27b0);
          color: #fff;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
          position: relative;
          overflow: hidden;
        }

        .btn-entrar::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #8e24aa, #ab47bc);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .btn-entrar:hover::before { opacity: 1; }
        .btn-entrar:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(156,39,176,0.4); }
        .btn-entrar:active { transform: translateY(0); }
        .btn-entrar:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .btn-entrar span { position: relative; z-index: 1; }

        .btn-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer {
          text-align: center;
          margin-top: 28px;
          font-size: 11px;
          color: #333;
          letter-spacing: 1px;
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-scorpion">🦂</span>
            <div className="login-title">Scorpions Delivery</div>
            <div className="login-subtitle">Painel de Notas Fiscais</div>
          </div>

          <form className="login-form" onSubmit={entrar}>
            <div className="field-wrap">
              <div className="field-label">Usuário</div>
              <input
                className="login-input"
                placeholder="Digite seu usuário"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="field-wrap">
              <div className="field-label">Senha</div>
              <input
                className="login-input"
                placeholder="Digite sua senha"
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {erro && (
              <div className="erro-msg">
                ✗ {erro}
              </div>
            )}

            <button type="submit" className="btn-entrar" disabled={loading}>
              <span>
                {loading ? (
                  <span className="btn-loading">
                    <span className="btn-spinner" />
                    Entrando...
                  </span>
                ) : "Entrar"}
              </span>
            </button>
          </form>

          <div className="login-footer">SCORPIONS © 2026</div>
        </div>
      </div>
    </>
  )
}
