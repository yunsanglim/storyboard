import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_GEMINI_TEXT_MODELS = [
  "gemini-1.5-pro",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

type SynopsisSections = {
  logline: string;
  worldBackground: string;
  mainCharacters: string;
  storyStructure: string;
  coreConflict: string;
  theme: string;
  toneStyle: string;
  planningIntent: string;
};

type GeneratedScene = {
  title: string;
  description: string;
  imagePrompt: string;
};

function extractJsonObject(rawText: string) {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("JSON object not found in AI response");
  }
  return cleaned.slice(first, last + 1);
}

export async function POST(req: Request) {
  try {
    const { synopsis } = (await req.json()) as { synopsis?: string };
    if (!synopsis || !synopsis.trim()) {
      return NextResponse.json(
        { error: "시놉시스를 입력해 주세요." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const prompt = `
다음 시놉시스를 바탕으로 JSON만 출력해 주세요.
시놉시스에는 가능한 한 아래 항목을 반영해서 해석해 주세요:
- 로그라인
- 세계관 / 배경
- 주요 캐릭터
- 스토리 구조 (도입-전개-결말)
- 핵심 갈등
- 주제
- 톤 & 스타일
- 기획 의도

요구 형식:
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
  "topSummary": ["문장1", "문장2", "문장3", "문장4", "문장5", "문장6"],
  "scenes": [
    { "title": "Scene 1", "description": "...", "imagePrompt": "..." },
    { "title": "Scene 2", "description": "...", "imagePrompt": "..." },
    { "title": "Scene 3", "description": "...", "imagePrompt": "..." },
    { "title": "Scene 4", "description": "...", "imagePrompt": "..." },
    { "title": "Scene 5", "description": "...", "imagePrompt": "..." },
    { "title": "Scene 6", "description": "...", "imagePrompt": "..." },
    { "title": "Scene 7", "description": "...", "imagePrompt": "..." }
  ]
}

규칙:
- 한국어로 작성
- synopsisSections 8개 항목은 모두 반드시 채우기
- topSummary는 정확히 6개
- scenes는 정확히 7개
- description은 각 1~2문장
- imagePrompt는 각 씬의 시각 요소를 구체적으로 묘사한 한국어 프롬프트로 작성
- topSummary는 위 8개 항목의 핵심이 고르게 드러나도록 작성

시놉시스:
${synopsis}
`;

    const ai = new GoogleGenAI({ apiKey });
    const configuredModel = process.env.GEMINI_TEXT_MODEL?.trim();
    const modelCandidates = configuredModel
      ? [
          configuredModel,
          ...DEFAULT_GEMINI_TEXT_MODELS.filter((m) => m !== configuredModel)
        ]
      : DEFAULT_GEMINI_TEXT_MODELS;

    let text: string | undefined;
    let lastError = "텍스트 응답이 비어 있습니다.";

    for (const model of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.7
          }
        });
        text = response?.text;
        if (text?.trim()) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!text) {
      throw new Error(`Gemini text generation failed: ${lastError}`);
    }

    const jsonText = extractJsonObject(text);
    const parsed = JSON.parse(jsonText) as {
      synopsisSections?: Partial<SynopsisSections>;
      topSummary?: string[];
      scenes?: Partial<GeneratedScene>[];
    };

    const sections = parsed.synopsisSections;
    const requiredSections: SynopsisSections = {
      logline: sections?.logline?.trim() ?? "",
      worldBackground: sections?.worldBackground?.trim() ?? "",
      mainCharacters: sections?.mainCharacters?.trim() ?? "",
      storyStructure: sections?.storyStructure?.trim() ?? "",
      coreConflict: sections?.coreConflict?.trim() ?? "",
      theme: sections?.theme?.trim() ?? "",
      toneStyle: sections?.toneStyle?.trim() ?? "",
      planningIntent: sections?.planningIntent?.trim() ?? ""
    };

    const isSectionEmpty = Object.values(requiredSections).some((value) => !value);
    if (isSectionEmpty) {
      throw new Error("synopsisSections has empty fields");
    }

    if (!Array.isArray(parsed.topSummary) || parsed.topSummary.length < 6) {
      throw new Error("topSummary must contain 6 items");
    }

    if (!Array.isArray(parsed.scenes) || parsed.scenes.length < 7) {
      throw new Error("scenes must contain 7 items");
    }

    const normalizedScenes: GeneratedScene[] = parsed.scenes.slice(0, 7).map((scene, idx) => {
      const title = scene.title?.trim();
      const description = scene.description?.trim();
      const imagePrompt = scene.imagePrompt?.trim();
      if (!title || !description || !imagePrompt) {
        throw new Error(`scene ${idx + 1} has empty field`);
      }
      return { title, description, imagePrompt };
    });

    return NextResponse.json({
      synopsisSections: requiredSections,
      topSummary: parsed.topSummary.slice(0, 6),
      scenes: normalizedScenes
    });
  } catch (error) {
    console.error("generate-text error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `텍스트 생성 중 오류가 발생했습니다: ${detail}` },
      { status: 500 }
    );
  }
}
