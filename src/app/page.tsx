"use client";

import Image from "next/image";
import { ChevronDown, ImagePlus, Loader2, Printer, PenLine, RefreshCw, Sparkles, X } from "lucide-react";
import { useState } from "react";

const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "가로형 (16:9)" },
  { value: "4:3",  label: "표준 (4:3)" },
  { value: "1:1",  label: "정방형 (1:1)" },
  { value: "9:16", label: "세로형 (9:16)" },
];

export default function Home() {
  const [synopsis, setSynopsis] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenes, setScenes] = useState<any[]>(Array.from({ length: 7 }).map((_, i) => ({ 
    title: `Scene ${i + 1}`, description: "", imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><rect width='1280' height='720' fill='%23E5E7EB'/></svg>" 
  })));

  const handleGenerate = async () => {
    if (!synopsis.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-text", { method: "POST", body: JSON.stringify({ synopsis }) });
      const data = await res.json();
      const nextScenes = data.scenes.map((s: any) => ({ ...s, imageUrl: scenes[0].imageUrl }));
      setScenes(nextScenes);
      
      for (let i = 0; i < nextScenes.length; i++) {
        const imgRes = await fetch("/api/regenerate-image", { method: "POST", body: JSON.stringify({ scenePrompt: nextScenes[i].imagePrompt, aspectRatio }) });
        const imgData = await imgRes.json();
        setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, imageUrl: imgData.imageUrl } : s));
      }
    } catch (e) { alert("오류 발생"); } finally { setIsGenerating(false); }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-10 text-gray-900">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="bg-white p-8 rounded-2xl border shadow-sm">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2 text-indigo-600"><Sparkles /> AI 스토리보드 생성기</h1>
          <textarea className="w-full h-40 border rounded-xl p-4 mb-4 outline-none focus:ring-2 focus:ring-indigo-200" placeholder="여기에 시놉시스를 입력하세요..." value={synopsis} onChange={e => setSynopsis(e.target.value)} />
          <div className="mb-6">
            <label className="block text-sm font-bold mb-2 text-gray-700">이미지 비율 선택</label>
            <select className="w-full border rounded-lg p-3 bg-white" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
              {ASPECT_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
            {isGenerating ? "생성 중..." : "스토리보드 생성 시작"}
          </button>
        </section>

        <section className="grid gap-6">
          {scenes.map((scene, i) => (
            <div key={i} className="bg-white p-4 border rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center shadow-sm">
              <img src={scene.imageUrl} className="w-full aspect-video object-cover rounded-xl border" alt="scene" />
              <div>
                <h3 className="font-bold text-xl mb-2">{scene.title}</h3>
                <p className="text-gray-600 leading-relaxed">{scene.description || "줄거리를 입력하면 설명이 생성됩니다."}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}