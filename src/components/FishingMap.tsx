"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const createIcon = (color: string) =>
  L.divIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px ${color}"></div>`,
    iconSize: [14, 14],
    className: "",
  });

const saltIcon = createIcon("#38bdf8");
const freshIcon = createIcon("#4ade80");

interface Spot {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  water_type: string;
  description: string;
  target_fish: string;
  best_season: string;
  source: string;
}

// 地圖載入後強制更新尺寸
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

export default function FishingMap() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [filter, setFilter] = useState<"all" | "saltwater" | "freshwater">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/spots?water_type=${filter}`)
      .then((r) => r.json())
      .then((data) => { setSpots(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  const filtered = spots.filter((s) => filter === "all" || s.water_type === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "12px" }}>
      {/* 篩選器 */}
      <div className="flex gap-2 px-1">
        {(["all", "saltwater", "freshwater"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${filter === f ? "bg-sky-600 text-white" : "glass-light text-sky-400 hover:bg-sky-900/40"}`}>
            {f === "all" ? "🗺️ 全部" : f === "saltwater" ? "🌊 海水" : "🏞️ 淡水"}
          </button>
        ))}
        <span className="ml-auto text-sky-600 text-sm self-center">{filtered.length} 個釣點</span>
      </div>

      {/* 地圖 */}
      <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", minHeight: 0 }}>
        {loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
          </div>
        ) : (
          <MapContainer
            center={[23.6978, 120.9605]}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <MapResizer />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((spot) => (
              <Marker
                key={spot.id}
                position={[spot.latitude, spot.longitude]}
                icon={spot.water_type === "saltwater" ? saltIcon : freshIcon}
              >
                <Popup>
                  <div style={{ minWidth: "180px" }}>
                    <h3 style={{ fontWeight: "bold", marginBottom: "4px" }}>{spot.name}</h3>
                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>{spot.description}</p>
                    {spot.target_fish && <p style={{ fontSize: "12px" }}>🐟 {spot.target_fish}</p>}
                    {spot.best_season && <p style={{ fontSize: "12px" }}>📅 最佳季節：{spot.best_season}</p>}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#38bdf8" }}>
                      🗺️ Google Maps 導航
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* 圖例 */}
      <div className="flex gap-4 text-xs text-sky-500 px-1">
        <span className="flex items-center gap-1">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#38bdf8" }} />
          海水釣點
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
          淡水釣點
        </span>
      </div>
    </div>
  );
}
