"use client";

import { useState, useEffect } from "react";

interface Props { onBack: () => void; }

export default function FishingLog({ onBack }: Props) {
  const [view, setView] = useState<"list" | "add">("list");
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 新增表單
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ date: today, location_name: "", water_type: "saltwater", target_fish: "", technique: "", rod_type: "", reel_type: "", line_type: "", lure_bait: "", notes: "" });
  const [catches, setCatches] = useState([{ fish_name: "", quantity: 1, weight_g: "", length_cm: "", released: false }]);

  // 漁獲辨識
  const [identifyPhoto, setIdentifyPhoto] = useState("");
  const [identifyPreview, setIdentifyPreview] = useState("");
  const [identifyResult, setIdentifyResult] = useState<any>(null);
  const [identifyLoading, setIdentifyLoading] = useState(false);
  const [identifyIdx, setIdentifyIdx] = useState<number | null>(null);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const r = await fetch("/api/logs");
    const d = await r.json();
    setLogs(d.logs || []);
    setTotal(d.total || 0);
    setLoading(false);
  };

  const saveLog = async () => {
    setSaving(true);
    const r = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log: form, catches: catches.filter(c => c.fish_name) }),
    });
    if (r.ok) { setView("list"); fetchLogs(); resetForm(); }
    setSaving(false);
  };

  const deleteLog = async (id: number) => {
    if (!confirm("確定刪除這筆紀錄？")) return;
    await fetch(`/api/logs?id=${id}`, { method: "DELETE" });
    fetchLogs();
  };

  const resetForm = () => {
    setForm({ date: today, location_name: "", water_type: "saltwater", target_fish: "", technique: "", rod_type: "", reel_type: "", line_type: "", lure_bait: "", notes: "" });
    setCatches([{ fish_name: "", quantity: 1, weight_g: "", length_cm: "", released: false }]);
    setIdentifyResult(null);
  };

  const identifyCatch = async (idx: number) => {
    if (!identifyPhoto) return;
    setIdentifyLoading(true); setIdentifyIdx(idx);
    const r = await fetch("/api/ai/identify-catch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoBase64: identifyPhoto }),
    });
    const d = await r.json();
    setIdentifyResult(d);
    if (d.name) {
      setCatches(prev => prev.map((c, i) => i === idx ? { ...c, fish_name: d.name, length_cm: d.estimatedLength_cm || "" as any, weight_g: d.estimatedWeight_g || "" as any } : c));
    }
    setIdentifyLoading(false);
  };

  const handleIdentifyPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setIdentifyPreview(result);
      setIdentifyPhoto(result.split(",")[1]);
      setIdentifyResult(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sky-500 hover:text-sky-300 text-sm">← 返回</button>
        <h2 className="text-sky-300 font-bold text-xl">📔 釣魚日誌</h2>
        <span className="text-sky-600 text-sm ml-auto">共 {total} 筆</span>
        {view === "list" && (
          <button onClick={() => setView("add")} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-xl text-white text-sm font-medium">＋ 新增</button>
        )}
      </div>

      {/* 新增表單 */}
      {view === "add" && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sky-300 font-bold mb-4">📝 記錄這次出釣</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sky-500 text-xs mb-1 block">日期</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-3 py-2.5 text-sky-200 text-sm focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-sky-500 text-xs mb-1 block">水域</label>
                  <select value={form.water_type} onChange={e => setForm(p => ({ ...p, water_type: e.target.value }))}
                    className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-3 py-2.5 text-sky-200 text-sm focus:outline-none focus:border-sky-500">
                    <option value="saltwater">🌊 海水</option>
                    <option value="freshwater">🏞️ 淡水</option>
                  </select>
                </div>
              </div>
              {[
                { key: "location_name", label: "釣點名稱", placeholder: "例：基隆外木山" },
                { key: "target_fish", label: "目標魚種", placeholder: "例：黑鯛、嘉鱲" },
                { key: "technique", label: "釣法", placeholder: "例：磯釣浮標" },
                { key: "rod_type", label: "魚竿", placeholder: "例：磯釣竿3號5.3m" },
                { key: "lure_bait", label: "使用餌料", placeholder: "例：活蝦、蚯蚓" },
                { key: "notes", label: "備註心得", placeholder: "今天的發現、下次改進..." },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sky-500 text-xs mb-1 block">{f.label}</label>
                  {f.key === "notes"
                    ? <textarea value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={2}
                        className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-3 py-2.5 text-sky-200 text-sm placeholder-sky-700 focus:outline-none focus:border-sky-500 resize-none" />
                    : <input type="text" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                        className="w-full bg-sky-950/50 border border-sky-800/50 rounded-xl px-3 py-2.5 text-sky-200 text-sm placeholder-sky-700 focus:outline-none focus:border-sky-500" />}
                </div>
              ))}
            </div>
          </div>

          {/* 漁獲記錄 */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sky-300 font-bold">🐟 漁獲記錄</h3>
              <button onClick={() => setCatches(p => [...p, { fish_name: "", quantity: 1, weight_g: "", length_cm: "", released: false }])}
                className="text-sky-400 text-sm hover:text-sky-300">＋ 新增</button>
            </div>

            {/* 拍照辨識 */}
            <div className="mb-4 p-3 bg-sky-900/20 border border-sky-700/30 rounded-xl">
              <p className="text-sky-400 text-xs mb-2">📸 拍魚照讓 AI 自動辨識魚種</p>
              <label className="cursor-pointer">
                <div className="border border-dashed border-sky-700 rounded-xl p-3 text-center">
                  {identifyPreview
                    ? <img src={identifyPreview} alt="魚" className="max-h-32 mx-auto rounded-lg object-contain" />
                    : <p className="text-sky-600 text-sm">點擊拍攝漁獲照片</p>}
                </div>
                <input type="file" accept="image/*" capture="environment"
                  onChange={e => e.target.files?.[0] && handleIdentifyPhoto(e.target.files[0])} className="hidden" />
              </label>
              {identifyPhoto && (
                <button onClick={() => identifyCatch(0)} disabled={identifyLoading}
                  className="mt-2 w-full py-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 rounded-lg text-white text-sm flex items-center justify-center gap-2">
                  {identifyLoading ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />辨識中...</> : "🤖 AI 辨識魚種"}
                </button>
              )}
              {identifyResult && !identifyResult.error && (
                <div className="mt-2 p-2 bg-sky-900/40 rounded-lg">
                  <p className="text-sky-300 text-sm font-medium">{identifyResult.name} <span className="text-sky-600 text-xs">{identifyResult.confidence}% 信心</span></p>
                  <p className="text-sky-500 text-xs">{identifyResult.description}</p>
                  {identifyResult.isProtected && <p className="text-red-400 text-xs mt-1">⚠️ 保育類！{identifyResult.protectedNote}</p>}
                  {identifyResult.belowLegalSize && <p className="text-yellow-400 text-xs">⚠️ 未達法定體長 {identifyResult.legalSize_cm}cm，建議放生</p>}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {catches.map((c, i) => (
                <div key={i} className="glass-light rounded-xl p-3">
                  <div className="flex gap-2 mb-2">
                    <input placeholder="魚種名稱" value={c.fish_name}
                      onChange={e => setCatches(p => p.map((x, j) => j === i ? { ...x, fish_name: e.target.value } : x))}
                      className="flex-1 bg-sky-950/50 border border-sky-800/50 rounded-lg px-3 py-2 text-sky-200 text-sm placeholder-sky-700 focus:outline-none focus:border-sky-500" />
                    <input type="number" placeholder="尾數" value={c.quantity}
                      onChange={e => setCatches(p => p.map((x, j) => j === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))}
                      className="w-16 bg-sky-950/50 border border-sky-800/50 rounded-lg px-2 py-2 text-sky-200 text-sm text-center focus:outline-none focus:border-sky-500" />
                    <button onClick={() => setCatches(p => p.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-400 text-sm px-2">✕</button>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="重量(g)" value={c.weight_g}
                      onChange={e => setCatches(p => p.map((x, j) => j === i ? { ...x, weight_g: e.target.value as any } : x))}
                      className="flex-1 bg-sky-950/50 border border-sky-800/50 rounded-lg px-2 py-1.5 text-sky-200 text-xs placeholder-sky-700 focus:outline-none" />
                    <input type="number" placeholder="長度(cm)" value={c.length_cm}
                      onChange={e => setCatches(p => p.map((x, j) => j === i ? { ...x, length_cm: e.target.value as any } : x))}
                      className="flex-1 bg-sky-950/50 border border-sky-800/50 rounded-lg px-2 py-1.5 text-sky-200 text-xs placeholder-sky-700 focus:outline-none" />
                    <label className="flex items-center gap-1 text-sky-500 text-xs cursor-pointer">
                      <input type="checkbox" checked={c.released} onChange={e => setCatches(p => p.map((x, j) => j === i ? { ...x, released: e.target.checked } : x))} className="accent-sky-500" />
                      放生
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setView("list"); resetForm(); }} className="px-5 py-3 glass-light rounded-xl text-sky-400">取消</button>
            <button onClick={saveLog} disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-blue-600 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />儲存中...</> : "💾 儲存日誌"}
            </button>
          </div>
        </div>
      )}

      {/* 日誌列表 */}
      {view === "list" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <div className="text-5xl mb-3">📔</div>
              <p className="text-sky-400 font-medium mb-1">還沒有釣魚紀錄</p>
              <p className="text-sky-600 text-sm">按右上角「＋ 新增」開始記錄</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="glass rounded-2xl overflow-hidden">
                <button className="w-full p-4 text-left" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sky-300 font-bold">{log.location_name || "未命名釣點"}</span>
                        <span className="text-sky-600 text-xs">{log.date}</span>
                        {log.water_type === "saltwater" ? <span className="text-xs text-blue-400">🌊</span> : <span className="text-xs text-green-400">🏞️</span>}
                      </div>
                      <div className="flex gap-3 text-xs text-sky-500">
                        {log.technique && <span>🎣 {log.technique}</span>}
                        {log.total_catch > 0 && <span className="text-green-400 font-medium">✅ {log.catch_summary}</span>}
                        {(!log.total_catch || log.total_catch == 0) && <span className="text-sky-700">空手而歸</span>}
                      </div>
                    </div>
                    <span className="text-sky-600 text-sm shrink-0">{expandedId === log.id ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expandedId === log.id && (
                  <div className="px-4 pb-4 border-t border-sky-900/30 pt-3 space-y-2">
                    {log.target_fish && <p className="text-sky-400 text-sm">🎯 目標：{log.target_fish}</p>}
                    {log.lure_bait && <p className="text-sky-400 text-sm">🪱 餌料：{log.lure_bait}</p>}
                    {log.rod_type && <p className="text-sky-400 text-sm">🎣 竿：{log.rod_type}</p>}
                    {log.notes && <p className="text-sky-400 text-sm">📝 {log.notes}</p>}
                    {log.catches?.length > 0 && (
                      <div>
                        <p className="text-sky-500 text-xs mb-1">漁獲：</p>
                        <div className="flex flex-wrap gap-1">
                          {log.catches.map((c: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 bg-green-900/30 border border-green-700/30 text-green-400 rounded-full">
                              {c.fish_name} ×{c.quantity}{c.weight_g ? ` ${c.weight_g}g` : ""}{c.released ? " 🔄" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => deleteLog(log.id)} className="text-red-500 hover:text-red-400 text-xs mt-2">🗑️ 刪除</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
