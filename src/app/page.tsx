"use client";

import Image from "next/image";
import {
  ChevronDown,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  Printer,
  PenLine,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useMemo, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SynopsisSectionKey =
  | "logline"
  | "worldBackground"
  | "mainCharacters"
  | "storyStructure"
  | "coreConflict"
  | "theme"
  | "toneStyle"
  | "planningIntent";

type Scene = {
  title: string;
  description: string;
  imagePrompt: string;
  imageUrl: string;
};

type SynopsisSections = Record<SynopsisSectionKey, string>;

type ReferenceImage = {
  base64: string;
  mimeType: string;
  previewUrl: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gemini_api_key";

const synopsisSectionMeta: { label: string; key: SynopsisSectionKey }[] = [
  { label: "로그라인", key: "logline" },
  { label: "세계관 / 배경", key: "worldBackground" },
  { label: "주요 캐릭터", key: "mainCharacters" },
  { label: "스토리 구조", key: "storyStructure" },
  { label: "핵심 갈등", key: "coreConflict" },
  { label: "주제", key: "theme" },
  { label: "톤 & 스타일", key: "toneStyle" },
  { label: "기획 의도", key: "planningIntent" },
];

const IMAGE_STYLE_OPTIONS = [
  { value: "pixar",         label: "🎨 픽사 애니메이션" },
  { value: "live_action",   label: "🎬 실사 영화" },
  { value: "watercolor",    label: "🖌️ 수채화 일러스트" },
  { value: "marvel_comics", label: "💥 마블 코믹스" },
  { value: "custom",        label: "✏️ 커스텀" },
] as const;

type ImageStyleValue = (typeof IMAGE_STYLE_OPTIONS)[number]["value"];

// Imagen API 지원 종횡비
const ASPECT_RATIO_OPTIONS = [
  { value: "16:9",  label: "16:9  가로형 (영화/TV)",  aspect: "aspect-video" },
  { value: "1:1",   label: "1:1   정사각형",            aspect: "aspect-square" },
  { value: "4:3",   label: "4:3   표준 가로형",         aspect: "aspect-[4/3]" },
  { value: "3:4",   label: "3:4   세로형 (포스터)",     aspect: "aspect-[3/4]" },
  { value: "9:16",  label: "9:16  세로형 (모바일)",     aspect: "aspect-[9/16]" },
] as const;

type AspectRatioValue = (typeof ASPECT_RATIO_OPTIONS)[number]["value"];

const defaultImageDataUrl =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <rect width="1280" height="720" fill="#E5E7EB"/>
  <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#6B7280" font-family="Arial, sans-serif" font-size="32">
    생성된 이미지가 표시됩니다
  </text>
  <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="22">
    줄거리 생성 또는 이미지 재실행을 눌러주세요
  </text>
</svg>
`);

const emptyScenes: Scene[] = Array.from({ length: 7 }).map((_, index) => ({
  title: `Scene ${index + 1}`,
  description: "",
  imagePrompt: "",
  imageUrl: defaultImageDataUrl,
}));

const synopsisTemplate = `로그라인:

세계관 / 배경:

주요 캐릭터:

스토리 구조 (도입-전개-결말):

핵심 갈등:

주제:

톤 & 스타일:

기획 의도:`;

// ─── Export HTML builder ──────────────────────────────────────────────────────

function buildExportHtml(
  scenes: Scene[],
  synopsisSections: SynopsisSections,
  topSummary: string[]
): string {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const synopsisRows = synopsisSectionMeta
    .filter(({ key }) => synopsisSections[key])
    .map(
      ({ label, key }) => `
      <tr>
        <td class="label">${label}</td>
        <td>${synopsisSections[key]}</td>
      </tr>`
    )
    .join("");

  const sceneCards = scenes
    .map(
      (scene, idx) => `
    <div class="scene-card">
      <div class="scene-img-wrap">
        <img src="${scene.imageUrl}" alt="${scene.title}" />
      </div>
      <div class="scene-body">
        <div class="scene-num">SCENE ${idx + 1}</div>
        <div class="scene-title">${scene.title}</div>
        <p class="scene-desc">${scene.description || "—"}</p>
      </div>
    </div>`
    )
    .join("");

  const summaryHtml = topSummary.filter(Boolean).length
    ? `<div class="summary-banner">
        <span class="summary-label">전체 줄거리 요약</span>
        <p>${topSummary.filter(Boolean).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>스토리보드</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; background: #f8f9fa; color: #1a1a2e; padding: 0; }
    .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); color: white; text-align: center; padding: 60px 40px; page-break-after: always; }
    .cover-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #a5b4fc; border: 1px solid #6366f1; border-radius: 100px; padding: 6px 20px; margin-bottom: 32px; }
    .cover h1 { font-size: 48px; font-weight: 800; letter-spacing: -1px; line-height: 1.15; margin-bottom: 20px; }
    .cover-date { font-size: 14px; color: #a5b4fc; margin-top: 16px; }
    .cover-divider { width: 60px; height: 3px; background: #6366f1; border-radius: 2px; margin: 24px auto; }
    .content { max-width: 960px; margin: 0 auto; padding: 60px 40px; }
    .section-heading { font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #6366f1; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e0e7ff; }
    .summary-banner { background: #eef2ff; border-left: 4px solid #6366f1; border-radius: 8px; padding: 18px 24px; margin-bottom: 28px; }
    .summary-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #6366f1; margin-bottom: 8px; }
    .summary-banner p { font-size: 14px; line-height: 1.8; color: #374151; }
    .synopsis-table { width: 100%; border-collapse: collapse; margin-bottom: 60px; }
    .synopsis-table tr { border-bottom: 1px solid #e5e7eb; }
    .synopsis-table td { padding: 14px 12px; font-size: 14px; line-height: 1.75; color: #374151; vertical-align: top; }
    .synopsis-table td.label { width: 130px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #6366f1; white-space: nowrap; padding-top: 16px; }
    .scenes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .scene-card { background: white; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); page-break-inside: avoid; }
    .scene-img-wrap { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: #f3f4f6; }
    .scene-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .scene-body { padding: 16px 18px 20px; }
    .scene-num { font-size: 10px; font-weight: 700; letter-spacing: 3px; color: #6366f1; margin-bottom: 6px; }
    .scene-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .scene-desc { font-size: 13px; line-height: 1.75; color: #4b5563; }
    .footer { text-align: center; padding: 40px 0 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; margin-top: 60px; }
    @media print {
      body { background: white; }
      .cover { min-height: 100svh; }
      .content { padding: 40px 30px; }
      .scene-card { box-shadow: none; }
      @page { margin: 0; size: A4 portrait; }
      .scenes-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-badge">AI Storyboard</div>
    <h1>스토리보드</h1>
    <div class="cover-divider"></div>
    <div class="cover-date">${today} · 총 ${scenes.length}개 씬</div>
  </div>
  <div class="content">
    ${summaryHtml ? `<div class="section-heading">시놉시스</div>${summaryHtml}` : ""}
    ${synopsisRows ? `<table class="synopsis-table"><tbody>${synopsisRows}</tbody></table>` : ""}
    <div class="section-heading">스토리보드 씬</div>
    <div class="scenes-grid">${sceneCards}</div>
    <div class="footer">AI Storyboard Generator &nbsp;·&nbsp; ${today}</div>
  </div>
  <script>window.addEventListener("load", () => { setTimeout(() => window.print(), 400); });</script>
</body>
</html>`;
}

// ─── ApiKeyPanel ──────────────────────────────────────────────────────────────

function ApiKeyPanel({
  apiKey,
  onChange,
}: {
  apiKey: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, apiKey);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    onChange("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-800">
          Gemini API 키 설정
        </h2>
      </div>
      <p className="mb-3 text-xs leading-5 text-amber-700">
        이미지 생성에는 Google Gemini API 키가 필요합니다.{" "}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline hover:text-amber-900"
        >
          Google AI Studio
        </a>
        에서 무료로 발급받을 수 있습니다. 키는 이 브라우저에만 저장되며 서버에
        보관되지 않습니다.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChange(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 pr-10 text-sm text-gray-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saved ? "저장됨 ✓" : "저장"}
        </button>
        {apiKey && (
          <button
            onClick={handleClear}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            지우기
          </button>
        )}
      </div>
      {apiKey && (
        <p className="mt-2 text-xs text-amber-600">
          ✓ API 키가 입력되었습니다. 저장 버튼을 누르면 다음 방문에도 유지됩니다.
        </p>
      )}
    </div>
  );
}

// ─── SynopsisCard ─────────────────────────────────────────────────────────────

function SynopsisCard({
  sections,
  topSummary,
}: {
  sections: SynopsisSections;
  topSummary: string[];
}) {
  const hasContent = Object.values(sections).some((v) => v.trim());

  if (!hasContent && topSummary.every((s) => !s)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
        줄거리를 생성하면 여기에 정리된 시놉시스가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {topSummary.some((s) => s) && (
        <div className="border-b border-indigo-100 bg-indigo-50/60 px-8 py-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            전체 줄거리 요약
          </p>
          <p className="text-sm leading-8 text-gray-700">
            {topSummary.filter(Boolean).join("  ·  ")}
          </p>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {synopsisSectionMeta.map(({ label, key }) => {
          const value = sections[key];
          if (!value) return null;
          return (
            <div key={key} className="flex gap-4 px-8 py-5">
              <span className="mt-0.5 w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-indigo-500">
                {label}
              </span>
              <p className="flex-1 text-sm leading-7 text-gray-700">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CustomStylePanel ─────────────────────────────────────────────────────────

function CustomStylePanel({
  prompt,
  onPromptChange,
  referenceImage,
  onImageChange,
  onImageRemove,
}: {
  prompt: string;
  onPromptChange: (v: string) => void;
  referenceImage: ReferenceImage | null;
  onImageChange: (img: ReferenceImage) => void;
  onImageRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("파일 크기는 10MB 이하여야 합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const [header, base64] = dataUrl.split(",");
      const mimeType = header.replace("data:", "").replace(";base64", "");
      onImageChange({ base64, mimeType, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-violet-700">
          커스텀 스타일 프롬프트{" "}
          <span className="font-normal text-gray-500">
            (이미지 생성 시 프롬프트 앞에 자동 삽입됩니다)
          </span>
        </label>
        <textarea
          rows={3}
          placeholder="예) Ghibli-style soft watercolor, dreamy pastel backgrounds, hand-drawn characters"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm leading-6 text-gray-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200 placeholder:text-gray-400"
        />
        <p className="mt-1 text-xs text-gray-400">
          💡 영문으로 작성하면 이미지 품질이 높아집니다.
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-violet-700">
          참조 이미지{" "}
          <span className="font-normal text-gray-500">
            (선택 · 업로드하면 해당 이미지의 스타일을 참고해 생성합니다)
          </span>
        </label>
        {referenceImage ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referenceImage.previewUrl}
              alt="참조 이미지 미리보기"
              className="h-36 w-auto rounded-lg border border-violet-200 object-cover shadow-sm"
            />
            <button
              onClick={onImageRemove}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-white shadow hover:bg-gray-900 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="mt-1.5 text-xs text-gray-400">
              {referenceImage.mimeType} ·{" "}
              {Math.round((referenceImage.base64.length * 3) / 4 / 1024)} KB
            </p>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition select-none ${
              isDragging
                ? "border-violet-400 bg-violet-100"
                : "border-violet-200 bg-white hover:border-violet-400 hover:bg-violet-50"
            }`}
          >
            <ImagePlus className="h-6 w-6 text-violet-400" />
            <p className="text-xs text-gray-500">클릭하거나 이미지를 드래그해서 업로드</p>
            <p className="text-xs text-gray-400">PNG · JPG · WEBP (최대 10MB)</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [imageStyle, setImageStyle] = useState<ImageStyleValue>("live_action");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>("16:9");
  const [customStylePrompt, setCustomStylePrompt] = useState("");
  const [customReferenceImage, setCustomReferenceImage] = useState<ReferenceImage | null>(null);
  const [synopsisSections, setSynopsisSections] = useState<SynopsisSections>({
    logline: "",
    worldBackground: "",
    mainCharacters: "",
    storyStructure: "",
    coreConflict: "",
    theme: "",
    toneStyle: "",
    planningIntent: "",
  });
  const [topSummary, setTopSummary] = useState<string[]>(Array(6).fill(""));
  const [scenes, setScenes] = useState<Scene[]>(emptyScenes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [updatingImageIndexes, setUpdatingImageIndexes] = useState<number[]>([]);

  // 로컬스토리지에서 저장된 API 키 불러오기
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setApiKey(saved);
    }
  }, []);

  const canGenerate = useMemo(
    () => synopsis.trim().length > 0 && apiKey.trim().length > 0,
    [synopsis, apiKey]
  );

  const canExport = useMemo(
    () => scenes.some((s) => s.imageUrl !== defaultImageDataUrl && s.description),
    [scenes]
  );

  const setImageLoading = (index: number, loading: boolean) => {
    setUpdatingImageIndexes((prev) => {
      const exists = prev.includes(index);
      if (loading && !exists) return [...prev, index];
      if (!loading && exists) return prev.filter((i) => i !== index);
      return prev;
    });
  };

  const handleExport = useCallback(() => {
    const html = buildExportHtml(scenes, synopsisSections, topSummary);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    }
  }, [scenes, synopsisSections, topSummary]);

  const buildImageRequestBody = (scene: Scene, index: number, style: ImageStyleValue) => {
    const base: Record<string, unknown> = {
      sceneIndex: index,
      sceneTitle: scene.title,
      sceneDescription: scene.description,
      scenePrompt: scene.imagePrompt,
      imageStyle: style,
      aspectRatio,
      geminiApiKey: apiKey,
    };
    if (style === "custom") {
      base.customStylePrompt = customStylePrompt;
      if (customReferenceImage) {
        base.customReferenceImageBase64 = customReferenceImage.base64;
        base.customReferenceImageMimeType = customReferenceImage.mimeType;
      }
    }
    return base;
  };

  const requestSceneImage = async (scene: Scene, index: number, style: ImageStyleValue) => {
    const res = await fetch("/api/regenerate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildImageRequestBody(scene, index, style)),
    });
    const data = await res.json();
    if (!res.ok || !data.imageUrl) throw new Error(data?.error ?? "이미지 생성 실패");
    return data.imageUrl as string;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerationStatus("줄거리를 작성하는 중...");
    try {
      const res = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synopsis, geminiApiKey: apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "텍스트 생성 실패");

      setSynopsisSections(data.synopsisSections);
      setTopSummary(data.topSummary.slice(0, 6));

      const nextScenes: Scene[] = Array.from({ length: 7 }).map((_, idx) => ({
        title: data.scenes[idx]?.title ?? `Scene ${idx + 1}`,
        description: data.scenes[idx]?.description ?? "",
        imagePrompt: data.scenes[idx]?.imagePrompt ?? "",
        imageUrl: defaultImageDataUrl,
      }));
      setScenes(nextScenes);

      setGenerationStatus("이미지를 그리는 중...");
      setUpdatingImageIndexes(Array.from({ length: 7 }, (_, i) => i));

      const imageErrors: string[] = [];
      for (let idx = 0; idx < nextScenes.length; idx += 1) {
        try {
          const imageUrl = await requestSceneImage(nextScenes[idx], idx, imageStyle);
          setScenes((prev) =>
            prev.map((scene, sceneIdx) =>
              sceneIdx === idx ? { ...scene, imageUrl } : scene
            )
          );
        } catch (error) {
          imageErrors.push(
            `씬 ${idx + 1}: ${error instanceof Error ? error.message : "이미지 생성 실패"}`
          );
        } finally {
          setImageLoading(idx, false);
        }
      }

      if (imageErrors.length > 0) {
        alert(`일부 이미지 생성에 실패했습니다.\n${imageErrors.slice(0, 3).join("\n")}`);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
      setUpdatingImageIndexes([]);
    }
  };

  const handleEditText = (index: number) => {
    const current = scenes[index];
    const nextText = window.prompt("장면 텍스트를 수정해 주세요.", current.description);
    if (!nextText) return;
    setScenes((prev) =>
      prev.map((scene, idx) => idx === index ? { ...scene, description: nextText } : scene)
    );
  };

  const handleRegenerateImage = async (index: number) => {
    setImageLoading(index, true);
    try {
      const imageUrl = await requestSceneImage(scenes[index], index, imageStyle);
      setScenes((prev) =>
        prev.map((scene, idx) => idx === index ? { ...scene, imageUrl } : scene)
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "이미지 재실행 중 오류가 발생했습니다.");
    } finally {
      setImageLoading(index, false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-6 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-6xl space-y-6">

        {/* ── API Key Panel ──────────────────────────────────── */}
        <ApiKeyPanel apiKey={apiKey} onChange={setApiKey} />

        {/* ── Input Section ──────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h1 className="text-xl font-semibold">AI 스토리보드 자동 생성</h1>
          </div>

          <label className="mb-2 block text-sm font-medium text-gray-700">
            시놉시스 입력
          </label>
          <div className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-gray-700">
            <p className="font-medium text-indigo-700">시놉시스 작성 항목</p>
            <p className="mt-1 leading-6">
              로그라인, 세계관 / 배경, 주요 캐릭터, 스토리 구조 (도입-전개-결말),
              핵심 갈등, 주제, 톤 & 스타일, 기획 의도
            </p>
          </div>
          <textarea
            className="h-64 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            placeholder={synopsisTemplate}
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
          />

          {/* ── Image Style ──────────────────────────────────── */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              이미지 스타일
            </label>
            <p className="mb-2 text-xs text-gray-500">
              선택한 스타일이 7개 씬 이미지 전체에 일관되게 적용됩니다.
            </p>
            <div className="relative inline-block">
              <select
                value={imageStyle}
                onChange={(e) => setImageStyle(e.target.value as ImageStyleValue)}
                className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-4 pr-9 text-sm font-medium text-gray-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 cursor-pointer"
              >
                {IMAGE_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
            {imageStyle === "custom" && (
              <CustomStylePanel
                prompt={customStylePrompt}
                onPromptChange={setCustomStylePrompt}
                referenceImage={customReferenceImage}
                onImageChange={setCustomReferenceImage}
                onImageRemove={() => setCustomReferenceImage(null)}
              />
            )}
          </div>

          {/* ── Aspect Ratio ─────────────────────────────────── */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              이미지 종횡비
            </label>
            <p className="mb-2 text-xs text-gray-500">
              생성되는 이미지의 가로세로 비율을 선택합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    aspectRatio === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-300 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Generate Button ───────────────────────────────── */}
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              title={!apiKey.trim() ? "API 키를 먼저 입력해 주세요" : ""}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "생성 중..." : "줄거리 생성하기"}
            </button>
            {!apiKey.trim() && (
              <p className="text-xs text-amber-600">⚠ API 키를 먼저 입력하고 저장해 주세요</p>
            )}
          </div>

          {isGenerating && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              {generationStatus || "생성 중..."}
            </div>
          )}
        </section>

        {/* ── Synopsis ───────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">정리된 시놉시스</h2>
          <SynopsisCard sections={synopsisSections} topSummary={topSummary} />
        </section>

        {/* ── Storyboard Scenes ──────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">스토리보드 7개 씬</h2>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              스토리보드 출력 / PDF
            </button>
          </div>

          {scenes.map((scene, index) => {
            const isImageLoading = updatingImageIndexes.includes(index);
            const currentAspect = ASPECT_RATIO_OPTIONS.find(o => o.value === aspectRatio);
            return (
              <article
                key={`scene-${index}`}
                className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2"
              >
                <div className={`relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 ${currentAspect?.aspect ?? "aspect-video"}`}>
                  {isImageLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                        <p className="text-sm font-medium text-indigo-700">그림을 그리는 중...</p>
                      </div>
                    </div>
                  )}
                  <Image
                    src={scene.imageUrl}
                    alt={`${scene.title} generated image`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-base font-semibold">{scene.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-gray-700">
                    {scene.description || "-"}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleEditText(index)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition hover:bg-gray-100"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      텍스트 수정
                    </button>
                    <button
                      onClick={() => handleRegenerateImage(index)}
                      disabled={isImageLoading}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isImageLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      이미지 재실행
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
