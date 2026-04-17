// src/app/api/generate-text/route.ts
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
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      다음 시놉시스를 바탕으로 7개의 스토리보드 장면을 만들어주세요.
      반드시 다음 JSON 형식으로만 답변하세요:
      {
        "synopsisSections": { "logline": "...", "worldBackground": "...", "mainCharacters": "...", "storyStructure": "...", "coreConflict": "...", "theme": "...", "toneStyle": "...", "planningIntent": "..." },
        "topSummary": ["요약1", "요약2", "요약3", "요약4", "요약5", "요약6"],
        "scenes": [
          { "title": "장면1 제목", "description": "장면 설명", "imagePrompt": "영어 이미지 생성 프롬프트" },
          ... 7개까지
        ]
      }
      시놉시스: ${synopsis}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // JSON 부분만 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}