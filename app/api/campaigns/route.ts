import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  serviceProfileId: z.string().min(1),
  templateId: z.string().optional(),
  wpSiteId: z.string().optional(),
});

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      serviceProfile: { select: { name: true, service: true, location: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const profile = await prisma.serviceProfile.findUnique({
    where: { id: parsed.data.serviceProfileId },
  });
  if (!profile) {
    return NextResponse.json({ error: "Service profile not found" }, { status: 404 });
  }
  const campaign = await prisma.campaign.create({ data: parsed.data });
  return NextResponse.json(campaign, { status: 201 });
}
