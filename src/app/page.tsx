"use client";

import Image from "next/image";
import { ChevronDown, ImagePlus, Loader2, Printer, PenLine, RefreshCw, Sparkles, X } from "lucide-react";
import { useRef, useMemo, useState, useCallback } from "react";

// --- Types (엄격하게 정의) ---
type SynopsisSectionKey = "logline" | "worldBackground" | "mainCharacters" | "storyStructure" | "coreConflict" | "theme" | "toneStyle" | "planningIntent";
interface Scene { title: string; description: string; imagePrompt: string; imageUrl: string; }
type SynopsisSections = Record<SynopsisSectionKey, string>;

// --- Constants ---
const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "📺 가로형 (16:9)" },
  { value: "4:3",  label: "📺 표준 (4:3)" },
  { value: "1:1",  label: "📱 정방형 (1:1)" },
  { value: "9:16", label: "📱 세로형 (9:16)" },
] as const;

export default function Home() {
  const [synopsis, setSynopsis] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9"); // 비율 상태 추가
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>(Array.from({ length: 7 }).map((_, i) => ({
    title: `Scene ${i + 1}`, description: "", imagePrompt: "", 
    imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><rect width='1280' height='720' fill='%23E5E7EB'/></svg>"
  })));

  const handleGenerate = async () => {
    if (!synopsis.trim()) return;
    setIsGenerating(true);
    try {
      // 1. 텍스트 생성
      const res = await fetch("/api/generate-text", { method: "POST", body: JSON.stringify({ synopsis }) });
      const data = await res.json();
      setScenes(data.scenes.map((s: Scene) => ({ ...s, imageUrl: scenes[0].imageUrl })));
      
      // 2. 이미지 생성 (비율 값 포함)
      for (let i = 0; i < data.scenes.length; i++) {
        const imgRes = await fetch("/api/regenerate-image", { 
          method: "POST", 
          body: JSON.stringify({ scenePrompt: data.scenes[i].imagePrompt, aspectRatio }) 
        });
        const imgData = await imgRes.json();
        setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, imageUrl: imgData.imageUrl } : s));
      }
    } catch (e) { alert("생성 중 오류 발생"); } finally { setIsGenerating(false); }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-indigo-600"><Sparkles /> AI 스토리보드 생성기</h1>
          <textarea className="w-full h-48 border rounded-xl p-4 mb-6 focus:ring-2 focus:ring-indigo-200 outline-none" placeholder="시놉시스를 입력하세요..." value={synopsis} onChange={e => setSynopsis(e.target.value)} />
          
          {/* 🔽 여기가 새로 생기는 비율 선택창입니다! */}
          <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <label className="block text-sm font-bold mb-3 text-gray-700">이미지 비율 설정</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ASPECT_RATIO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAspectRatio(opt.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    aspectRatio === opt.value ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg">
            {isGenerating ? "AI가 열심히 작업 중입니다..." : "스토리보드 생성 시작"}
          </button>
        </section>

        <section className="space-y-6">
          {scenes.map((scene, i) => (
            <div key={i} className="bg-white p-5 border rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center shadow-sm">
              <div className="relative aspect-video rounded-xl overflow-hidden border">
                <img src={scene.imageUrl} className="w-full h-full object-cover" alt="scene" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-3 text-gray-800">{scene.title}</h3>
                <p className="text-gray-600 leading-relaxed">{scene.description || "줄거리를 입력하면 이곳에 내용이 채워집니다."}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}