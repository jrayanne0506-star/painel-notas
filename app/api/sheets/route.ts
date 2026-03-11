import { NextRequest, NextResponse } from "next/server"

const SHEETS_API = process.env.SHEETS_API as string

export async function GET(req: NextRequest) {
  try {
    const aba = req.nextUrl.searchParams.get("aba") ?? ""
    const res = await fetch(`${SHEETS_API}?aba=${encodeURIComponent(aba)}`, {
      redirect: "follow",
      headers: { "Accept": "application/json" },
    })
    const text = await res.text()
    if (text.trim().startsWith("<")) {
      return NextResponse.json({ erro: "Apps Script retornou HTML", raw: text.slice(0, 200) }, { status: 500 })
    }
    return NextResponse.json(JSON.parse(text))
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(SHEETS_API, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    return NextResponse.json({ ok: true, raw: text.slice(0, 200) })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}