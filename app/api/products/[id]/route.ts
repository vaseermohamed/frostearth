import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getProductService } from "@/lib/services/products/ProductService";
import { updateProductSchema, productFileKeySchema } from "@/lib/validation/product";

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

/**
 * Replacement file/cover, when present, are already sitting in storage —
 * the browser uploaded them directly via a presigned URL from
 * /api/products/upload-url before calling this route. Only small JSON
 * metadata plus the resulting storage keys land here, never raw bytes.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = updateProductSchema.safeParse({
    title: body.title || undefined,
    description: body.description || undefined,
    priceInPaise: body.priceInPaise || undefined,
    status: body.status || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let filePayload: { key: string; fileName: string } | undefined;
  if (body.fileKey || body.fileName) {
    const fileParsed = productFileKeySchema.safeParse({ fileKey: body.fileKey, fileName: body.fileName });
    if (!fileParsed.success) {
      return NextResponse.json({ error: "Invalid replacement file" }, { status: 400 });
    }
    filePayload = { key: fileParsed.data.fileKey, fileName: fileParsed.data.fileName };
  }

  const coverPayload =
    typeof body.coverImageKey === "string" && body.coverImageKey.length > 0
      ? { key: body.coverImageKey }
      : undefined;

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
