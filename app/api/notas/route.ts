import { NextResponse } from "next/server"
import { lerCache, salvarCache, buscarNotasCruzadas } from "@/lib/sheets"

export async function GET() {
  try {
    const cache = lerCache()
    if (cache) return NextResponse.json(cache)

    const dados = await buscarNotasCruzadas()
    salvarCache(dados)
    return NextResponse.json(dados)
  } catch (err) {
    console.error("Erro:", err)
    return NextResponse.json([], { status: 500 })
  }
}