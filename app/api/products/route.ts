import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getProductService } from "@/lib/services/products/ProductService";
import { createProductSchema } from "@/lib/validation/product";

export async function GET() {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const products = await getProductService().listForStore(session.storeId);
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const parsed = createProductSchema.safeParse({
    title: form.get("title"),
    description: form.get("description"),
    priceInPaise: form.get("priceInPaise"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Product file (PDF) is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported in the MVP" }, { status: 400 });
  }

  const cover = form.get("cover");
  let coverPayload: { buffer: Buffer; fileName: string } | undefined;
  if (cover instanceof File && cover.size > 0) {
    coverPayload = { buffer: Buffer.from(await cover.arrayBuffer()), fileName: cover.name };
  }

  const product = await getProductService().create(
    session.storeId,
    parsed.data,
    { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name },
    coverPayload
  );

  return NextResponse.json({ product }, { status: 201 });
}
