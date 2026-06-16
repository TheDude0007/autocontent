import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  username: z.string().min(1).optional(),
  appPassword: z.string().min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.wPSite.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { appPassword, ...rest } = parsed.data;
  const encryptedData = appPassword ? encrypt(appPassword) : null;

  const site = await prisma.wPSite.update({
    where: { id },
    data: {
      ...rest,
      ...(encryptedData
        ? { appPasswordEncrypted: encryptedData.encrypted, iv: encryptedData.iv }
        : {}),
    },
    select: { id: true, name: true, url: true, username: true, createdAt: true },
  });

  return NextResponse.json(site);
}
