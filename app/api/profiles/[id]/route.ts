import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  service: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  targetAudience: z.string().min(1).optional(),
  painPoints: z.array(z.string()).optional(),
  usps: z.array(z.string()).optional(),
  salesObjections: z.array(z.string()).optional(),
  toneNotes: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const profile = await prisma.serviceProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deserializeProfile(profile));
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { painPoints, usps, salesObjections, ...rest } = parsed.data;
  const profile = await prisma.serviceProfile.update({
    where: { id },
    data: {
      ...rest,
      ...(painPoints && { painPoints: JSON.stringify(painPoints) }),
      ...(usps && { usps: JSON.stringify(usps) }),
      ...(salesObjections && { salesObjections: JSON.stringify(salesObjections) }),
    },
  });
  return NextResponse.json(deserializeProfile(profile));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.serviceProfile.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

function deserializeProfile(p: { painPoints: string; usps: string; salesObjections: string; [key: string]: unknown }) {
  return {
    ...p,
    painPoints: JSON.parse(p.painPoints) as string[],
    usps: JSON.parse(p.usps) as string[],
    salesObjections: JSON.parse(p.salesObjections) as string[],
  };
}
