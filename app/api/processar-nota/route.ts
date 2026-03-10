import { NextRequest, NextResponse } from "next/server";
import { lerNotaLocal } from "@/lib/ocr";
import { salvarResultadoNoSheets } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { link, valorEsperado, id } = await req.json();
    if (!link) return NextResponse.json({ erro: "Sem link" }, { status: 400 });

    const resultado = await lerNotaLocal(link, valorEsperado);
    await salvarResultadoNoSheets(Number(id), resultado.numeroNfse, resultado.statusValidacao);

    return NextResponse.json({ id, ...resultado });
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 });
  }
}