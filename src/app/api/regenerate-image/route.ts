import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001"
];

type RegenerateImageBody = {
  sceneIndex?: number;
  sceneTitle?: string;
  sceneDescription?: string;
  scenePrompt?: string;
};

export async function POST(req: Request) {
  try {
    const { sceneIndex, sceneTitle, sceneDescription, scenePrompt } =
      (await req.json()) as RegenerateImageBody;
    const safeIndex = Number.isInteger(sceneIndex) ? Number(sceneIndex) : 0;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const configuredModel = process.env.GEMINI_IMAGE_MODEL?.trim();
    const modelCandidates = configuredModel
      ? [configuredModel, ...DEFAULT_IMAGE_MODELS.filter((m) => m !== configuredModel)]
      : DEFAULT_IMAGE_MODELS;

    const prompt = `
스토리보드 씬 이미지를 생성해 주세요.
- 씬 번호: ${safeIndex + 1}
- 씬 제목: ${sceneTitle ?? `Scene ${safeIndex + 1}`}
- 씬 설명: ${sceneDescription ?? "해당 장면의 핵심 연출을 담은 이미지"}
- 이미지 프롬프트: ${scenePrompt ?? "시네마틱한 연출, 영화 스틸컷 스타일"}

요구사항:
- 시네마틱한 구도
- 인물, 배경, 감정이 명확히 드러나게
- 텍스트/자막/워터마크 없음
- 가로형 프레임, 고해상도 느낌
`;

    let generatedImageUrl: string | null = null;
    let lastError = "이미지 생성 결과가 비어 있습니다.";

    for (const model of modelCandidates) {
      try {
        const response = await ai.models.generateImages({
          model,
          prompt,
          config: {
            numberOfImages: 1
          }
        });

        const image = response?.generatedImages?.[0]?.image;
        const base64 = image?.imageBytes;
        const mimeType = image?.mimeType ?? "image/png";

        if (base64) {
          generatedImageUrl = `data:${mimeType};base64,${base64}`;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!generatedImageUrl) {
      return NextResponse.json(
        {
          error: `Gemini 이미지 생성 실패: ${lastError}. GEMINI_IMAGE_MODEL을 유효한 이미지 생성 모델로 지정해 주세요.`
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ imageUrl: generatedImageUrl });
  } catch (error) {
    console.error("regenerate-image error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `이미지 생성 중 오류가 발생했습니다: ${detail}` },
      { status: 500 }
    );
  }
}
