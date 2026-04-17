"use client";

import Image from "next/image";
import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Printer,
  PenLine,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useMemo, useState, useCallback } from "react";

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

const IMAGE_STYLE_OPTIONS = [
  { value: "pixar",         label: "🎨 픽사 애니메이션" },
  { value: "live_action",   label: "🎬 실사 영화" },
  { value: "watercolor",     label: "🖌️ 수채화 일러스트" },
  { value: "marvel_comics", label: "💥 마블 코믹스" },
  { value: "custom",         label: "✏️ 커스텀" },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "📺 가로형 (16:9)" },
  { value: "4:3",  label: "📺 표준 (4:3)" },
  { value: "1:1",  label: "📱 정방형 (1:1)" },
  { value: "9:16", label: "📱 세로형 (9:16)" },
] as const;

type ImageStyleValue = (typeof IMAGE_STYLE_OPTIONS)[number]["value"];
type AspectRatioValue = (typeof ASPECT_RATIO_OPTIONS)[number]["value"];

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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Home() {
  const [synopsis, setSynopsis] = useState("");
  const [imageStyle, setImageStyle] = useState<ImageStyleValue>("live_action");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>("16:9");

  const [customStylePrompt, setCustomStylePrompt] = useState("");
  const [customReferenceImage, setCustomReferenceImage] = useState<ReferenceImage | null>(null);

  const [synopsisSections, setSynopsisSections] = useState<SynopsisSections>({
    logline: "", worldBackground: "", mainCharacters: "", storyStructure: "",
    coreConflict: "", theme: "", toneStyle: "", planningIntent: "",
  });
  const [topSummary, setTopSummary] = useState<string[]>(Array(6).fill(""));
  const [scenes, setScenes] = useState<Scene[]>(emptyScenes);
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingImageIndexes, setUpdatingImageIndexes] = useState<number[]>([]);

  const canGenerate = useMemo(() => synopsis.trim().length > 0, [synopsis]);
  const canExport = useMemo(() => scenes.some((s) => s.imageUrl !== defaultImageDataUrl), [scenes]);

  const requestSceneImage = async (scene: Scene, index: number, style: ImageStyleValue) => {
    const res = await fetch("/api/regenerate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneIndex: index,
        sceneTitle: scene.title,
        sceneDescription: scene.description,
        scenePrompt: scene.imagePrompt,
        imageStyle: style,
        aspectRatio: aspectRatio,
        ...(style === "custom" && {
            customStylePrompt,
            customReferenceImageBase64: customReferenceImage?.base64,
            customReferenceImageMimeType: customReferenceImage?.mimeType,
        })
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "이미지 생성 실패");
    return data.imageUrl;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synopsis }),
      });
      const data = await res.json();
      setSynopsisSections(data.synopsisSections);
      setTopSummary(data.topSummary);

      const nextScenes = data.scenes.map((s: Scene) => ({ ...s, imageUrl: defaultImageDataUrl }));
      setScenes(nextScenes);

      setUpdatingImageIndexes(nextScenes.map((_: Scene, i: number) => i));
      for (let i = 0; i < nextScenes.length; i++) {
        try {
          const url = await requestSceneImage(nextScenes[i], i, imageStyle);
          setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, imageUrl: url } : s));
        } catch (e) {
          console.error(`씬 ${i+1} 생성 실패:`, e);
        } finally {
          setUpdatingImageIndexes(prev => prev.filter(idx => idx !== i));
        }
      }
    } catch (e) {
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-xl font-bold flex items-center gap-2 text-gray-800">
            <Sparkles className="text-indigo-500" /> AI 스토리보드 자동 생성기
          </h1>
          <textarea
            className="h-48 w-full rounded-lg border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-indigo-200 text-gray-700"
            placeholder="시놉시스를 입력하세요..."
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
          />
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">이미지 스타일</label>
              <select 
                className="w-full rounded-lg border bg-white p-2.5 text-sm text-gray-700"
                value={imageStyle} 
                onChange={(e) => setImageStyle(e.target.value as ImageStyleValue)}
              >
                {IMAGE_STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">이미지 비율</label>
              <select 
                className="w-full rounded-lg border bg-white p-2.5 text-sm text-gray-700"
                value={aspectRatio} 
                onChange={(e) => setAspectRatio(e.target.value as AspectRatioValue)}
              >
                {ASPECT_RATIO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="mt-6 w-full rounded-lg bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md"
          >
            {isGenerating ? "생성 중..." : "스토리보드 생성하기"}
          </button>
        </section>

        {/* 시놉시스 섹션 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800">정리된 시놉시스</h2>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
             {Object.values(synopsisSections).some(v => v) ? (
                <div className="divide-y divide-gray-100">
                   {synopsisSectionMeta.map(({ label, key }) => synopsisSections[key] && (
                      <div key={key} className="flex gap-4 px-8 py-5">
                         <span className="w-32 shrink-0 text-xs font-bold text-indigo-500 uppercase">{label}</span>
                         <p className="text-sm text-gray-700 leading-relaxed">{synopsisSections[key]}</p>
                      </div>
                   ))}
                </div>
             ) : (
                <div className="p-8 text-center text-gray-400 text-sm">줄거리를 생성하면 시놉시스가 정리됩니다.</div>
             )}
          </div>
        </section>

        {/* 장면 리스트 */}
        <section className="space-y-4">
           <h2 className="text-lg font-bold text-gray-800">스토리보드 씬</h2>
           {scenes.map((scene, i) => (
             <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border rounded-2xl items-start shadow-sm">
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                   {updatingImageIndexes.includes(i) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                         <Loader2 className="animate-spin text-indigo-600" />
                      </div>
                   )}
                   <img src={scene.imageUrl} className="object-cover w-full h-full" alt="scene" />
                </div>
                <div className="p-2">
                   <h3 className="font-bold text-gray-800">{scene.title}</h3>
                   <p className="text-sm text-gray-600 mt-2 leading-relaxed">{scene.description || "줄거리를 입력해 주세요."}</p>
                </div>
             </div>
           ))}
        </section>
      </div>
    </main>
  );
}