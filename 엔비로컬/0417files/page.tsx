"use client";

import Image from "next/image";
import { ChevronDown, Loader2, PenLine, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

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
  { value: "pixar", label: "🎨 픽사 애니메이션" },
  { value: "live_action", label: "🎬 실사 영화" },
  { value: "watercolor", label: "🖌️ 수채화 일러스트" },
  { value: "marvel_comics", label: "💥 마블 코믹스" },
] as const;

type ImageStyleValue = (typeof IMAGE_STYLE_OPTIONS)[number]["value"];

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
      {/* Top summary banner */}
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

      {/* Synopsis sections as flowing prose */}
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

export default function Home() {
  const [synopsis, setSynopsis] = useState("");
  const [imageStyle, setImageStyle] = useState<ImageStyleValue>("live_action");
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

  const canGenerate = useMemo(() => synopsis.trim().length > 0, [synopsis]);

  const setImageLoading = (index: number, loading: boolean) => {
    setUpdatingImageIndexes((prev) => {
      const exists = prev.includes(index);
      if (loading && !exists) return [...prev, index];
      if (!loading && exists) return prev.filter((i) => i !== index);
      return prev;
    });
  };

  const requestSceneImage = async (
    scene: Scene,
    index: number,
    style: ImageStyleValue
  ) => {
    const res = await fetch("/api/regenerate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneIndex: index,
        sceneTitle: scene.title,
        sceneDescription: scene.description,
        scenePrompt: scene.imagePrompt,
        imageStyle: style,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.imageUrl) {
      throw new Error(data?.error ?? "이미지 생성 실패");
    }
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
        body: JSON.stringify({ synopsis }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "텍스트 생성 실패");
      }

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
            `씬 ${idx + 1}: ${
              error instanceof Error ? error.message : "이미지 생성 실패"
            }`
          );
        } finally {
          setImageLoading(idx, false);
        }
      }

      if (imageErrors.length > 0) {
        alert(
          `일부 이미지 생성에 실패했습니다.\n${imageErrors.slice(0, 3).join("\n")}`
        );
      }
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "생성 중 오류가 발생했습니다."
      );
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
      prev.map((scene, idx) =>
        idx === index ? { ...scene, description: nextText } : scene
      )
    );
  };

  const handleRegenerateImage = async (index: number) => {
    setImageLoading(index, true);
    try {
      const imageUrl = await requestSceneImage(scenes[index], index, imageStyle);
      setScenes((prev) =>
        prev.map((scene, idx) =>
          idx === index ? { ...scene, imageUrl } : scene
        )
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "이미지 재실행 중 오류가 발생했습니다."
      );
    } finally {
      setImageLoading(index, false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-6 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        {/* ── Input Section ─────────────────────────────────── */}
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

          {/* ── Image Style Selector ──────────────────────── */}
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
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={() => setSynopsis(synopsisTemplate)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              템플릿 넣기
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "생성 중..." : "줄거리 생성하기"}
            </button>
          </div>

          {isGenerating && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              {generationStatus || "생성 중..."}
            </div>
          )}
        </section>

        {/* ── Unified Synopsis Card ──────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">정리된 시놉시스</h2>
          <SynopsisCard sections={synopsisSections} topSummary={topSummary} />
        </section>

        {/* ── Storyboard Scenes ─────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">스토리보드 7개 씬</h2>
          {scenes.map((scene, index) => {
            const isImageLoading = updatingImageIndexes.includes(index);
            return (
              <article
                key={`scene-${index}`}
                className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2"
              >
                <div className="relative h-52 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                  {isImageLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                        <p className="text-sm font-medium text-indigo-700">
                          그림을 그리는 중...
                        </p>
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
