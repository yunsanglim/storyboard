"use client";

import Image from "next/image";
import { Loader2, PenLine, RefreshCw, Sparkles } from "lucide-react";
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

const synopsisSectionMeta: { label: string; key: SynopsisSectionKey }[] = [
  { label: "로그라인", key: "logline" },
  { label: "세계관 / 배경", key: "worldBackground" },
  { label: "주요 캐릭터", key: "mainCharacters" },
  { label: "스토리 구조 (도입-전개-결말)", key: "storyStructure" },
  { label: "핵심 갈등", key: "coreConflict" },
  { label: "주제", key: "theme" },
  { label: "톤 & 스타일", key: "toneStyle" },
  { label: "기획 의도", key: "planningIntent" }
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
  imageUrl: defaultImageDataUrl
}));

const synopsisTemplate = `로그라인:

세계관 / 배경:

주요 캐릭터:

스토리 구조 (도입-전개-결말):

핵심 갈등:

주제:

톤 & 스타일:

기획 의도:`;

export default function Home() {
  const [synopsis, setSynopsis] = useState("");
  const [synopsisSections, setSynopsisSections] = useState<
    Record<SynopsisSectionKey, string>
  >({
    logline: "",
    worldBackground: "",
    mainCharacters: "",
    storyStructure: "",
    coreConflict: "",
    theme: "",
    toneStyle: "",
    planningIntent: ""
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

  const requestSceneImage = async (scene: Scene, index: number) => {
    const res = await fetch("/api/regenerate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneIndex: index,
        sceneTitle: scene.title,
        sceneDescription: scene.description,
        scenePrompt: scene.imagePrompt
      })
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
        body: JSON.stringify({ synopsis })
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
        imageUrl: defaultImageDataUrl
      }));
      setScenes(nextScenes);

      setGenerationStatus("이미지를 그리는 중...");
      setUpdatingImageIndexes(Array.from({ length: 7 }, (_, i) => i));

      const imageErrors: string[] = [];
      for (let idx = 0; idx < nextScenes.length; idx += 1) {
        try {
          const imageUrl = await requestSceneImage(nextScenes[idx], idx);
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
          `일부 이미지 생성에 실패했습니다.\n${imageErrors
            .slice(0, 3)
            .join("\n")}`
        );
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
    const nextText = window.prompt(
      "장면 텍스트를 수정해 주세요.",
      current.description
    );
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
      const imageUrl = await requestSceneImage(scenes[index], index);
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
          <div className="mt-4 flex items-center gap-2">
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

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">자동 정리된 시놉시스</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {synopsisSectionMeta.map((section) => (
              <div
                key={section.key}
                className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm"
              >
                <p className="mb-1 font-semibold text-gray-900">{section.label}</p>
                <p className="leading-6 text-gray-700">
                  {synopsisSections[section.key] || "-"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">시놉시스 / 전체 줄거리 요약</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {topSummary.map((item, index) => (
              <div
                key={`summary-${index}`}
                className="rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 shadow-sm"
              >
                {item || "-"}
              </div>
            ))}
          </div>
        </section>

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
