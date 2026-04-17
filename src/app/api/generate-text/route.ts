import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { synopsis } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "키 없음" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${synopsis}를 바탕으로 7개의 장면 제목, 설명, 영어 이미지 프롬프트를 JSON 형식으로 생성해줘.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return NextResponse.json(JSON.parse(jsonMatch ? jsonMatch[0] : text));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}