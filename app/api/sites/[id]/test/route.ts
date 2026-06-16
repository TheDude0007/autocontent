import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { testWPConnection } from "@/lib/wordpress";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const site = await prisma.wPSite.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const appPassword = decrypt(site.appPasswordEncrypted, site.iv);
  const result = await testWPConnection({ url: site.url, username: site.username, appPassword });

  return NextResponse.json(result);
}
