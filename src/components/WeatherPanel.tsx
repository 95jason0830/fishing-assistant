"use client";

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  weatherDesc: string;
  cloudCover: number;
  precipitation: number;
  tide: string;
  moonPhase: string;
  season: string;
  time: string;
}

interface Props {
  data: WeatherData;
  location: any;
}

const weatherEmoji: Record<string, string> = {
  晴天: "☀️", 多雲: "⛅", 霧: "🌫️", 小雨: "🌧️", 雪: "❄️", 陣雨: "🌦️", 雷陣雨: "⛈️",
};

const tideEmoji: Record<string, string> = {
  漲潮: "🔺", 高潮: "⬆️", 退潮: "🔻", 低潮: "⬇️",
};

const moonEmoji: Record<string, string> = {
  新月: "🌑", 眉月: "🌒", 上弦月: "🌓", 漸盈凸月: "🌔", 滿月: "🌕", 漸虧凸月: "🌖", 下弦月: "🌗", 殘月: "🌘",
};

export default function WeatherPanel({ data, location }: Props) {
  const stats = [
    { label: "氣溫", value: `${data.temperature}°C`, icon: "🌡️" },
    { label: "天氣", value: data.weatherDesc, icon: weatherEmoji[data.weatherDesc] || "🌤️" },
    { label: "風向風速", value: `${data.windDirection} ${data.windSpeed} km/h`, icon: "💨" },
    { label: "濕度", value: `${data.humidity}%`, icon: "💧" },
    { label: "潮汐", value: data.tide, icon: tideEmoji[data.tide] || "🌊" },
    { label: "月相", value: data.moonPhase, icon: moonEmoji[data.moonPhase] || "🌙" },
    { label: "季節", value: `${data.season}季`, icon: "🍃" },
    { label: "降雨", value: `${data.precipitation} mm`, icon: "🌂" },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sky-300 font-bold text-lg">🌊 當前環境條件</h3>
        <div className="text-right">
          <p className="text-sky-400 text-sm font-medium">{location?.name}</p>
          <p className="text-sky-600 text-xs">{data.time}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="glass-light rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-sky-200 font-medium text-sm">{s.value}</div>
            <div className="text-sky-600 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
