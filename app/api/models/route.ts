import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = req.nextUrl.searchParams.get("base");
  const key = req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
  if (!base) return NextResponse.json({ error: "Missing base" }, { status: 400 });
  const clean = base.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  for (const path of ["/v1/models", "/models"]) {
    try {
      const r = await fetch(`${clean}${path}`, { headers, cache: "no-store" });
      const text = await r.text();
      if (!r.ok) continue;
      try { return NextResponse.json(JSON.parse(text)); } catch { return new NextResponse(text, { status: 200 }); }
    } catch { continue; }
  }
  return NextResponse.json({ error: "Falha ao buscar modelos (verifique Base URL e API Key)" }, { status: 502 });
}
