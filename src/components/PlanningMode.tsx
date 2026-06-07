"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const WeatherDetail = dynamic(() => import("./WeatherDetail"), { ssr: false });

interface Props {
  onBack: () => void;
  onGoOnsite: (data: any) => void;
}

type PlanStep = "location" | "datetime" | "spots" | "weather" | "fish" | "technique" | "gear";

interface Spot {
  name: string;
  latitude: number;
  longitude: number;
  water_type: string;
  distance_km: number;
  description: string;
  target_fish: string;
  best_season: string;
  spot_type: string;
  difficulty: string;
  is_mine?: boolean;
}

interface FishItem {
  name: string;
  activity: string;
  reason: string;
  emoji: string;
  size: string;
  catchMethod: string;
  activeTime: string;
  peakHours: number[];
}

export default function PlanningMode({ onBack, onGoOnsite }: Props) {
  const [step, setStep] = useState<PlanStep>("location");
  const [waterType, setWaterType] = useState<"saltwater" | "freshwater" | "all">("all");
  const [gettingGps, setGettingGps] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [nearbySpots, setNearbySpots] = useState<Spot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [fishList, setFishList] = useState<FishItem[]>([]);
  const [selectedFish, setSelectedFish] = useState<string[]>([]); // 複選
  const [techniques, setTechniques] = useState<any[]>([]);
  const [selectedTechnique, setSelectedTechnique] = useState("");
  const [gearData, setGearData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  // 日期時間
  const today = new Date().toISOString().split("T")[0];
  const [planDate, setPlanDate] = useState(today);
  const [planStartHour, setPlanStartHour] = useState(6);
  const [planEndHour, setPlanEndHour] = useState(12);
  // 手動新增釣點
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [addSpotForm, setAddSpotForm] = useState({ name: "", mapUrl: "", water_type: "saltwater" });
  const [addSpotLoading, setAddSpotLoading] = useState(false);
  const [addSpotMsg, setAddSpotMsg] = useState("");
  const [addSpotResult, setAddSpotResult] = useState<any>(null);

  const steps: { id: PlanStep; label: string; icon: string }[] = [
    { id: "location", label: "定位", icon: "📡" },
    { id: "datetime", label: "時間", icon: "📅" },
    { id: "spots", label: "選釣點", icon: "📍" },
    { id: "weather", label: "天氣潮汐", icon: "🌊" },
    { id: "fish", label: "選魚種", icon: "🐟" },
    { id: "technique", label: "釣法", icon: "🎯" },
    { id: "gear", label: "裝備", icon: "🎣" },
  ];
  const stepIndex = steps.findIndex(s => s.id === step);

  // GPS 定位
  const getGpsAndSpots = async () => {
    setGettingGps(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setGettingGps(false);
        setLoading(true);
        setLoadingMsg("AI 正在搜尋附近釣點...");
        try {
          const [aiRes, scrapeRes] = await Promise.allSettled([
            fetch("/api/ai/spots-recommend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lon: longitude, waterType }),
            }).then(r => r.json()),
            fetch("/api/spots/scrape", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lon: longitude, waterType }),
            }).then(r => r.json()),
          ]);

          let allSpots: Spot[] = [];
          if (aiRes.status === "fulfilled" && aiRes.value.spots) allSpots = [...aiRes.value.spots];
          if (scrapeRes.status === "fulfilled" && scrapeRes.value.spots) {
            scrapeRes.value.spots.forEach((s: Spot) => {
              if (!allSpots.find(a => a.name === s.name)) allSpots.push(s);
            });
          }

          // 個人釣點
          const dbRes = await fetch("/api/spots/custom");
          const dbSpots = await dbRes.json();
          if (Array.isArray(dbSpots) && dbSpots.length > 0) {
            dbSpots.forEach((s: any) => {
              if (!allSpots.find(a => a.name === s.name)) {
                allSpots.unshift({ ...s, distance_km: calcDistance(latitude, longitude, s.latitude, s.longitude), spot_type: s.spot_type || "我的釣點", difficulty: s.difficulty || "入門", is_mine: true });
              }
            });
          }

          allSpots.sort((a, b) => (a.is_mine ? -1 : 0) + ((a.distance_km || 99) - (b.distance_km || 99)));
          setNearbySpots(allSpots);
          setStep("datetime");
        } catch (e: any) {
          setError(e.message || "釣點搜尋失敗");
        }
        setLoading(false);
        setLoadingMsg("");
      },
      () => { setError("無法取得 GPS 定位，請確認已開啟位置權限"); setGettingGps(false); },
      { timeout: 10000 }
    );
  };

  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(Math.sqrt(a) * R * 2 * 10) / 10;
  };

  // 手動新增釣點
  const handleAddSpot = async () => {
    if (!addSpotForm.name.trim()) { setAddSpotMsg("請輸入釣點名稱"); return; }
    if (!addSpotForm.mapUrl.trim()) { setAddSpotMsg("請貼上連結或座標"); return; }
    setAddSpotLoading(true);
    setAddSpotMsg("");
    setAddSpotResult(null);
    try {
      const r = await fetch("/api/spots/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addSpotForm),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAddSpotResult(d);
      setAddSpotMsg("✅ 釣點已儲存！");
      setAddSpotForm({ name: "", mapUrl: "", water_type: "saltwater" });
    } catch (e: any) {
      setAddSpotMsg("❌ " + e.message);
    }
    setAddSpotLoading(false);
  };

  // 選擇釣點後取得天氣
  const selectSpot = async (spot: Spot) => {
    setSelectedSpot(spot);
    setLoading(true);
    setLoadingMsg("取得天氣預報與潮汐資料...");
    setError("");
    try {
      const r = await fetch(`/api/weather?lat=${spot.latitude}&lon=${spot.longitude}&date=${planDate}&hour=${planStartHour}`);
      const w = await r.json();
      if (w.error) throw new Error(w.error);
      setWeatherData({ ...w, spotName: spot.name, spotType: spot.spot_type || "", region: spot.name, planDate, planStartHour, planEndHour });
      setStep("weather");
    } catch (e: any) {
      setError(e.message || "天氣資料取得失敗");
    }
    setLoading(false);
    setLoadingMsg("");
  };

  // 取得魚種
  const fetchFish = async () => {
    setLoading(true);
    setLoadingMsg("AI 分析魚類活動規律...");
    setError("");
    setFishList([]);
    setSelectedFish([]);
    try {
      const r = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherData, waterType: selectedSpot?.water_type || waterType }),
      });
      const d = await r.json();
      if (!d.fish || !Array.isArray(d.fish)) throw new Error("AI 回應格式錯誤，請重試");
      setFishList(d.fish);
      setWeatherData((prev: any) => ({ ...prev, bestTime: d.bestTime, warning: d.warning, seasonHighlight: d.seasonHighlight }));
      setStep("fish");
    } catch (e: any) {
      setError(e.message || "魚種分析失敗，請重試");
    }
    setLoading(false);
    setLoadingMsg("");
  };

  const toggleFish = (name: string) => {
    setSelectedFish(prev => prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]);
  };

  // 取得釣法
  const fetchTechniques = async () => {
    if (selectedFish.length === 0) { setError("請至少選擇一種目標魚種"); return; }
    setLoading(true);
    setLoadingMsg("分析最佳釣法...");
    setError("");
    try {
      const r = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherData, waterType: selectedSpot?.water_type || waterType, targetFish: selectedFish.join("、") }),
      });
      const d = await r.json();
      if (!d.techniques) throw new Error("AI 回應錯誤，請重試");
      setTechniques(d.techniques);
      setStep("technique");
    } catch (e: any) {
      setError(e.message || "釣法分析失敗");
    }
    setLoading(false);
    setLoadingMsg("");
  };

  // 取得裝備
  const fetchGear = async (tech: string) => {
    setSelectedTechnique(tech);
    setLoading(true);
    setLoadingMsg("生成完整裝備清單...");
    setError("");
    try {
      const r = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherData, waterType: selectedSpot?.water_type || waterType, targetFish: selectedFish.join("、"), technique: tech }),
      });
      const d = await r.json();
      if (!d.rod && !d.reel) throw new Error("AI 回應錯誤，請重試");
      setGearData(d);
      setStep("gear");
    } catch (e: any) {
      setError(e.message || "裝備分析失敗");
    }
    setLoading(false);
    setLoadingMsg("");
  };

  const openGoogleMaps = (spot: Spot) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=driving`, "_blank");

  const activityColor: Record<string, string> = {
    高: "border-green-600/50 bg-green-900/10",
    中: "border-yellow-600/50 bg-yellow-900/10",
    低: "border-sky-800/30 bg-transparent",
  };
  const activityBadge: Record<string, string> = {
    高: "text-green-400 bg-green-900/40",
    中: "text-yellow-400 bg-yellow-900/40",
    低: "text-sky-500 bg-sky-900/30",
  };
  const difficultyColor: Record<string, string> = {
    入門: "text-green-400 bg-green-900/30",
    進階: "text-yellow-400 bg-yellow-900/30",
    高手: "text-red-400 bg-red-900/30",
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-10 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 border-4 border-sky-400/20 border-t-sky-400 rounded-full animate-spin mx-auto mb-5" />
        <p className="text-sky-300 font-medium text-lg">{loadingMsg}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sky-500 hover:text-sky-300 text-sm">← 返回</button>
        <h2 className="text-sky-300 font-bold text-xl">📅 事前規劃</h2>
      </div>

      {/* 步驟條 */}
      <div className="flex items-center justify-between mb-8 relative px-1">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-sky-900/50 z-0" />
        <div className="absolute top-5 left-0 h-0.5 bg-sky-500 z-0 transition-all duration-700" style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }} />
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => { if (i < stepIndex) setStep(s.id); }}
            className={`relative z-10 flex flex-col items-center gap-1 ${i <= stepIndex ? "opacity-100" : "opacity-30"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all ${s.id === step ? "bg-sky-500 animate-pulse-glow" : i < stepIndex ? "bg-sky-700" : "bg-sky-950 border border-sky-800"}`}>{s.icon}</div>
            <span className={`text-xs hidden sm:block ${s.id === step ? "text-sky-300" : "text-sky-600"}`}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: GPS */}
      {step === "location" && (
        <div className="glass rounded-2xl p-6 max-w-lg mx-auto">
          <h3 className="text-sky-300 font-bold text-xl mb-1">📡 取得你的位置</h3>
          <p className="text-sky-500 text-sm mb-5">先定位，AI 搜尋附近釣點</p>
          <div className="mb-5">
            <p className="text-sky-400 text-sm mb-3">水域偏好</p>
            <div className="grid grid-cols-3 gap-2">
              {([{ val: "all", icon: "🗺️", label: "都可以" }, { val: "saltwater", icon: "🌊", label: "海水" }, { val: "freshwater", icon: "🏞️", label: "淡水" }] as const).map(t => (
                <button key={t.val} onClick={() => setWaterType(t.val)}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${waterType === t.val ? "border-sky-400 bg-sky-900/40 text-sky-300" : "border-sky-900/40 text-sky-600 hover:border-sky-700"}`}>
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <div className="text-sm font-medium">{t.label}</div>
                </button>
              ))}
            </div>
          </div>
          <button onClick={getGpsAndSpots} disabled={gettingGps}
            className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 rounded-xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2">
            {gettingGps ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />定位中...</> : "📡 GPS 定位並搜尋附近釣點"}
          </button>
          {error && <p className="text-red-400 text-sm mt-3 text-center">⚠️ {error}</p>}
        </div>
      )}

      {/* STEP 2: 預計出釣時間 */}
      {step === "datetime" && (
        <div className="glass rounded-2xl p-6 max-w-lg mx-auto">
          <h3 className="text-sky-300 font-bold text-xl mb-1">📅 預計出釣時間</h3>
          <p className="text-sky-500 text-sm mb-5">設定日期與時段，AI 將分析當天的天氣、潮汐與魚類活動</p>

          <div className="space-y-4">
            <div>
              <label className="text-sky-400 text-sm mb-2 block">出釣日期</label>
              <input type="date" value={planDate} min={today}
                onChange={e => setPlanDate(e.target.value)}
                className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-3 text-sky-200 focus:outline-none focus:border-sky-500 text-base" />
            </div>

            <div>
              <label className="text-sky-400 text-sm mb-2 block">出釣時段</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sky-600 text-xs mb-1">開始時間</p>
                  <select value={planStartHour} onChange={e => setPlanStartHour(parseInt(e.target.value))}
                    className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-3 text-sky-200 focus:outline-none focus:border-sky-500 text-sm">
                    {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-sky-600 text-xs mb-1">結束時間</p>
                  <select value={planEndHour} onChange={e => setPlanEndHour(parseInt(e.target.value))}
                    className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-3 text-sky-200 focus:outline-none focus:border-sky-500 text-sm">
                    {hours.filter(h => h > planStartHour).map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                  </select>
                </div>
              </div>
              <p className="text-sky-600 text-xs mt-2 text-center">
                共 {planEndHour - planStartHour} 小時 ·
                {planDate === today ? " 今天" : ` ${planDate}`} {String(planStartHour).padStart(2, "0")}:00 - {String(planEndHour).padStart(2, "0")}:00
              </p>
            </div>

            {/* 快速選擇時段 */}
            <div>
              <p className="text-sky-600 text-xs mb-2">常用時段快選</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "清晨場 🌅", start: 5, end: 10 },
                  { label: "上午場 ☀️", start: 8, end: 12 },
                  { label: "下午場 🌤️", start: 14, end: 18 },
                  { label: "黃昏場 🌇", start: 16, end: 20 },
                  { label: "夜釣 🌙", start: 19, end: 23 },
                  { label: "整天 📅", start: 6, end: 18 },
                ].map(t => (
                  <button key={t.label} onClick={() => { setPlanStartHour(t.start); setPlanEndHour(t.end); }}
                    className={`py-2 rounded-lg text-sm transition-all ${planStartHour === t.start && planEndHour === t.end ? "bg-sky-600 text-white" : "glass-light text-sky-400 hover:bg-sky-900/40"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => setStep("spots")} className="mt-5 w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 rounded-xl text-white font-bold transition-all">
            📍 選擇釣點 →
          </button>
        </div>
      )}

      {/* STEP 3: 選擇釣點 */}
      {step === "spots" && (
        <div className="max-w-2xl mx-auto space-y-4">
          <button onClick={() => setShowAddSpot(!showAddSpot)}
            className="w-full py-3 glass-light rounded-xl text-sky-300 hover:bg-sky-900/30 transition-all flex items-center justify-center gap-2 border border-sky-700/30 hover:border-sky-500/50">
            {showAddSpot ? "▲ 收起" : "➕ 新增我的私藏釣點"}
          </button>

          {showAddSpot && (
            <div className="glass rounded-2xl p-5 border border-sky-600/20">
              <h4 className="text-sky-300 font-bold mb-4">➕ 新增私藏釣點</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sky-500 text-xs mb-1 block">釣點名稱 *</label>
                  <input type="text" value={addSpotForm.name} onChange={e => setAddSpotForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="例：北海岸秘密礁石"
                    className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-2.5 text-sky-200 placeholder-sky-700 focus:outline-none focus:border-sky-500 text-sm" />
                </div>
                <div>
                  <label className="text-sky-500 text-xs mb-1 block">Google Maps 連結或座標 *</label>
                  <input type="text" value={addSpotForm.mapUrl} onChange={e => setAddSpotForm(p => ({ ...p, mapUrl: e.target.value }))}
                    placeholder="貼上 Google Maps 網址，或輸入 25.1234,121.5678"
                    className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-2.5 text-sky-200 placeholder-sky-700 focus:outline-none focus:border-sky-500 text-sm" />
                </div>
                <div>
                  <label className="text-sky-500 text-xs mb-1 block">水域類型</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["saltwater", "freshwater"] as const).map(t => (
                      <button key={t} onClick={() => setAddSpotForm(p => ({ ...p, water_type: t }))}
                        className={`py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${addSpotForm.water_type === t ? "border-sky-400 bg-sky-900/40 text-sky-300" : "border-sky-900/40 text-sky-600"}`}>
                        {t === "saltwater" ? "🌊 海水" : "🏞️ 淡水"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sky-600 text-xs text-center">其他資訊由 AI 自動分析填入</p>
                {addSpotMsg && <p className={`text-sm text-center ${addSpotMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{addSpotMsg}</p>}
                {addSpotResult?.aiInfo && (
                  <div className="bg-sky-950/50 border border-sky-700/30 rounded-xl p-3 space-y-1">
                    <p className="text-sky-400 text-xs font-medium">🤖 AI 分析完成</p>
                    <p className="text-sky-300 text-xs">📝 {addSpotResult.aiInfo.description}</p>
                    <p className="text-sky-300 text-xs">🐟 {addSpotResult.aiInfo.target_fish}</p>
                    <p className="text-sky-500 text-xs">📅 {addSpotResult.aiInfo.best_season} ｜ {addSpotResult.aiInfo.difficulty}</p>
                  </div>
                )}
                <button onClick={handleAddSpot} disabled={addSpotLoading}
                  className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl text-white font-medium flex items-center justify-center gap-2">
                  {addSpotLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 分析中...</> : "🤖 儲存並讓 AI 分析"}
                </button>
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sky-300 font-bold text-lg">📍 附近釣點</h3>
                <p className="text-sky-600 text-xs mt-0.5">
                  {planDate === today ? "今天" : planDate} {String(planStartHour).padStart(2, "0")}:00–{String(planEndHour).padStart(2, "0")}:00
                </p>
              </div>
              <span className="text-sky-600 text-sm">{nearbySpots.length} 個釣點</span>
            </div>
            <div className="space-y-3">
              {nearbySpots.map((spot, i) => (
                <div key={i} className={`glass-light rounded-xl p-4 border transition-all ${spot.is_mine ? "border-yellow-700/40" : "border-sky-800/20 hover:border-sky-600/40"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sky-200 font-bold">{spot.name}</span>
                        {spot.is_mine && <span className="text-xs px-2 py-0.5 bg-yellow-900/40 text-yellow-400 rounded-full">⭐ 我的</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColor[spot.difficulty] || "text-sky-400 bg-sky-900/30"}`}>{spot.difficulty}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${spot.water_type === "saltwater" ? "bg-blue-900/40 text-blue-400" : "bg-green-900/40 text-green-400"}`}>
                          {spot.water_type === "saltwater" ? "🌊 海水" : "🏞️ 淡水"}
                        </span>
                      </div>
                      <p className="text-sky-400 text-sm">{spot.description}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-sky-600">
                        {spot.target_fish && <span>🐟 {spot.target_fish}</span>}
                        {spot.distance_km && <span>📏 約 {spot.distance_km} km</span>}
                      </div>
                      <div className="mt-1 text-xs text-sky-800 font-mono">{spot.latitude?.toFixed(5)}, {spot.longitude?.toFixed(5)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openGoogleMaps(spot)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-700/40 hover:bg-blue-600/50 border border-blue-600/30 rounded-lg text-blue-300 text-sm transition-all">
                      🗺️ 導航
                    </button>
                    <button onClick={() => selectSpot(spot)}
                      className="flex-1 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-lg text-white text-sm font-bold transition-all">
                      選擇此釣點 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm mt-3">⚠️ {error}</p>}
            <button onClick={() => setStep("location")} className="mt-4 text-sky-500 text-sm w-full text-center">← 重新搜尋</button>
          </div>
        </div>
      )}

      {/* STEP 4: 天氣潮汐 */}
      {step === "weather" && weatherData && selectedSpot && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sky-300 font-bold text-lg">{selectedSpot.name}</h3>
                <p className="text-sky-500 text-sm">{planDate === today ? "今天" : planDate} · {String(planStartHour).padStart(2, "0")}:00–{String(planEndHour).padStart(2, "0")}:00</p>
              </div>
              <button onClick={() => openGoogleMaps(selectedSpot)}
                className="px-3 py-2 bg-blue-700/40 hover:bg-blue-600/50 border border-blue-600/30 rounded-xl text-blue-300 text-sm transition-all">
                🗺️ 導航
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { icon: "🌡️", label: "氣溫", value: `${weatherData.temperature}°C` },
                { icon: "🌤️", label: "天氣", value: weatherData.weatherDesc },
                { icon: "💨", label: "風況", value: `${weatherData.windDirection} ${weatherData.windSpeed}km/h` },
                { icon: "🌊", label: "潮汐", value: weatherData.tide },
                { icon: "🌙", label: "月相", value: weatherData.moonPhase },
                { icon: "🍃", label: "季節", value: `${weatherData.season}季` },
                { icon: "💧", label: "濕度", value: `${weatherData.humidity}%` },
                { icon: "🌂", label: "降雨率", value: `${weatherData.precipitation}%` },
                ...(weatherData.waterTemp ? [{ icon: "🌡️", label: "水溫", value: `${weatherData.waterTemp}°C` }] : []),
                { icon: "🔵", label: "氣壓", value: `${weatherData.pressure}hPa` },
              ].map(s => (
                <div key={s.label} className="glass-light rounded-xl p-3 text-center">
                  <div className="text-xl mb-0.5">{s.icon}</div>
                  <div className="text-sky-200 text-sm font-medium">{s.value}</div>
                  <div className="text-sky-600 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            {/* 氣壓趨勢 */}
            {weatherData.pressureAdvice && (
              <div className="glass-light rounded-xl p-3 mb-3">
                <p className="text-sky-300 text-sm">{weatherData.pressureAdvice}</p>
              </div>
            )}

            {/* 日出日落黃金時段 */}
            {weatherData.sunTimes && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="glass-light rounded-xl p-3 text-center">
                  <p className="text-yellow-400 text-xs mb-0.5">🌅 晨間黃金時段</p>
                  <p className="text-sky-200 text-sm font-bold">{weatherData.sunTimes.goldenMorning}</p>
                </div>
                <div className="glass-light rounded-xl p-3 text-center">
                  <p className="text-orange-400 text-xs mb-0.5">🌇 傍晚黃金時段</p>
                  <p className="text-sky-200 text-sm font-bold">{weatherData.sunTimes.goldenEvening}</p>
                </div>
              </div>
            )}

            {/* Solunar 月亮活動表 */}
            {weatherData.solunar && (
              <div className="glass-light rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sky-400 text-xs font-medium">🌙 Solunar 月亮活動表</p>
                  <span className="text-yellow-400 text-xs">{weatherData.solunar.ratingLabel}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {weatherData.solunar.major.map((t: any) => (
                    <div key={t.label} className="text-center">
                      <p className="text-sky-600 text-xs">{t.label}（主要）</p>
                      <p className="text-sky-200 text-sm font-bold">{t.time}</p>
                      <p className="text-sky-700 text-xs">{t.duration}分鐘</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {weatherData.solunar.minor.map((t: any) => (
                    <div key={t.label} className="text-center">
                      <p className="text-sky-700 text-xs">{t.label}（次要）</p>
                      <p className="text-sky-400 text-sm font-bold">{t.time}</p>
                    </div>
                  ))}
                </div>
                {weatherData.solunar.note && (
                  <p className="text-yellow-400 text-xs mt-2 text-center">{weatherData.solunar.note}</p>
                )}
              </div>
            )}
          </div>
          {/* 詳細氣象面板 */}
          <WeatherDetail
            lat={selectedSpot.latitude}
            lon={selectedSpot.longitude}
            date={planDate}
          />

          <button onClick={fetchFish} className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 rounded-xl text-white font-bold transition-all">
            🐟 分析此時段魚類活動 →
          </button>
        </div>
      )}

      {/* STEP 5: 選擇目標魚種（複選） */}
      {step === "fish" && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sky-300 font-bold text-lg">🐟 選擇目標魚種</h3>
                <p className="text-sky-500 text-sm">可複選，選好後按「確認」</p>
              </div>
              {selectedSpot && (
                <button onClick={() => openGoogleMaps(selectedSpot)}
                  className="px-3 py-1.5 bg-blue-700/40 border border-blue-600/30 rounded-lg text-blue-300 text-xs">
                  🗺️ 導航
                </button>
              )}
            </div>

            {weatherData?.seasonHighlight && (
              <div className="glass-light rounded-xl p-3 mb-3 border border-sky-600/20">
                <p className="text-sky-400 text-sm">🌊 <span className="text-sky-300">{weatherData.seasonHighlight}</span></p>
              </div>
            )}
            {weatherData?.bestTime && (
              <div className="glass-light rounded-xl p-3 mb-3">
                <p className="text-sky-400 text-sm">⏰ 最佳時段：<span className="text-sky-300">{weatherData.bestTime}</span></p>
              </div>
            )}
            {weatherData?.warning && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 mb-3">
                <p className="text-yellow-400 text-sm">⚠️ {weatherData.warning}</p>
              </div>
            )}

            {fishList.length === 0 && (
              <div className="text-center py-8 text-sky-500">載入中...</div>
            )}

            <div className="space-y-2">
              {fishList.map(fish => {
                const isSelected = selectedFish.includes(fish.name);
                // 判斷是否在出釣時段內活躍
                const activeInRange = fish.peakHours?.some((h: number) => h >= planStartHour && h <= planEndHour);
                return (
                  <button key={fish.name} onClick={() => toggleFish(fish.name)}
                    className={`w-full rounded-xl p-4 text-left transition-all border-2 ${isSelected ? "border-sky-400 bg-sky-900/30" : `border ${activityColor[fish.activity] || "border-sky-800/30"}`}`}>
                    <div className="flex items-start gap-3">
                      {/* 勾選框 */}
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSelected ? "bg-sky-500 border-sky-400" : "border-sky-700"}`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <span className="text-2xl">{fish.emoji || "🐟"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sky-200 font-bold">{fish.name}</span>
                          {fish.size && <span className="text-sky-600 text-xs">{fish.size}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${activityBadge[fish.activity]}`}>{fish.activity}活躍</span>
                          {activeInRange && <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-400 rounded-full">✓ 此時段出沒</span>}
                        </div>
                        <p className="text-sky-500 text-sm">{fish.reason}</p>
                        {fish.activeTime && (
                          <p className="text-sky-600 text-xs mt-1">🕐 出沒時間：{fish.activeTime}</p>
                        )}
                        {fish.catchMethod && (
                          <p className="text-sky-700 text-xs mt-0.5">🎣 {fish.catchMethod}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {error && <p className="text-red-400 text-sm mt-3">⚠️ {error}</p>}
          </div>

          {/* 確認按鈕 */}
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <div>
              {selectedFish.length > 0
                ? <p className="text-sky-300 text-sm">已選：{selectedFish.join("、")}</p>
                : <p className="text-sky-600 text-sm">請選擇至少一種魚</p>
              }
            </div>
            <button onClick={fetchTechniques} disabled={selectedFish.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-sky-600 to-blue-600 disabled:opacity-40 rounded-xl text-white font-bold transition-all">
              確認選擇 →
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: 釣法 */}
      {step === "technique" && (
        <div className="max-w-2xl mx-auto">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sky-300 font-bold text-lg">🎯 選擇釣法</h3>
                <p className="text-sky-500 text-sm">目標：{selectedFish.join("、")}</p>
              </div>
              {selectedSpot && <button onClick={() => openGoogleMaps(selectedSpot)} className="px-3 py-1.5 bg-blue-700/40 border border-blue-600/30 rounded-lg text-blue-300 text-xs">🗺️ 導航</button>}
            </div>
            <div className="space-y-3">
              {techniques.map(t => (
                <button key={t.name} onClick={() => fetchGear(t.name)}
                  className="w-full glass-light rounded-xl p-4 text-left hover:bg-sky-900/30 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sky-200 font-bold">{t.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColor[t.difficulty] || "text-sky-400 bg-sky-900/30"}`}>{t.difficulty}</span>
                      </div>
                      <p className="text-sky-500 text-sm">{t.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sky-300 font-bold">{t.effectiveness}%</div>
                      <div className="text-sky-600 text-xs">推薦度</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm mt-3">⚠️ {error}</p>}
          </div>
        </div>
      )}

      {/* STEP 7: 裝備清單 */}
      {step === "gear" && gearData && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sky-300 font-bold text-lg">🎣 完整裝備清單</h3>
                <p className="text-sky-500 text-sm">{selectedFish.join("、")} × {selectedTechnique}</p>
              </div>
              {selectedSpot && <button onClick={() => openGoogleMaps(selectedSpot)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-700/40 border border-blue-600/30 rounded-xl text-blue-300 text-sm">🗺️ 前往釣點</button>}
            </div>

            <div className="glass-light rounded-xl p-4 mb-4">
              <h4 className="text-sky-400 text-sm font-medium mb-2">📋 策略說明</h4>
              <p className="text-sky-300 text-sm leading-relaxed">{gearData.strategy}</p>
              {gearData.castingTips && <p className="text-sky-400 text-sm mt-2">🎯 {gearData.castingTips}</p>}
              {gearData.strategyDuration && <p className="text-sky-500 text-xs mt-2">⏱️ 建議每段策略執行約 <span className="text-sky-300">{gearData.strategyDuration} 分鐘</span></p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                { key: "rod", icon: "🎣", label: "釣竿" },
                { key: "reel", icon: "⚙️", label: "捲線器" },
                { key: "mainLine", icon: "🧵", label: "主線" },
                { key: "leader", icon: "📏", label: "子線" },
                { key: "hook", icon: "🪝", label: "魚鉤" },
                { key: "weight", icon: "⚖️", label: "配重" },
              ].map(item => gearData[item.key] && (
                <div key={item.key} className="glass-light rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1"><span>{item.icon}</span><span className="text-sky-500 text-xs">{item.label}</span></div>
                  <div className="text-sky-200 text-sm font-medium">{gearData[item.key].spec || gearData[item.key].type || "-"}</div>
                  {(gearData[item.key].lb || gearData[item.key].gram || gearData[item.key].length) && (
                    <div className="text-sky-400 text-xs mt-0.5">{gearData[item.key].lb && `${gearData[item.key].lb}lb`} {gearData[item.key].gram && `${gearData[item.key].gram}g`} {gearData[item.key].length && gearData[item.key].length}</div>
                  )}
                  {gearData[item.key].reason && <div className="text-sky-600 text-xs mt-1">{gearData[item.key].reason}</div>}
                </div>
              ))}
            </div>

            {gearData.baits?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sky-400 text-sm font-medium mb-2">🪱 推薦釣餌</h4>
                <div className="space-y-2">
                  {gearData.baits.map((b: any, i: number) => (
                    <div key={b.name} className="glass-light rounded-xl p-3 flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-sky-700 flex items-center justify-center text-xs text-sky-200 shrink-0">{i + 1}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sky-200 text-sm font-medium">{b.name}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-sky-900/50 text-sky-400 rounded">{b.type}</span>
                        </div>
                        {b.howTo && <p className="text-sky-500 text-xs mt-0.5">{b.howTo}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gearData.accessories?.length > 0 && (
              <div className="glass-light rounded-xl p-3 mb-4">
                <h4 className="text-sky-400 text-xs font-medium mb-2">📦 其他配件</h4>
                <div className="flex flex-wrap gap-2">
                  {gearData.accessories.map((a: string) => <span key={a} className="text-xs px-2 py-1 bg-sky-900/40 text-sky-400 rounded-full">{a}</span>)}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => openGoogleMaps(selectedSpot!)}
              className="py-4 bg-blue-700/50 hover:bg-blue-600/60 border border-blue-600/30 rounded-xl text-blue-300 font-bold flex items-center justify-center gap-2">
              🗺️ 前往釣點
            </button>
            <button onClick={() => onGoOnsite({ targetFish: selectedFish.join("、"), technique: selectedTechnique, weatherData, location: selectedSpot, gearData })}
              className="py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 rounded-xl text-white font-bold">
              📍 開始作釣 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
