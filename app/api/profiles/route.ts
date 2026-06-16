import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().min(1),
  service: z.string().min(1),
  location: z.string().min(1),
  targetAudience: z.string().min(1),
  painPoints: z.array(z.string()),
  usps: z.array(z.string()),
  salesObjections: z.array(z.string()),
  toneNotes: z.string(),
});

export async function GET() {
  const profiles = await prisma.serviceProfile.findMany({
    select: {
      id: true,
      name: true,
      service: true,
      location: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { painPoints, usps, salesObjections, ...rest } = parsed.data;
  const profile = await prisma.serviceProfile.create({
    data: {
      ...rest,
      painPoints: JSON.stringify(painPoints),
      usps: JSON.stringify(usps),
      salesObjections: JSON.stringify(salesObjections),
    },
  });
  return NextResponse.json(deserializeProfile(profile), { status: 201 });
}

function deserializeProfile(p: { painPoints: string; usps: string; salesObjections: string; [key: string]: unknown }) {
  return {
    ...p,
    painPoints: JSON.parse(p.painPoints) as string[],
    usps: JSON.parse(p.usps) as string[],
    salesObjections: JSON.parse(p.salesObjections) as string[],
  };
}
