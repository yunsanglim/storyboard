import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001",
];

const REFERENCE_IMAGE_SUPPORTED_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001",
];

// Imagen API 지원 종횡비
const VALID_ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
type ValidAspectRatio = (typeof VALID_ASPECT_RATIOS)[number];

type PresetStyleValue = "pixar" | "live_action" | "watercolor" | "marvel_comics";
type ImageStyleValue = PresetStyleValue | "custom";

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
  customStylePrompt?: string;
  customReferenceImageBase64?: string;
  customReferenceImageMimeType?: string;
  geminiApiKey?: string;
  aspectRatio?: string;   // 종횡비 (예: "16:9", "1:1", "4:3", "3:4", "9:16")
};

function resolveStylePrefix(body: RegenerateImageBody): string {
  const { imageStyle, customStylePrompt } = body;
  if (imageStyle === "custom") {
    return customStylePrompt?.trim()
      ? `${customStylePrompt.trim()},`
      : "High-quality cinematic illustration,";
  }
  const key = imageStyle as PresetStyleValue;
  return IMAGE_STYLE_PREFIXES[key] ?? IMAGE_STYLE_PREFIXES.live_action;
}

function resolveAspectRatio(value?: string): ValidAspectRatio {
  if (value && VALID_ASPECT_RATIOS.includes(value as ValidAspectRatio)) {
    return value as ValidAspectRatio;
  }
  return "16:9"; // 기본값
}

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
      geminiApiKey,
      aspectRatio,
    } = body;

    const safeIndex = Number.isInteger(sceneIndex) ? Number(sceneIndex) : 0;

    // 우선순위: 사용자 키 → 서버 환경변수
    const apiKey = geminiApiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API 키가 없습니다. 화면 상단에서 API 키를 입력해 주세요." },
        { status: 400 }
      );
    }

    const stylePrefix = resolveStylePrefix(body);
    const resolvedAspectRatio = resolveAspectRatio(aspectRatio);

    const hasReferenceImage =
      imageStyle === "custom" &&
      !!customReferenceImageBase64 &&
      !!customReferenceImageMimeType;

    const ai = new GoogleGenAI({ apiKey });

    const configuredModel = process.env.GEMINI_IMAGE_MODEL?.trim();
    const allCandidates = configuredModel
      ? [configuredModel, ...DEFAULT_IMAGE_MODELS.filter((m) => m !== configuredModel)]
      : DEFAULT_IMAGE_MODELS;

    const modelCandidates = hasReferenceImage
      ? [
          ...allCandidates.filter((m) => REFERENCE_IMAGE_SUPPORTED_MODELS.includes(m)),
          ...allCandidates.filter((m) => !REFERENCE_IMAGE_SUPPORTED_MODELS.includes(m)),
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
- 종횡비: ${resolvedAspectRatio}
`;

    let generatedImageUrl: string | null = null;
    let lastError = "이미지 생성 결과가 비어 있습니다.";
    let usedReferenceImage = hasReferenceImage;

    for (const model of modelCandidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: Record<string, any> = {
          numberOfImages: 1,
          aspectRatio: resolvedAspectRatio,  // ← Imagen API 종횡비 파라미터
        };

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

        const response = await ai.models.generateImages({ model, prompt, config });
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
        { error: `Gemini 이미지 생성 실패: ${lastError}` },
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