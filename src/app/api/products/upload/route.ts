import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { MAX_UPLOAD_BYTES, extensionForMime, saveProductImage } from "@/lib/uploads";

export async function POST(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "画像ファイルを選択してください" }, { status: 400 });
  }
  if (!extensionForMime(file.type)) {
    return NextResponse.json({ error: "png, jpeg, webp, gif形式に対応しています" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "画像は5MB以下にしてください" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageUrl = await saveProductImage(buffer, file.type);

  return NextResponse.json({ imageUrl });
}
