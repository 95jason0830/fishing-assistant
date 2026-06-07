"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import PlanningMode from "@/components/PlanningMode";
import OnsiteMode from "@/components/OnsiteMode";
import FishingLog from "@/components/FishingLog";
import Dashboard from "@/components/Dashboard";

const FishingMap = dynamic(() => import("@/components/FishingMap"), { ssr: false });

type Mode = "home" | "planning" | "onsite" | "map" | "log" | "dashboard";

export default function Home() {
  const [mode, setMode] = useState<Mode>("home");
  const [planData, setPlanData] = useState<any>(null);

  return (
    <div className="min-h-screen ocean-bg">
      {/* Header */}
      <header className="glass border-b border-sky-900/30 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMode("home")} className="flex items-center gap-3">
            <span className="text-3xl">🎣</span>
            <div className="text-left">
              <h1 className="text-lg font-bold text-sky-300">釣魚智慧助手</h1>
              <p className="text-xs text-sky-600">AI 釣魚規劃 · 現場分析</p>
            </div>
          </button>
          <div className="flex gap-1.5">
            {([
              { id: "map", label: "🗺️", title: "地圖" },
              { id: "log", label: "📔", title: "日誌" },
              { id: "dashboard", label: "📊", title: "數據" },
            ] as const).map(btn => (
              <button key={btn.id} onClick={() => setMode(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${mode === btn.id ? "bg-sky-600 text-white" : "glass-light text-sky-400"}`}>
                {btn.label} <span className="hidden sm:inline">{btn.title}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* 首頁 */}
        {mode === "home" && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4">🎣</div>
              <h2 className="text-3xl font-bold text-sky-300 mb-2">釣魚智慧助手</h2>
              <p className="text-sky-500">事前規劃 · 現場分析 · AI 策略建議</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-4">
              <button onClick={() => setMode("planning")}
                className="glass rounded-2xl p-6 text-left hover:bg-sky-900/20 transition-all border border-sky-700/20 hover:border-sky-500/40 group">
                <div className="text-4xl mb-3">📅</div>
                <h3 className="text-sky-300 font-bold text-lg mb-2">事前規劃</h3>
                <ul className="text-sky-500 text-sm space-y-1">
                  <li>· 附近釣點推薦 + 導航</li>
                  <li>· 天氣 / 潮汐 / 氣壓預報</li>
                  <li>· 月亮活動表 · 黃金時段</li>
                  <li>· 目標魚種 + 裝備清單</li>
                </ul>
                <div className="mt-4 text-sky-400 text-sm font-medium group-hover:text-sky-300">開始規劃 →</div>
              </button>

              <button onClick={() => setMode("onsite")}
                className="glass rounded-2xl p-6 text-left hover:bg-sky-900/20 transition-all border border-sky-700/20 hover:border-sky-500/40 group">
                <div className="text-4xl mb-3">📍</div>
                <h3 className="text-sky-300 font-bold text-lg mb-2">現場作釣</h3>
                <ul className="text-sky-500 text-sm space-y-1">
                  <li>· 拍裝備 / 手動輸入</li>
                  <li>· 拍釣點讓 AI 分析地形</li>
                  <li>· 即時策略 + 計時器</li>
                  <li>· 沒咬況自動調整策略</li>
                </ul>
                <div className="mt-4 text-sky-400 text-sm font-medium group-hover:text-sky-300">開始作釣 →</div>
              </button>
            </div>

            {/* 快速入口：日誌 / 數據 / 地圖 */}
            <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
              {([
                { id: "log", icon: "📔", label: "釣魚日誌", sub: "記錄漁獲" },
                { id: "dashboard", icon: "📊", label: "個人數據", sub: "分析釣況" },
                { id: "map", icon: "🗺️", label: "釣點地圖", sub: "探索釣點" },
              ] as const).map(btn => (
                <button key={btn.id} onClick={() => setMode(btn.id)}
                  className="glass rounded-xl p-4 text-center hover:bg-sky-900/20 transition-all border border-sky-700/20 hover:border-sky-500/40">
                  <div className="text-2xl mb-1">{btn.icon}</div>
                  <div className="text-sky-300 text-sm font-medium">{btn.label}</div>
                  <div className="text-sky-600 text-xs">{btn.sub}</div>
                </button>
              ))}
            </div>

            {/* 上次規劃快捷 */}
            {planData && (
              <div className="mt-4 max-w-xl mx-auto">
                <button onClick={() => setMode("onsite")}
                  className="w-full glass-light rounded-xl p-4 border border-sky-600/30 hover:border-sky-500/50 transition-all text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sky-300 font-medium text-sm">📋 繼續上次規劃</p>
                      <p className="text-sky-500 text-xs mt-0.5">目標：{planData.targetFish} · {planData.technique}</p>
                    </div>
                    <span className="text-sky-400">→</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {mode === "planning" && (
          <PlanningMode onBack={() => setMode("home")} onGoOnsite={(data) => { setPlanData(data); setMode("onsite"); }} />
        )}

        {mode === "onsite" && (
          <OnsiteMode onBack={() => setMode("home")} initialData={planData} />
        )}

        {mode === "log" && <FishingLog onBack={() => setMode("home")} />}
        {mode === "dashboard" && <Dashboard onBack={() => setMode("home")} />}

        {mode === "map" && (
          <div className="glass rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 120px)" }}>
            <div className="flex items-center justify-between p-4 border-b border-sky-900/30">
              <h2 className="text-sky-300 font-bold">🗺️ 台灣釣點地圖</h2>
              <button onClick={() => setMode("home")} className="text-sky-500 hover:text-sky-300 text-sm">← 返回</button>
            </div>
            <div style={{ height: "calc(100vh - 177px)", padding: "12px" }}>
              <FishingMap />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
