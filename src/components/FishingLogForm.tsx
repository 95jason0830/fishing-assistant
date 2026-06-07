"use client";

import { useState } from "react";

interface Props {
  location: any;
  weatherData: any;
  aiData: any;
  onSaved: () => void;
  onBack: () => void;
}

export default function FishingLogForm({ location, weatherData, aiData, onSaved, onBack }: Props) {
  const [form, setForm] = useState({
    caught_fish: "",
    quantity: "",
    weight: "",
    rod_type: aiData?.gear?.rod || "",
    reel_type: aiData?.gear?.reel || "",
    line_type: aiData?.gear?.line || "",
    lure_bait: aiData?.baits?.[0]?.name || "",
    technique: aiData?.techniques?.[0]?.name || "",
    depth: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        date: new Date().toISOString().split("T")[0],
        location_name: location?.name,
        latitude: location?.lat,
        longitude: location?.lon,
        water_type: location?.waterType,
        weather: weatherData?.weatherDesc,
        temperature: weatherData?.temperature,
        wind_direction: weatherData?.windDirection,
        wind_speed: weatherData?.windSpeed,
        tide: weatherData?.tide,
        moon_phase: weatherData?.moonPhase,
        target_fish: aiData?.targetFish?.join(", "),
        caught_fish: form.caught_fish,
        quantity: parseInt(form.quantity) || 0,
        weight: parseFloat(form.weight) || null,
        rod_type: form.rod_type,
        reel_type: form.reel_type,
        line_type: form.line_type,
        lure_bait: form.lure_bait,
        technique: form.technique,
        depth: parseFloat(form.depth) || null,
        notes: form.notes,
        ai_suggestion: JSON.stringify(aiData),
      };

      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => onSaved(), 1200);
    } catch {
      alert("儲存失敗，請重試");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { name: "caught_fish", label: "釣到的魚種", placeholder: "例如：黑鯛、鱸魚", type: "text" },
    { name: "quantity", label: "數量（尾）", placeholder: "0", type: "number" },
    { name: "weight", label: "總重（公克）", placeholder: "500", type: "number" },
    { name: "lure_bait", label: "使用的釣餌", placeholder: "例如：蚯蚓、假餌", type: "text" },
    { name: "technique", label: "釣法", placeholder: "例如：浮標釣、路亞", type: "text" },
    { name: "depth", label: "釣棚深度（公尺）", placeholder: "3", type: "number" },
    { name: "rod_type", label: "釣竿", placeholder: "例如：磯釣竿 3號", type: "text" },
    { name: "reel_type", label: "捲線器", placeholder: "例如：紡車式 2500", type: "text" },
    { name: "line_type", label: "釣線", placeholder: "例如：3號尼龍線", type: "text" },
  ];

  if (saved) {
    return (
      <div className="glass rounded-2xl p-8 max-w-lg mx-auto text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-sky-300 mb-2">紀錄已儲存！</h2>
        <p className="text-sky-500">AI 將從你的釣魚資料中學習，提供更精準的建議</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-sky-300">📝 記錄今日釣況</h2>
        <button onClick={onBack} className="text-sky-500 hover:text-sky-300 text-sm">← 返回建議</button>
      </div>

      {/* AI 預填提示 */}
      {aiData && (
        <div className="mb-4 p-3 bg-sky-900/20 border border-sky-700/30 rounded-xl">
          <p className="text-sky-400 text-xs">🤖 AI 建議目標：<span className="text-sky-300">{aiData.targetFish?.join("、")}</span></p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {fields.map((f) => (
          <div key={f.name} className={f.name === "notes" ? "sm:col-span-2" : ""}>
            <label className="text-sky-500 text-xs mb-1 block">{f.label}</label>
            <input
              type={f.type}
              name={f.name}
              value={(form as any)[f.name]}
              onChange={handleChange}
              placeholder={f.placeholder}
              className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-2.5 text-sky-200 placeholder-sky-700 focus:outline-none focus:border-sky-500 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="text-sky-500 text-xs mb-1 block">📌 備註心得</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="記錄今天的心得、特殊狀況、下次要改進的地方..."
          rows={3}
          className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-4 py-3 text-sky-200 placeholder-sky-700 focus:outline-none focus:border-sky-500 text-sm resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2"
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />儲存中...</>
        ) : "💾 儲存釣魚紀錄"}
      </button>
    </div>
  );
}
