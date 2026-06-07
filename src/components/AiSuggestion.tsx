"use client";

import { useState } from "react";

interface Props {
  data: {
    targetFish: string[];
    fishReason: string;
    techniques: { name: string; description: string; suitability: string }[];
    gear: { rod: string; reel: string; line: string; hook: string };
    baits: { name: string; type: string; reason: string }[];
    bestSpots: string;
    timing: string;
    warnings: string;
    overallScore: number;
    scoreReason: string;
  };
}

const suitabilityColor: Record<string, string> = {
  高: "text-green-400 bg-green-900/30",
  中: "text-yellow-400 bg-yellow-900/30",
  低: "text-red-400 bg-red-900/30",
};

export default function AiSuggestion({ data }: Props) {
  const [activeTab, setActiveTab] = useState<"fish" | "technique" | "gear" | "bait">("fish");

  const tabs = [
    { id: "fish", label: "目標魚種", icon: "🐟" },
    { id: "technique", label: "釣法", icon: "🎯" },
    { id: "gear", label: "釣具", icon: "🎣" },
    { id: "bait", label: "釣餌", icon: "🪱" },
  ];

  const scoreColor = data.overallScore >= 80 ? "text-green-400" : data.overallScore >= 60 ? "text-yellow-400" : "text-red-400";
  const scoreGradient = data.overallScore >= 80 ? "from-green-500" : data.overallScore >= 60 ? "from-yellow-500" : "from-red-500";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sky-300 font-bold text-lg">🤖 AI 釣魚建議</h3>
        <div className="text-right">
          <div className={`text-2xl font-bold ${scoreColor}`}>{data.overallScore}分</div>
          <div className="text-sky-600 text-xs">今日釣魚指數</div>
        </div>
      </div>

      {/* 分數進度條 */}
      <div className="mb-4">
        <div className="h-2 bg-sky-950 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${scoreGradient} to-sky-500 rounded-full transition-all duration-1000`}
            style={{ width: `${data.overallScore}%` }}
          />
        </div>
        <p className="text-sky-500 text-xs mt-1">{data.scoreReason}</p>
      </div>

      {/* 快速資訊 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="glass-light rounded-xl p-3">
          <div className="text-sky-500 text-xs mb-1">⏰ 最佳時段</div>
          <div className="text-sky-200 text-sm">{data.timing}</div>
        </div>
        <div className="glass-light rounded-xl p-3">
          <div className="text-sky-500 text-xs mb-1">📍 建議釣位</div>
          <div className="text-sky-200 text-sm">{data.bestSpots}</div>
        </div>
      </div>

      {/* Tab 導覽 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
              activeTab === t.id
                ? "bg-sky-600 text-white"
                : "glass-light text-sky-400 hover:bg-sky-900/40"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab 內容 */}
      <div className="animate-fade-in-up">
        {activeTab === "fish" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {data.targetFish.map((fish) => (
                <span key={fish} className="px-3 py-1.5 bg-sky-700/40 border border-sky-600/30 rounded-full text-sky-300 text-sm font-medium">
                  🐟 {fish}
                </span>
              ))}
            </div>
            <p className="text-sky-400 text-sm leading-relaxed glass-light rounded-xl p-3">{data.fishReason}</p>
          </div>
        )}

        {activeTab === "technique" && (
          <div className="space-y-3">
            {data.techniques.map((t) => (
              <div key={t.name} className="glass-light rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sky-200 font-medium">{t.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${suitabilityColor[t.suitability] || "text-sky-400 bg-sky-900/30"}`}>
                    {t.suitability}適合
                  </span>
                </div>
                <p className="text-sky-400 text-sm">{t.description}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "gear" && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.gear).map(([key, value]) => {
              const labels: Record<string, string> = { rod: "🎣 釣竿", reel: "⚙️ 捲線器", line: "🧵 釣線", hook: "🪝 魚鉤" };
              return (
                <div key={key} className="glass-light rounded-xl p-3">
                  <div className="text-sky-500 text-xs mb-1">{labels[key] || key}</div>
                  <div className="text-sky-200 text-sm">{value}</div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "bait" && (
          <div className="space-y-3">
            {data.baits.map((b) => (
              <div key={b.name} className="glass-light rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sky-200 font-medium">{b.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full">{b.type}</span>
                </div>
                <p className="text-sky-400 text-sm">{b.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 警告 */}
      {data.warnings && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
          <p className="text-yellow-400 text-sm">⚠️ {data.warnings}</p>
        </div>
      )}
    </div>
  );
}
