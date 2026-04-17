import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { synopsis } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API 키가 없습니다." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      다음 시놉시스를 바탕으로 7개의 스토리보드 장면을 만들어주세요.
      반드시 다음 JSON 형식으로만 답변하세요:
      {
        "synopsisSections": { 
          "logline": "", "worldBackground": "", "mainCharacters": "", "storyStructure": "", 
          "coreConflict": "", "theme": "", "toneStyle": "", "planningIntent": "" 
        },
        "topSummary": ["", "", "", "", "", ""],
        "scenes": [
          { "title": "장면1", "description": "설명", "imagePrompt": "영어 프롬프트" }
        ]
      }
      시놉시스: ${synopsis}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}