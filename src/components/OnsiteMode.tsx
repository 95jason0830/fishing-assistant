"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onBack: () => void;
  initialData?: any;
}

type OnsiteStep = "gear-input" | "gear-review" | "spot-photo" | "strategy" | "timer";
type GearInputMode = "photo" | "text";

const EMPTY_MANUAL = { rod: "", reel: "", mainLine: "", leader: "", hook: "", weight: "", float: "", baits: "", others: "" };

// 從規劃帶入的 gearData 轉成手動表單格式
function gearDataToManual(g: any) {
  if (!g) return EMPTY_MANUAL;
  return {
    rod:      g.rod?.spec      || "",
    reel:     g.reel?.spec     || "",
    mainLine: g.mainLine?.type || "",
    leader:   g.leader?.type   || "",
    hook:     g.hook?.type     || "",
    weight:   g.weight?.type   || "",
    float:    g.float?.spec    || "",
    baits:    Array.isArray(g.baits) ? g.baits.map((b: any) => b.name).join("、") : "",
    others:   Array.isArray(g.accessories) ? g.accessories.join("、") : "",
  };
}

export default function OnsiteMode({ onBack, initialData }: Props) {
  const hasGearData = !!initialData?.gearData;
  const [step, setStep] = useState<OnsiteStep>("gear-input");
  const [gearInputMode, setGearInputMode] = useState<GearInputMode>(hasGearData ? "text" : "photo");

  // 裝備照片
  const [gearPhotoBase64, setGearPhotoBase64] = useState("");
  const [gearPhotoPreview, setGearPhotoPreview] = useState("");
  const [gearAnalysis, setGearAnalysis] = useState<any>(null);
  const [gearLoading, setGearLoading] = useState(false);
  const [gearError, setGearError] = useState("");

  // 手動輸入裝備（若有規劃資料則帶入）
  const [manual, setManual] = useState(() => gearDataToManual(initialData?.gearData));

  // 釣點照片
  const [spotPhotoBase64, setSpotPhotoBase64] = useState("");
  const [spotPhotoPreview, setSpotPhotoPreview] = useState("");

  // 天氣、策略
  const [weatherData, setWeatherData] = useState(initialData?.weatherData || null);
  const [targetFish] = useState(initialData?.targetFish || "");
  const [technique] = useState(initialData?.technique || "");
  const [strategyData, setStrategyData] = useState<any>(null);
  const [previousStrategies, setPreviousStrategies] = useState<string[]>([]);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState("");
  const [timerFinished, setTimerFinished] = useState(false);

  // 計時器
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDuration, setTimerDuration] = useState(20 * 60);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!weatherData) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const r = await fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          setWeatherData(await r.json());
        } catch {}
      }, () => {});
    }
  }, []);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev >= timerDuration - 1) {
            clearInterval(intervalRef.current);
            setTimerRunning(false);
            setTimerFinished(true);
            playAlarm();
            return timerDuration;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerRunning, timerDuration]);

  const playAlarm = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.3);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc.start(); osc.stop(ctx.currentTime + 1.2);
    } catch {}
    if (Notification.permission === "granted") {
      new Notification("⏰ 策略時間到！", { body: "請確認是否有咬況？" });
    }
  };

  const handleGearPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setGearPhotoPreview(result);
      setGearPhotoBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleSpotPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setSpotPhotoPreview(result);
      setSpotPhotoBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  // AI 辨識裝備照片
  const analyzeGear = async () => {
    if (!gearPhotoBase64) { setGearError("請先拍攝裝備照片"); return; }
    setGearLoading(true); setGearError("");
    try {
      const r = await fetch("/api/ai/gear-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: gearPhotoBase64, targetFish, technique, fromPlan: initialData?.gearData }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setGearAnalysis(d);
      setStep("gear-review");
    } catch (e: any) {
      setGearError(e.message || "裝備辨識失敗，請重試");
    }
    setGearLoading(false);
  };

  // 手動輸入確認 → 轉成 gearAnalysis 格式
  const confirmManual = () => {
    const baitsArr = manual.baits ? manual.baits.split(/[,，、]/).map((b: string, i: number) => ({ name: b.trim(), type: "未知", howTo: "", priority: i + 1 })) : [];
    setGearAnalysis({
      summary: `手動輸入：${manual.rod || '竿未知'}、${manual.reel || '輪未知'}`,
      items: [
        manual.rod && `魚竿：${manual.rod}`,
        manual.reel && `捲線器：${manual.reel}`,
        manual.mainLine && `主線：${manual.mainLine}`,
        manual.leader && `子線：${manual.leader}`,
        manual.hook && `鉤子：${manual.hook}`,
        manual.weight && `鉛墜：${manual.weight}`,
        manual.float && `浮標：${manual.float}`,
        manual.baits && `餌料：${manual.baits}`,
        manual.others && `其他：${manual.others}`,
      ].filter(Boolean),
      recommendation: null,
      missing: [],
      rod: { spec: manual.rod },
      reel: { spec: manual.reel },
      mainLine: { type: manual.mainLine },
      leader: { type: manual.leader },
      hook: { type: manual.hook },
      weight: { type: manual.weight },
      float: { use: !!manual.float, spec: manual.float },
      baits: baitsArr,
      accessories: manual.others ? [manual.others] : [],
    });
    setStep("gear-review");
  };

  // AI 分析釣點 + 策略
  const analyzeSpot = async (noBites = false) => {
    setStrategyLoading(true); setStrategyError("");
    try {
      const r = await fetch("/api/ai/onsite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoBase64: spotPhotoBase64 || null,
          equipment: gearAnalysis,
          weatherData,
          targetFish,
          technique,
          previousStrategies,
          noBites,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setStrategyData(d);
      setTimerDuration((d.strategyDuration || 20) * 60);
      setTimerSeconds(0); setTimerRunning(false); setTimerFinished(false);
      setStep("strategy");
    } catch (e: any) {
      setStrategyError(e.message || "分析失敗");
    }
    setStrategyLoading(false);
  };

  const startTimer = () => {
    setTimerSeconds(0); setTimerFinished(false);
    setTimerRunning(true);
    setStep("timer");
    Notification.requestPermission();
  };

  const handleBite = (hasBite: boolean) => {
    if (hasBite) { setStep("strategy"); }
    else {
      setPreviousStrategies(prev => [...prev, strategyData?.strategy?.setup || "上一個策略"]);
      analyzeSpot(true);
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const remaining = timerDuration - timerSeconds;
  const progress = timerSeconds / timerDuration;

  const STEPS = ["gear-input", "gear-review", "spot-photo", "strategy", "timer"];
  const STEP_LABELS = ["裝備", "確認", "釣點", "策略", "計時"];
  const currentIdx = STEPS.indexOf(step);

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sky-500 hover:text-sky-300 text-sm">← 返回</button>
        <h2 className="text-sky-300 font-bold text-xl">📍 現場作釣</h2>
        {targetFish && <span className="text-sky-600 text-sm">目標：{targetFish}</span>}
      </div>

      {/* 步驟指示 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className={`flex items-center gap-1 shrink-0 text-xs px-3 py-1.5 rounded-full transition-all ${i === currentIdx ? "bg-sky-600 text-white" : i < currentIdx ? "bg-sky-900/60 text-sky-400" : "bg-sky-950/50 text-sky-700"}`}>
            {i < currentIdx && "✓ "}{label}
          </div>
        ))}
      </div>

      {/* ── STEP 1: 裝備輸入（拍照 / 手動） ── */}
      {step === "gear-input" && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sky-300 font-bold text-lg mb-1">🎣 輸入今日裝備</h3>
          <p className="text-sky-500 text-sm mb-4">AI 將根據你的裝備給出最佳搭配建議</p>

          {/* 模式切換 */}
          <div className="flex gap-2 mb-5 p-1 bg-sky-950/60 rounded-xl">
            <button onClick={() => setGearInputMode("photo")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${gearInputMode === "photo" ? "bg-sky-600 text-white" : "text-sky-500 hover:text-sky-300"}`}>
              📸 拍照辨識
            </button>
            <button onClick={() => setGearInputMode("text")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${gearInputMode === "text" ? "bg-sky-600 text-white" : "text-sky-500 hover:text-sky-300"}`}>
              ✏️ 手動輸入
            </button>
          </div>

          {/* 拍照模式 */}
          {gearInputMode === "photo" && (
            <>
              <p className="text-sky-500 text-xs mb-3">把所有帶來的竿、輪、餌、配件一起拍進去，AI 自動辨識</p>
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${gearPhotoPreview ? "border-sky-500" : "border-sky-800 hover:border-sky-600"}`}>
                  {gearPhotoPreview
                    ? <img src={gearPhotoPreview} alt="裝備" className="max-h-56 mx-auto rounded-xl object-contain" />
                    : <>
                        <div className="text-5xl mb-3">📦</div>
                        <p className="text-sky-400 font-medium">點擊拍攝裝備照片</p>
                        <p className="text-sky-600 text-sm mt-1">竿、輪、線、餌、浮標都可以</p>
                      </>}
                </div>
                <input type="file" accept="image/*" capture="environment"
                  onChange={e => e.target.files?.[0] && handleGearPhoto(e.target.files[0])} className="hidden" />
              </label>
              {gearPhotoPreview && (
                <button onClick={() => { setGearPhotoPreview(""); setGearPhotoBase64(""); }}
                  className="mt-2 text-sky-600 text-sm w-full text-center">重新拍攝</button>
              )}
              {gearError && <p className="text-red-400 text-sm mt-3">⚠️ {gearError}</p>}

              {initialData?.gearData && (
                <div className="mt-4 p-3 bg-sky-900/20 border border-sky-700/30 rounded-xl">
                  <p className="text-sky-500 text-xs mb-1">📋 規劃建議裝備（AI 會一起考慮）</p>
                  <p className="text-sky-400 text-xs">{initialData.gearData.rod?.spec} · {initialData.gearData.reel?.spec}</p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setGearAnalysis({ summary: "未填寫裝備", items: [] }); setStep("gear-review"); }}
                  className="px-4 py-3 glass-light rounded-xl text-sky-400 text-sm hover:bg-sky-900/40 transition-all">
                  略過
                </button>
                <button onClick={analyzeGear} disabled={!gearPhotoBase64 || gearLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all">
                  {gearLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 辨識中...</>
                    : "🤖 AI 辨識裝備"}
                </button>
              </div>
            </>
          )}

          {/* 手動輸入模式 */}
          {gearInputMode === "text" && (
            <>
              {hasGearData && (
                <div className="flex items-center gap-2 p-3 bg-sky-900/30 border border-sky-600/30 rounded-xl mb-4">
                  <span className="text-sky-400 text-sm">📋</span>
                  <p className="text-sky-400 text-sm flex-1">已帶入規劃建議裝備，請確認並視需要修改</p>
                  <button onClick={() => setManual(EMPTY_MANUAL)} className="text-sky-600 hover:text-sky-400 text-xs shrink-0">清空</button>
                </div>
              )}
              <div className="space-y-3">
                {[
                  { key: "rod", label: "魚竿", placeholder: "例：磯釣竿3號5.3m" },
                  { key: "reel", label: "捲線器", placeholder: "例：紡車式3000番" },
                  { key: "mainLine", label: "主線", placeholder: "例：尼龍線3號" },
                  { key: "leader", label: "子線", placeholder: "例：碳纖維2號" },
                  { key: "hook", label: "魚鉤", placeholder: "例：伊勢尼8號" },
                  { key: "weight", label: "鉛墜", placeholder: "例：中通鉛3B" },
                  { key: "float", label: "浮標", placeholder: "例：橢圓型3B（無則留空）" },
                  { key: "baits", label: "餌料", placeholder: "例：活蝦、蚯蚓（逗號分隔）" },
                  { key: "others", label: "其他配件", placeholder: "例：磯釣袋、抄網" },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-sky-500 text-xs mb-1 block">{field.label}</label>
                    <input
                      type="text"
                      value={(manual as any)[field.key]}
                      onChange={e => setManual(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-2.5 text-sky-200 text-sm placeholder-sky-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setGearAnalysis({ summary: "未填寫裝備", items: [] }); setStep("gear-review"); }}
                  className="px-4 py-3 glass-light rounded-xl text-sky-400 text-sm">
                  略過
                </button>
                <button onClick={confirmManual}
                  className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-blue-600 rounded-xl text-white font-bold transition-all">
                  確認裝備 →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: 確認裝備 ── */}
      {step === "gear-review" && gearAnalysis && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sky-300 font-bold text-lg mb-1">✅ 裝備確認</h3>

          {gearPhotoPreview && gearInputMode === "photo" && (
            <img src={gearPhotoPreview} alt="裝備" className="w-full max-h-40 object-cover rounded-xl mb-4 opacity-80" />
          )}

          {gearAnalysis.summary && (
            <div className="glass-light rounded-xl p-3 mb-4">
              <p className="text-sky-400 text-xs font-medium mb-1">
                {gearInputMode === "photo" ? "🤖 AI 辨識摘要" : "📝 手動輸入摘要"}
              </p>
              <p className="text-sky-300 text-sm">{gearAnalysis.summary}</p>
            </div>
          )}

          {gearAnalysis.items?.filter(Boolean).length > 0 && (
            <div className="mb-4">
              <p className="text-sky-500 text-xs mb-2">裝備清單：</p>
              <div className="flex flex-wrap gap-2">
                {gearAnalysis.items.filter(Boolean).map((item: string, i: number) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-sky-900/40 border border-sky-700/30 text-sky-300 rounded-full">{item}</span>
                ))}
              </div>
            </div>
          )}

          {gearAnalysis.recommendation && (
            <div className="glass-light rounded-xl p-3 mb-4 border border-sky-600/20">
              <p className="text-sky-400 text-xs font-medium mb-1">💡 建議搭配</p>
              <p className="text-sky-300 text-sm leading-relaxed">{gearAnalysis.recommendation}</p>
            </div>
          )}

          {gearAnalysis.missing?.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 mb-4">
              <p className="text-yellow-400 text-xs font-medium mb-1">⚠️ 建議補充</p>
              <p className="text-yellow-300 text-sm">{gearAnalysis.missing.join("、")}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("gear-input")} className="px-4 py-3 glass-light rounded-xl text-sky-400 text-sm">← 修改</button>
            <button onClick={() => setStep("spot-photo")}
              className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-blue-600 rounded-xl text-white font-bold transition-all">
              📸 下一步：拍釣點 →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 釣點照片 ── */}
      {step === "spot-photo" && (
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sky-300 font-bold text-lg mb-1">📸 拍攝釣點環境</h3>
          <p className="text-sky-500 text-sm mb-4">AI 結合裝備 + 環境給出最佳策略（可略過直接分析）</p>

          <label className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${spotPhotoPreview ? "border-sky-500" : "border-sky-800 hover:border-sky-600"}`}>
              {spotPhotoPreview
                ? <img src={spotPhotoPreview} alt="釣點" className="max-h-56 mx-auto rounded-xl object-contain" />
                : <>
                    <div className="text-5xl mb-3">🌊</div>
                    <p className="text-sky-400 font-medium">點擊拍攝釣點環境</p>
                    <p className="text-sky-600 text-sm mt-1">水面、地形、障礙物</p>
                  </>}
            </div>
            <input type="file" accept="image/*" capture="environment"
              onChange={e => e.target.files?.[0] && handleSpotPhoto(e.target.files[0])} className="hidden" />
          </label>

          {spotPhotoPreview && (
            <button onClick={() => { setSpotPhotoPreview(""); setSpotPhotoBase64(""); }}
              className="mt-2 text-sky-600 text-sm w-full text-center">重新拍攝</button>
          )}

          {strategyError && <p className="text-red-400 text-sm mt-3">⚠️ {strategyError}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep("gear-review")} className="px-4 py-3 glass-light rounded-xl text-sky-400 text-sm">← 返回</button>
            <button onClick={() => analyzeSpot()} disabled={strategyLoading}
              className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-blue-600 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all">
              {strategyLoading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 分析中...</>
                : spotPhotoBase64 ? "🤖 AI 分析釣點 →" : "🤖 略過照片，直接給策略 →"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: 策略 ── */}
      {step === "strategy" && strategyData && (
        <div className="space-y-4">
          {previousStrategies.length > 0 && (
            <div className="glass-light rounded-xl p-3">
              <p className="text-sky-500 text-xs">已嘗試 {previousStrategies.length} 個策略，這是第 {previousStrategies.length + 1} 個</p>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sky-300 font-bold text-lg">🎯 作釣策略</h3>
              <div className="text-right">
                <div className="text-sky-300 font-bold">{strategyData.confidenceLevel}%</div>
                <div className="text-sky-600 text-xs">信心指數</div>
              </div>
            </div>

            {strategyData.spotAnalysis && (
              <div className="glass-light rounded-xl p-4 mb-3">
                <p className="text-sky-500 text-xs font-medium mb-1">🔍 釣點分析</p>
                <p className="text-sky-300 text-sm leading-relaxed">{strategyData.spotAnalysis}</p>
              </div>
            )}

            {strategyData.recommendedPositions?.length > 0 && (
              <div className="mb-3">
                <p className="text-sky-500 text-xs font-medium mb-2">📍 建議站位</p>
                <div className="space-y-2">
                  {strategyData.recommendedPositions.map((pos: string, i: number) => (
                    <div key={i} className="glass-light rounded-xl p-3 flex gap-2">
                      <span className="text-sky-600 text-sm font-bold shrink-0">#{i + 1}</span>
                      <p className="text-sky-300 text-sm">{pos}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {strategyData.strategy && (
              <div className="mb-3">
                <p className="text-sky-500 text-xs font-medium mb-2">⚙️ 操作細節</p>
                <div className="space-y-2">
                  {[
                    { key: "setup", icon: "🎣", label: "釣組設置" },
                    { key: "casting", icon: "🎯", label: "投竿方向" },
                    { key: "retrieve", icon: "🔄", label: "操作方式" },
                    { key: "depth", icon: "📏", label: "釣棚深度" },
                    { key: "pace", icon: "⏱️", label: "節奏" },
                  ].map(item => strategyData.strategy[item.key] && (
                    <div key={item.key} className="glass-light rounded-xl p-3">
                      <p className="text-sky-500 text-xs mb-0.5">{item.icon} {item.label}</p>
                      <p className="text-sky-300 text-sm">{strategyData.strategy[item.key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {strategyData.gearAdjustment && (
              <div className="glass-light rounded-xl p-3 mb-3 border border-sky-600/20">
                <p className="text-sky-500 text-xs font-medium mb-1">🔧 裝備搭配建議</p>
                <p className="text-sky-300 text-sm">{strategyData.gearAdjustment}</p>
              </div>
            )}
          </div>

          <button onClick={startTimer}
            className="w-full py-4 bg-gradient-to-r from-green-700 to-sky-700 hover:from-green-600 hover:to-sky-600 rounded-xl text-white font-bold text-lg transition-all">
            ⏱️ 開始計時 {strategyData.strategyDuration} 分鐘
          </button>
        </div>
      )}

      {/* ── STEP 5: 計時器 ── */}
      {step === "timer" && (
        <div className="glass rounded-2xl p-8 text-center">
          <div className="relative w-48 h-48 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e3a5f" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke={timerFinished ? "#f59e0b" : "#38bdf8"} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {timerFinished
                ? <><div className="text-3xl">⏰</div><div className="text-yellow-400 font-bold text-sm mt-1">時間到！</div></>
                : <><div className="text-4xl font-bold text-sky-300">{formatTime(remaining)}</div><div className="text-sky-500 text-xs mt-1">剩餘時間</div></>}
            </div>
          </div>

          {timerFinished ? (
            <>
              <h3 className="text-2xl font-bold text-yellow-400 mb-2">⏰ 策略時間到！</h3>
              <p className="text-sky-400 mb-6">這段時間有咬況嗎？</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleBite(true)} className="py-4 bg-green-700 hover:bg-green-600 rounded-xl text-white font-bold text-lg transition-all">✅ 有！繼續</button>
                <button onClick={() => handleBite(false)} className="py-4 bg-red-800 hover:bg-red-700 rounded-xl text-white font-bold text-lg transition-all">❌ 沒有，換策略</button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sky-300 font-bold text-xl mb-2">計時中...</h3>
              <p className="text-sky-500 text-sm mb-6">按照 AI 策略進行，時間到會響鈴</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { clearInterval(intervalRef.current); setTimerRunning(false); setStep("strategy"); }}
                  className="px-6 py-3 glass-light rounded-xl text-sky-400 transition-all">← 查看策略</button>
                <button onClick={() => { clearInterval(intervalRef.current); setTimerRunning(false); setTimerFinished(true); }}
                  className="px-6 py-3 bg-yellow-800/50 hover:bg-yellow-700/50 rounded-xl text-yellow-400 transition-all">提早結束</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
