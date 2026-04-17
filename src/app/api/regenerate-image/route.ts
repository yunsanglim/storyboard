import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_IMAGE_MODELS = [
  "imagen-3.0-generate-001",
  "imagen-3.0-generate-002",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      scenePrompt,
      imageStyle,
      aspectRatio, 
      customStylePrompt,
      customReferenceImageBase64,
      customReferenceImageMimeType,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 키가 없습니다." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = DEFAULT_IMAGE_MODELS[0];

    const config: any = {
      numberOfImages: 1,
      aspectRatio: aspectRatio || "16:9", 
    };

    if (imageStyle === "custom" && customReferenceImageBase64) {
      config.referenceImages = [{
        referenceType: "STYLE",
        referenceImage: {
          imageBytes: customReferenceImageBase64,
          mimeType: customReferenceImageMimeType,
        },
      }];
    }

    const response = await ai.models.generateImages({ model, prompt: scenePrompt, config });
    const image = response?.generatedImages?.[0]?.image;

    return NextResponse.json({ 
      imageUrl: `data:${image.mimeType};base64,${image.imageBytes}` 
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}