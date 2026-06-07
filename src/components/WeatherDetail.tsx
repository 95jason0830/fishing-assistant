"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  lat: number;
  lon: number;
  date: string;
}

type WeatherTab = "wind" | "rain" | "clouds" | "waves" | "radar" | "tide";

const WINDY_OVERLAYS: { id: WeatherTab; label: string; icon: string; overlay: string }[] = [
  { id: "wind",   label: "風場",   icon: "💨", overlay: "wind" },
  { id: "rain",   label: "降雨",   icon: "🌧️", overlay: "rain" },
  { id: "clouds", label: "雲層",   icon: "☁️", overlay: "clouds" },
  { id: "waves",  label: "海浪",   icon: "🌊", overlay: "waves" },
];

export default function WeatherDetail({ lat, lon, date }: Props) {
  const [tab, setTab] = useState<WeatherTab>("wind");
  const [detail, setDetail] = useState<any>(null);
  const [radarIdx, setRadarIdx] = useState(0);
  const [radarError, setRadarError] = useState(false);
  const [radarLoading, setRadarLoading] = useState(true);
  const radarTimerRef = useRef<any>(null);

  useEffect(() => {
    fetch(`/api/weather/detail?lat=${lat}&lon=${lon}&date=${date}`)
      .then(r => r.json())
      .then(setDetail)
      .catch(() => {});
  }, [lat, lon, date]);

  // 雷達自動輪播（每 5 分鐘刷新一次最新圖）
  useEffect(() => {
    if (tab === "radar") {
      radarTimerRef.current = setInterval(() => {
        setRadarIdx(0);
        setRadarError(false);
        setRadarLoading(true);
      }, 5 * 60 * 1000);
    }
    return () => clearInterval(radarTimerRef.current);
  }, [tab]);

  const windyUrl = (overlay: string) =>
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=8&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;

  const currentOverlay = WINDY_OVERLAYS.find(o => o.id === tab);
  const isWindy = !!currentOverlay;

  // 潮汐最大高度（用於 bar 比例）
  const maxTide = detail?.tide?.hourly
    ? Math.max(...detail.tide.hourly.map((t: any) => t.height))
    : 3;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Tab 列 */}
      <div className="flex overflow-x-auto border-b border-sky-900/40 bg-sky-950/30">
        {[...WINDY_OVERLAYS, { id: "radar" as WeatherTab, label: "雷達", icon: "📡", overlay: "" },
                              { id: "tide"  as WeatherTab, label: "潮汐", icon: "🌊", overlay: "" }]
          .map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all border-b-2 ${tab === t.id ? "border-sky-400 text-sky-300 bg-sky-900/20" : "border-transparent text-sky-600 hover:text-sky-400"}`}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
      </div>

      {/* Windy 地圖 */}
      {isWindy && (
        <div className="relative" style={{ height: "400px" }}>
          <iframe
            key={tab}
            src={windyUrl(currentOverlay.overlay)}
            width="100%" height="100%"
            frameBorder="0"
            style={{ border: "none", display: "block" }}
            allow="fullscreen"
          />
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {currentOverlay.icon} {currentOverlay.label}圖 · 資料來源：Windy / ECMWF
          </div>
        </div>
      )}

      {/* 雷達回波 */}
      {tab === "radar" && (
        <div style={{ padding: "16px" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sky-300 font-medium">📡 雷達回波合成圖</p>
              <p className="text-sky-600 text-xs">資料來源：中央氣象署 · 每10分鐘更新</p>
            </div>
            <button onClick={() => { setRadarError(false); setRadarLoading(true); setRadarIdx(prev => (prev + 1) % (detail?.radarUrls?.length || 1)); }}
              className="px-3 py-1.5 glass-light rounded-lg text-sky-400 text-xs hover:bg-sky-900/40">
              ↻ 重整
            </button>
          </div>

          {detail?.radarUrls ? (
            <div className="relative rounded-xl overflow-hidden bg-slate-900" style={{ minHeight: 280 }}>
              {radarLoading && !radarError && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                </div>
              )}
              {radarError ? (
                <div className="flex flex-col items-center justify-center" style={{ minHeight: 280 }}>
                  <p className="text-sky-500 text-sm mb-3">⚠️ 雷達圖暫時無法載入</p>
                  <a href="https://www.cwa.gov.tw/V8/C/W/OBS/OBS_Radar.html" target="_blank" rel="noopener noreferrer"
                    className="text-sky-400 text-sm underline">前往氣象署官網查看 →</a>
                </div>
              ) : (
                <img
                  key={`${radarIdx}-${detail.radarUrls[radarIdx]}`}
                  src={detail.radarUrls[radarIdx]}
                  alt="雷達回波"
                  onLoad={() => setRadarLoading(false)}
                  onError={() => {
                    if (radarIdx < detail.radarUrls.length - 1) {
                      setRadarIdx(i => i + 1);
                    } else {
                      setRadarError(true); setRadarLoading(false);
                    }
                  }}
                  style={{ width: "100%", display: radarLoading ? "none" : "block", borderRadius: 8 }}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ minHeight: 280 }}>
              <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
            </div>
          )}

          <p className="text-sky-700 text-xs mt-2 text-center">綠色=弱降雨 黃色=中等 紅色=強降雨</p>
        </div>
      )}

      {/* 潮汐預報 */}
      {tab === "tide" && detail?.tide && (
        <div style={{ padding: "16px" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sky-300 font-medium">🌊 潮汐預報</p>
              <p className="text-sky-600 text-xs">
                最近站：{detail.tide.station} ·{" "}
                {detail.tide.source === "cwa" ? "資料來源：中央氣象署" : "預估值（設定 CWB_API_KEY 可取得真實資料）"}
              </p>
            </div>
          </div>

          {/* 高低潮事件 */}
          {detail.tide.events?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {detail.tide.events.map((e: any, i: number) => (
                <div key={i} className={`glass-light rounded-xl p-3 text-center border ${e.type === "高潮" ? "border-blue-500/30" : "border-sky-800/30"}`}>
                  <div className="text-lg mb-0.5">{e.type === "高潮" ? "🔼" : "🔽"}</div>
                  <div className={`font-bold text-sm ${e.type === "高潮" ? "text-blue-300" : "text-sky-500"}`}>{e.type}</div>
                  <div className="text-sky-400 text-xs">{e.time}</div>
                  <div className="text-sky-300 text-xs font-medium">{e.height}m</div>
                </div>
              ))}
            </div>
          )}

          {/* 24小時潮高長條圖 */}
          {detail.tide.hourly && (
            <div>
              <p className="text-sky-600 text-xs mb-2">24小時潮高變化</p>
              <div className="flex items-end gap-0.5" style={{ height: 80 }}>
                {detail.tide.hourly.map((t: any) => {
                  const pct = t.height / maxTide;
                  const isHigh = t.height > maxTide * 0.7;
                  return (
                    <div key={t.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div
                        className={`w-full rounded-t transition-all ${isHigh ? "bg-blue-500" : "bg-sky-700"}`}
                        style={{ height: `${pct * 72}px` }}
                      />
                      {/* hover tooltip */}
                      <div className="hidden group-hover:block absolute bottom-full mb-1 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {String(t.hour).padStart(2,"0")}:00 · {t.height}m
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-sky-700 text-xs mt-1">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
              </div>
            </div>
          )}

          {detail.tide.source === "estimated" && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
              <p className="text-yellow-400 text-xs">
                💡 要取得真實潮汐資料，請至
                <a href="https://opendata.cwa.gov.tw" target="_blank" rel="noopener noreferrer" className="underline mx-1">中央氣象署開放資料平台</a>
                免費申請 API Key，加入 .env.local：<code className="bg-black/30 px-1 rounded">CWB_API_KEY=你的Key</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
