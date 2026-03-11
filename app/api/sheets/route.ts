import { NextRequest, NextResponse } from "next/server"

const SHEETS_API = process.env.SHEETS_API as string

export async function GET(req: NextRequest) {
  const aba = req.nextUrl.searchParams.get("aba") ?? ""
  const res = await fetch(`${SHEETS_API}?aba=${encodeURIComponent(aba)}`, { redirect: "follow" })
  const data = await res.json()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  await fetch(SHEETS_API, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  })
  return NextResponse.json({ ok: true })
}
