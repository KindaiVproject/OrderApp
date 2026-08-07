import { NextResponse } from "next/server";
import { getCurrentInstance } from "@/lib/instance";
import { saveProductImage } from "@/lib/uploads";

const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function POST(request: Request) {
  const instance = await getCurrentInstance();
  if (!instance) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI画像生成は未設定です(GEMINI_API_KEYが必要です)" },
      { status: 501 },
    );
  }

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "生成したい商品の説明を入力してください" }, { status: 400 });
  }

  const composedPrompt = `Product photo for a Japanese festival food-stall ordering app. Square composition, the item centered, filling the frame, plain light background, appetizing, simple, no text, no watermark. Item: ${prompt}`;

  const geminiRes = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: composedPrompt }] }],
    }),
  });

  if (!geminiRes.ok) {
    const detail = await geminiRes.text().catch(() => "");
    return NextResponse.json(
      { error: `画像生成に失敗しました (${geminiRes.status})`, detail },
      { status: 502 },
    );
  }

  const data = await geminiRes.json();
  const parts: Array<{ inlineData?: { mimeType?: string; data?: string } }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    return NextResponse.json({ error: "画像を生成できませんでした" }, { status: 502 });
  }

  const mime = imagePart.inlineData.mimeType ?? "image/png";
  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  const imageUrl = await saveProductImage(buffer, mime);

  return NextResponse.json({ imageUrl });
}
