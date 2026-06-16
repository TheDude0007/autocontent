import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const blockUpdateSchema = z.array(
  z.object({
    id: z.string(),
    acfFieldName: z.string().min(1),
    required: z.boolean(),
  })
);

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const template = await prisma.template.findUnique({
    where: { id },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  // Accept either { name } or { blocks: [...] }
  if (body.name !== undefined) {
    const template = await prisma.template.update({
      where: { id },
      data: { name: body.name },
      include: { blocks: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(template);
  }

  if (body.blocks !== undefined) {
    const parsed = blockUpdateSchema.safeParse(body.blocks);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    await Promise.all(
      parsed.data.map((b) =>
        prisma.templateBlock.update({
          where: { id: b.id },
          data: { acfFieldName: b.acfFieldName, required: b.required },
        })
      )
    );
    const template = await prisma.template.findUnique({
      where: { id },
      include: { blocks: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(template);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.template.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
