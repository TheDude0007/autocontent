import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});

export async function GET() {
  const sites = await prisma.wPSite.findMany({
    select: { id: true, name: true, url: true, username: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sites);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, url, username, appPassword } = parsed.data;
  const { encrypted, iv } = encrypt(appPassword);

  const site = await prisma.wPSite.create({
    data: { name, url, username, appPasswordEncrypted: encrypted, iv },
    select: { id: true, name: true, url: true, username: true, createdAt: true },
  });

  return NextResponse.json(site, { status: 201 });
}
