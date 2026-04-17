import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "키 없음" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    // 빌드 에러 방지를 위해 타입을 명확히 지정
    const config: Record<string, any> = {
      numberOfImages: 1,
      aspectRatio: body.aspectRatio || "16:9"
    };

    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-001",
      prompt: body.scenePrompt || body.imagePrompt,
      config
    });

    const image = response.generatedImages?.[0]?.image;
    if (!image) throw new Error("이미지 생성 실패");

    return NextResponse.json({ 
      imageUrl: `data:${image.mimeType};base64,${image.imageBytes}` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}