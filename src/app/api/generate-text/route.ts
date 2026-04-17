import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai"; // 사용자 프로젝트 라이브러리

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
      반드시 다음 JSON 형식으로만 답변하세요 (다른 설명 생략):
      {
        "synopsisSections": { 
          "logline": "...", 
          "worldBackground": "...", 
          "mainCharacters": "...", 
          "storyStructure": "...", 
          "coreConflict": "...", 
          "theme": "...", 
          "toneStyle": "...", 
          "planningIntent": "..." 
        },
        "topSummary": ["요약1", "요약2", "요약3", "요약4", "요약5", "요약6"],
        "scenes": [
          { "title": "장면1", "description": "설명", "imagePrompt": "영어 프롬프트" },
          { "title": "장면2", "description": "설명", "imagePrompt": "영어 프롬프트" },
          { "title": "장면3", "description": "설명", "imagePrompt": "영어 프롬프트" },
          { "title": "장면4", "description": "설명", "imagePrompt": "영어 프롬프트" },
          { "title": "장면5", "description": "설명", "imagePrompt": "영어 프롬프트" },
          { "title": "장면6", "description": "설-명", "imagePrompt": "영어 프롬프트" },
          { "title": "장면7", "description": "설명", "imagePrompt": "영어 프롬프트" }
        ]
      }
      시놉시스: ${synopsis}
    `;

    // 에러가 났던 getGenerativeModel 대신 모델 호출 방식을 변경했습니다.
    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    // 응답에서 텍스트 추출 (라이브러리 구조에 맞춤)
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // JSON만 골라내기
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Generate text error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}