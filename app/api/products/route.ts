import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services/auth/AuthService";
import { getProductService } from "@/lib/services/products/ProductService";
import { createProductSchema, productFileKeySchema } from "@/lib/validation/product";

export async function GET() {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const products = await getProductService().listForStore(session.storeId);
  return NextResponse.json({ products });
}

/**
 * The file and cover (if any) are already sitting in storage by the time
 * this runs — the browser uploaded them directly via a presigned URL from
 * /api/products/upload-url. This route only ever receives small JSON with
 * metadata plus the resulting storage keys, never raw file bytes.
 */
export async function POST(req: NextRequest) {
  const session = await getAuthService().requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = createProductSchema.safeParse({
    title: body.title,
    subjectCode: body.subjectCode,
    description: body.description,
    priceInPaise: body.priceInPaise,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fileParsed = productFileKeySchema.safeParse({ fileKey: body.fileKey, fileName: body.fileName });
  if (!fileParsed.success) {
    return NextResponse.json({ error: "Product file is required — upload it first" }, { status: 400 });
  }

  const coverPayload =
    typeof body.coverImageKey === "string" && body.coverImageKey.length > 0
      ? { key: body.coverImageKey }
      : undefined;

  try {
    const product = await getProductService().create(
      session.storeId,
      parsed.data,
      { key: fileParsed.data.fileKey, fileName: fileParsed.data.fileName },
      coverPayload
    );
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    console.error("[products] create failed:", err);
    return NextResponse.json({ error: "Could not save product" }, { status: 400 });
  }
}
