import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const TEXT_MODEL = "gemini-2.5-flash-lite";

type GenerateTextBody = {
  synopsis?: string;
  geminiApiKey?: string;   // 사용자가 프론트에서 전달한 키
};

export async function POST(req: Request) {
  try {
    const { synopsis, geminiApiKey } = (await req.json()) as GenerateTextBody;

    if (!synopsis?.trim()) {
      return NextResponse.json(
        { error: "시놉시스 내용이 비어 있습니다." },
        { status: 400 }
      );
    }

    // 우선순위: 사용자 키 → 서버 환경변수
    const apiKey = geminiApiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API 키가 없습니다. 화면 상단에서 API 키를 입력해 주세요." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `당신은 전문 시나리오 작가이자 스토리보드 기획자입니다.
사용자가 제공한 시놉시스를 분석하여 아래 JSON 형식으로만 응답하십시오.
마크다운 코드블록(\`\`\`json)이나 다른 텍스트 없이 순수 JSON만 출력하십시오.

{
  "synopsisSections": {
    "logline": "한 줄 로그라인",
    "worldBackground": "세계관과 배경 설명",
    "mainCharacters": "주요 등장인물 설명",
    "storyStructure": "도입-전개-결말 구조 설명",
    "coreConflict": "핵심 갈등 요소",
    "theme": "작품이 전달하는 주제",
    "toneStyle": "작품의 톤과 스타일",
    "planningIntent": "기획 의도 및 목표 관객"
  },
  "topSummary": [
    "줄거리 요약 문장 1",
    "줄거리 요약 문장 2",
    "줄거리 요약 문장 3",
    "줄거리 요약 문장 4",
    "줄거리 요약 문장 5",
    "줄거리 요약 문장 6"
  ],
  "scenes": [
    {
      "title": "씬 제목 (예: 도입 — 평범한 일상)",
      "description": "이 장면에서 일어나는 사건과 감정을 2~3문장으로 서술한다. 마지막 문장에는 반드시 카메라 앵글(예: 클로즈업, 풀샷, 익스트림 클로즈업, 버드아이뷰, 로우앵글 등)과 카메라 무빙(예: 줌인, 줌아웃, 패닝, 틸트업, 틸트다운, 트래킹샷, 핸드헬드 등)을 구체적으로 포함할 것.",
      "imagePrompt": "This scene in English for image generation: concise visual description of the key moment, characters, setting, lighting, mood, camera angle and movement"
    }
  ]
}

scenes 배열은 반드시 7개여야 합니다.
각 씬의 description 마지막 문장에는 반드시 카메라 앵글과 무빙 정보를 포함하십시오.
각 씬의 imagePrompt는 반드시 영문으로, 카메라 앵글과 무빙 정보를 포함하여 이미지 생성 AI가 잘 이해할 수 있도록 구체적으로 작성하십시오.`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: `다음 시놉시스를 분석해주세요:\n\n${synopsis}` }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed:", cleaned);
      return NextResponse.json(
        { error: "AI 응답을 파싱할 수 없습니다. 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("generate-text error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `텍스트 생성 중 오류가 발생했습니다: ${detail}` },
      { status: 500 }
    );
  }
}
