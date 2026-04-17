import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001",
];

/** 참조 이미지(STYLE) 기능을 지원하는 모델 목록 — Imagen 3.0 이상 */
const REFERENCE_IMAGE_SUPPORTED_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type PresetStyleValue = "pixar" | "live_action" | "watercolor" | "marvel_comics";
type ImageStyleValue = PresetStyleValue | "custom";

/** 프리셋 스타일별 영문 프롬프트 접두어 */
const IMAGE_STYLE_PREFIXES: Record<PresetStyleValue, string> = {
  pixar:
    "Pixar-style 3D animation, vibrant saturated colors, smooth expressive characters, family movie aesthetic,",
  live_action:
    "Cinematic live-action film still, photorealistic, dramatic professional cinematography, natural lighting,",
  watercolor:
    "Soft watercolor illustration, delicate brushstrokes, painterly washes, gentle pastel tones, artistic,",
  marvel_comics:
    "Marvel comic book art style, bold ink outlines, dynamic action composition, Ben-Day dot shading, vivid flat colors,",
};

type RegenerateImageBody = {
  sceneIndex?: number;
  sceneTitle?: string;
  sceneDescription?: string;
  scenePrompt?: string;
  imageStyle?: ImageStyleValue;
  /** 커스텀 스타일 전용 */
  customStylePrompt?: string;
  customReferenceImageBase64?: string;  // raw base64 (no data-url prefix)
  customReferenceImageMimeType?: string;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function resolveStylePrefix(body: RegenerateImageBody): string {
  const { imageStyle, customStylePrompt } = body;

  if (imageStyle === "custom") {
    // 사용자가 입력한 커스텀 프롬프트 사용 (없으면 중립적 폴백)
    return customStylePrompt?.trim()
      ? `${customStylePrompt.trim()},`
      : "High-quality cinematic illustration,";
  }

  const key = imageStyle as PresetStyleValue;
  return IMAGE_STYLE_PREFIXES[key] ?? IMAGE_STYLE_PREFIXES.live_action;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegenerateImageBody;
    const {
      sceneIndex,
      sceneTitle,
      sceneDescription,
      scenePrompt,
      imageStyle,
      customReferenceImageBase64,
      customReferenceImageMimeType,
    } = body;

    const safeIndex = Number.isInteger(sceneIndex) ? Number(sceneIndex) : 0;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const stylePrefix = resolveStylePrefix(body);
    const hasReferenceImage =
      imageStyle === "custom" &&
      !!customReferenceImageBase64 &&
      !!customReferenceImageMimeType;

    const ai = new GoogleGenAI({ apiKey });

    const configuredModel = process.env.GEMINI_IMAGE_MODEL?.trim();
    const allCandidates = configuredModel
      ? [
          configuredModel,
          ...DEFAULT_IMAGE_MODELS.filter((m) => m !== configuredModel),
        ]
      : DEFAULT_IMAGE_MODELS;

    // 참조 이미지가 있을 경우 지원 모델만 우선 시도
    const modelCandidates = hasReferenceImage
      ? [
          ...allCandidates.filter((m) =>
            REFERENCE_IMAGE_SUPPORTED_MODELS.includes(m)
          ),
          ...allCandidates.filter(
            (m) => !REFERENCE_IMAGE_SUPPORTED_MODELS.includes(m)
          ),
        ]
      : allCandidates;

    const prompt = `
${stylePrefix}
스토리보드 씬 이미지를 생성해 주세요.
- 씬 번호: ${safeIndex + 1}
- 씬 제목: ${sceneTitle ?? `Scene ${safeIndex + 1}`}
- 씬 설명: ${sceneDescription ?? "해당 장면의 핵심 연출을 담은 이미지"}
- 이미지 프롬프트: ${scenePrompt ?? "시네마틱한 연출, 영화 스틸컷 스타일"}

요구사항:
- 위 스타일을 전체 이미지에 일관되게 적용
- 시네마틱한 구도
- 인물, 배경, 감정이 명확히 드러나게
- 텍스트 / 자막 / 워터마크 없음
- 가로형 프레임, 고해상도 느낌
`;

    let generatedImageUrl: string | null = null;
    let lastError = "이미지 생성 결과가 비어 있습니다.";
    let usedReferenceImage = hasReferenceImage;

    for (const model of modelCandidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: Record<string, any> = { numberOfImages: 1 };

        // 참조 이미지가 있고 아직 시도 중인 경우 referenceImages 파라미터 추가
        if (usedReferenceImage) {
          config.referenceImages = [
            {
              referenceType: "STYLE",
              referenceId: 1,
              referenceImage: {
                imageBytes: customReferenceImageBase64,
                mimeType: customReferenceImageMimeType,
              },
            },
          ];
        }

        const response = await ai.models.generateImages({
          model,
          prompt,
          config,
        });

        const image = response?.generatedImages?.[0]?.image;
        const base64 = image?.imageBytes;
        const mimeType = image?.mimeType ?? "image/png";

        if (base64) {
          generatedImageUrl = `data:${mimeType};base64,${base64}`;
          break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        lastError = msg;

        // 참조 이미지로 인한 실패일 경우, 다음 시도는 참조 이미지 없이 진행
        if (
          usedReferenceImage &&
          (msg.includes("referenceImages") ||
            msg.includes("not supported") ||
            msg.includes("invalid"))
        ) {
          usedReferenceImage = false;
        }
      }
    }

    if (!generatedImageUrl) {
      return NextResponse.json(
        {
          error: `Gemini 이미지 생성 실패: ${lastError}. GEMINI_IMAGE_MODEL을 유효한 이미지 생성 모델로 지정해 주세요.`,
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