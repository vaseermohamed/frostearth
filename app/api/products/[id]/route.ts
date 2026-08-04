import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getProductService } from "@/lib/services/products/ProductService";
import { updateProductSchema } from "@/lib/validation/product";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const product = await getProductService().getOwned(session.storeId, params.id);
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const parsed = updateProductSchema.safeParse({
    title: form.get("title") || undefined,
    description: form.get("description") || undefined,
    priceInPaise: form.get("priceInPaise") || undefined,
    status: form.get("status") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fileEntry = form.get("file");
  let filePayload: { buffer: Buffer; fileName: string } | undefined;
  if (fileEntry instanceof File && fileEntry.size > 0) {
    if (fileEntry.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }
    filePayload = { buffer: Buffer.from(await fileEntry.arrayBuffer()), fileName: fileEntry.name };
  }

  const coverEntry = form.get("cover");
  let coverPayload: { buffer: Buffer; fileName: string } | undefined;
  if (coverEntry instanceof File && coverEntry.size > 0) {
    coverPayload = { buffer: Buffer.from(await coverEntry.arrayBuffer()), fileName: coverEntry.name };
  }

  try {
    const product = await getProductService().update(
      session.storeId,
      params.id,
      parsed.data,
      filePayload,
      coverPayload
    );
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const result = await getProductService().delete(session.storeId, params.id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[products] delete failed:", err);
    return NextResponse.json({ error: err.message || "Could not delete product" }, { status: 400 });
  }
}
