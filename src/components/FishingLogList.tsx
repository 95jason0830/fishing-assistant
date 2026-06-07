"use client";

import { useState, useEffect } from "react";

interface Log {
  id: number;
  date: string;
  location_name: string;
  water_type: string;
  weather: string;
  temperature: number;
  tide: string;
  caught_fish: string;
  quantity: number;
  weight: number;
  lure_bait: string;
  technique: string;
  notes: string;
  target_fish: string;
  created_at: string;
}

export default function FishingLogList() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Log | null>(null);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalCaught = logs.reduce((acc, l) => acc + (l.quantity || 0), 0);
  const totalSessions = logs.length;
  const successRate = totalSessions > 0
    ? Math.round((logs.filter((l) => l.quantity > 0).length / totalSessions) * 100)
    : 0;

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sky-500">載入紀錄中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 統計摘要 */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sky-300 font-bold text-lg mb-4">📊 釣魚統計</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-light rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-sky-300">{totalSessions}</div>
            <div className="text-sky-600 text-xs mt-1">出釣次數</div>
          </div>
          <div className="glass-light rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-sky-300">{totalCaught}</div>
            <div className="text-sky-600 text-xs mt-1">總釣獲數</div>
          </div>
          <div className="glass-light rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-sky-300">{successRate}%</div>
            <div className="text-sky-600 text-xs mt-1">有魚率</div>
          </div>
        </div>
      </div>

      {/* 紀錄列表 */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sky-300 font-bold text-lg mb-4">📋 釣魚日誌</h2>

        {logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🎣</div>
            <p className="text-sky-500">還沒有釣魚紀錄</p>
            <p className="text-sky-700 text-sm">完成第一次分析後開始記錄吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelected(selected?.id === log.id ? null : log)}
                className="w-full glass-light rounded-xl p-4 text-left hover:bg-sky-900/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sky-300 font-medium">{log.date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.water_type === "saltwater"
                          ? "bg-blue-900/40 text-blue-400"
                          : "bg-green-900/40 text-green-400"
                      }`}>
                        {log.water_type === "saltwater" ? "🌊 海水" : "🏞️ 淡水"}
                      </span>
                    </div>
                    <p className="text-sky-400 text-sm">{log.location_name || "未記錄地點"}</p>
                    {log.caught_fish && (
                      <p className="text-sky-300 text-sm mt-1">🐟 {log.caught_fish} × {log.quantity}尾</p>
                    )}
                  </div>
                  <div className="text-right ml-3">
                    {log.temperature && (
                      <div className="text-sky-400 text-sm">🌡️ {log.temperature}°C</div>
                    )}
                    {log.tide && (
                      <div className="text-sky-500 text-xs">{log.tide}</div>
                    )}
                    <div className={`text-xs mt-1 ${log.quantity > 0 ? "text-green-400" : "text-red-400"}`}>
                      {log.quantity > 0 ? "✅ 有釣到" : "❌ 槓龜"}
                    </div>
                  </div>
                </div>

                {/* 展開詳情 */}
                {selected?.id === log.id && (
                  <div className="mt-3 pt-3 border-t border-sky-800/30 grid grid-cols-2 gap-2 text-sm">
                    {log.lure_bait && <div><span className="text-sky-600">釣餌：</span><span className="text-sky-300">{log.lure_bait}</span></div>}
                    {log.technique && <div><span className="text-sky-600">釣法：</span><span className="text-sky-300">{log.technique}</span></div>}
                    {log.weather && <div><span className="text-sky-600">天氣：</span><span className="text-sky-300">{log.weather}</span></div>}
                    {log.target_fish && <div className="col-span-2"><span className="text-sky-600">AI目標：</span><span className="text-sky-400">{log.target_fish}</span></div>}
                    {log.notes && <div className="col-span-2 mt-1 p-2 bg-sky-950/40 rounded-lg"><span className="text-sky-500 text-xs">{log.notes}</span></div>}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
