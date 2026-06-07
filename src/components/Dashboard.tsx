"use client";

import { useState, useEffect } from "react";

interface Props { onBack: () => void; }

export default function Dashboard({ onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" /></div>
  );

  if (!data || data.totalSessions === 0) return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sky-500 hover:text-sky-300 text-sm">← 返回</button>
        <h2 className="text-sky-300 font-bold text-xl">📊 個人數據</h2>
      </div>
      <div className="glass rounded-2xl p-10 text-center">
        <div className="text-5xl mb-3">📊</div>
        <p className="text-sky-400 font-medium mb-1">還沒有任何數據</p>
        <p className="text-sky-600 text-sm">記錄幾次出釣後，這裡會顯示你的釣魚分析</p>
      </div>
    </div>
  );

  const maxMonthly = Math.max(...(data.monthlyStats || []).map((m: any) => m.catches || 0), 1);

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sky-500 hover:text-sky-300 text-sm">← 返回</button>
        <h2 className="text-sky-300 font-bold text-xl">📊 個人數據儀表板</h2>
      </div>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { icon: "🎣", label: "出釣次數", value: data.totalSessions },
          { icon: "🐟", label: "總漁獲", value: data.totalCatch },
          { icon: "🦈", label: "魚種數", value: data.speciesCount },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl mb-1">{s.icon}</div>
            <div className="text-sky-200 font-bold text-2xl">{s.value}</div>
            <div className="text-sky-600 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 最佳月份 */}
      {data.bestMonth && (
        <div className="glass rounded-2xl p-4 mb-4 border border-sky-600/20 flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <p className="text-sky-300 font-bold">最佳月份：{data.bestMonth.month}</p>
            <p className="text-sky-500 text-sm">出釣 {data.bestMonth.sessions} 次，釣獲 {data.bestMonth.catches || 0} 尾</p>
          </div>
        </div>
      )}

      {/* 月度趨勢 */}
      {data.monthlyStats?.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h3 className="text-sky-400 font-bold text-sm mb-3">📅 月度漁獲趨勢</h3>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {data.monthlyStats.map((m: any) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full bg-sky-600 rounded-t transition-all" style={{ height: `${((m.catches || 0) / maxMonthly) * 72}px`, minHeight: 2 }} />
                <div className="hidden group-hover:block absolute bottom-full mb-1 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {m.month}: {m.catches || 0} 尾
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sky-700 text-xs mt-1">
            <span>{data.monthlyStats[0]?.month}</span>
            <span>{data.monthlyStats[data.monthlyStats.length - 1]?.month}</span>
          </div>
        </div>
      )}

      {/* 魚種排行 */}
      {data.fishStats?.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h3 className="text-sky-400 font-bold text-sm mb-3">🐟 最常釣到的魚</h3>
          <div className="space-y-2">
            {data.fishStats.slice(0, 6).map((f: any, i: number) => (
              <div key={f.fish_name} className="flex items-center gap-3">
                <span className="text-sky-600 text-xs w-4">{i + 1}</span>
                <span className="text-sky-300 text-sm flex-1">{f.fish_name}</span>
                <span className="text-sky-500 text-xs">{f.times} 次</span>
                <div className="w-24 h-2 bg-sky-900 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(f.total / data.fishStats[0].total) * 100}%` }} />
                </div>
                <span className="text-sky-300 text-xs font-bold w-8 text-right">{f.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 釣法成效 */}
      {data.techniqueStats?.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h3 className="text-sky-400 font-bold text-sm mb-3">🎣 釣法成效排行</h3>
          <div className="space-y-2">
            {data.techniqueStats.map((t: any, i: number) => (
              <div key={t.technique} className="flex items-center gap-3">
                <span className="text-sky-600 text-xs w-4">{i + 1}</span>
                <span className="text-sky-300 text-sm flex-1">{t.technique}</span>
                <span className="text-sky-500 text-xs">{t.uses} 次</span>
                <span className="text-green-400 text-xs font-bold">釣 {t.catches || 0} 尾</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 常去釣點 */}
      {data.spotStats?.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h3 className="text-sky-400 font-bold text-sm mb-3">📍 常去釣點</h3>
          <div className="space-y-2">
            {data.spotStats.map((s: any, i: number) => (
              <div key={s.location_name} className="flex items-center gap-3">
                <span className="text-sky-600 text-xs w-4">{i + 1}</span>
                <span className="text-sky-300 text-sm flex-1">{s.location_name}</span>
                <span className="text-sky-500 text-xs">{s.visits} 次</span>
                <span className="text-green-400 text-xs">釣 {s.catch_total || 0} 尾</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近紀錄 */}
      {data.recentLogs?.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sky-400 font-bold text-sm mb-3">🕐 最近出釣</h3>
          <div className="space-y-2">
            {data.recentLogs.map((l: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-sky-900/30 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sky-300 text-sm">{l.location_name || "未命名"}</p>
                  <p className="text-sky-600 text-xs">{l.date} · {l.technique}</p>
                </div>
                {l.total_catch > 0
                  ? <span className="text-green-400 text-xs font-bold shrink-0">✅ {l.total_catch} 尾</span>
                  : <span className="text-sky-700 text-xs shrink-0">空手</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
