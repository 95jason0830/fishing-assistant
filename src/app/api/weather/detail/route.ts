import { NextRequest, NextResponse } from 'next/server';

// 台灣主要潮汐觀測站（含座標，用於找最近站）
const TIDE_STATIONS = [
  { id: '1', name: '基隆', lat: 25.1539, lon: 121.7391 },
  { id: '2', name: '淡水', lat: 25.1818, lon: 121.4408 },
  { id: '3', name: '台中', lat: 24.2826, lon: 120.5196 },
  { id: '4', name: '高雄', lat: 22.6139, lon: 120.2695 },
  { id: '5', name: '花蓮', lat: 23.9728, lon: 121.6163 },
  { id: '6', name: '台東成功', lat: 23.0978, lon: 121.3731 },
  { id: '7', name: '馬公', lat: 23.5667, lon: 119.5667 },
  { id: '8', name: '蘇澳', lat: 24.5931, lon: 121.8628 },
];

function nearestStation(lat: number, lon: number) {
  let best = TIDE_STATIONS[0];
  let bestDist = Infinity;
  for (const s of TIDE_STATIONS) {
    const d = Math.hypot(s.lat - lat, s.lon - lon);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

// 建構氣象局雷達合成圖 URL（每10分鐘更新，往回抓20分鐘確保有資料）
function getRadarUrls(): string[] {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 3600000);
  const urls: string[] = [];
  for (let lag = 20; lag <= 40; lag += 10) {
    const t = new Date(utc8.getTime() - lag * 60000);
    const min = Math.floor(t.getUTCMinutes() / 10) * 10;
    t.setUTCMinutes(min, 0, 0);
    const YYYY = t.getUTCFullYear();
    const MM = String(t.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(t.getUTCDate()).padStart(2, '0');
    const HH = String(t.getUTCHours()).padStart(2, '0');
    const MI = String(min).padStart(2, '0');
    urls.push(`https://www.cwa.gov.tw/Data/radar/CV1_3600_${YYYY}${MM}${DD}${HH}${MI}.png`);
  }
  return urls;
}

// 估算潮汐（無 API key 時 fallback）
function estimateTideSchedule(date: string, stationName: string) {
  const d = new Date(date);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const offset = (dayOfYear * 0.8) % 6;
  const tides = [];
  for (let h = 0; h < 24; h++) {
    const adj = (h + offset) % 12;
    let height: number;
    if (adj < 1.5) height = 0.4 + Math.random() * 0.2;
    else if (adj < 4.5) height = 0.4 + (adj - 1.5) / 3 * 2.5;
    else if (adj < 6) height = 2.9 + Math.random() * 0.3;
    else if (adj < 9) height = 2.9 - (adj - 6) / 3 * 2.5;
    else height = 0.4 + Math.random() * 0.2;
    tides.push({ hour: h, height: Math.round(height * 10) / 10 });
  }
  // 找高低潮
  const highs: any[] = [], lows: any[] = [];
  for (let i = 1; i < tides.length - 1; i++) {
    if (tides[i].height > tides[i-1].height && tides[i].height > tides[i+1].height) {
      highs.push({ time: `${String(i).padStart(2,'0')}:00`, height: tides[i].height, type: '高潮' });
    }
    if (tides[i].height < tides[i-1].height && tides[i].height < tides[i+1].height) {
      lows.push({ time: `${String(i).padStart(2,'0')}:00`, height: tides[i].height, type: '低潮' });
    }
  }
  return { station: stationName, source: 'estimated', hourly: tides, events: [...highs, ...lows].sort((a, b) => a.time.localeCompare(b.time)) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '25.04');
  const lon = parseFloat(searchParams.get('lon') || '121.5');
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const station = nearestStation(lat, lon);
  const radarUrls = getRadarUrls();

  // 嘗試 CWB 真實潮汐資料
  let tideData: any = null;
  const cwbKey = process.env.CWB_API_KEY;

  if (cwbKey) {
    try {
      const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-A0021-001?Authorization=${cwbKey}&StationName=${encodeURIComponent(station.name)}&Date=${date}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const json = await res.json();
      const records = json?.records?.TideForecasts?.[0];
      if (records) {
        const daily = records.Daily?.find((d: any) => d.Date === date);
        if (daily) {
          const events = daily.Time?.map((t: any) => ({
            time: t.DateTime?.split('T')[1]?.substring(0, 5) || t.DateTime,
            height: parseFloat(t.TideHeight) / 100, // cm → m
            type: t.TideName === 'H' ? '高潮' : '低潮',
          })) || [];
          tideData = { station: station.name, source: 'cwa', events };
        }
      }
    } catch (e) {
      console.error('CWB tide error:', e);
    }
  }

  if (!tideData) {
    tideData = estimateTideSchedule(date, station.name);
  }

  return NextResponse.json({
    radarUrls,
    tide: tideData,
    station: station.name,
    windyLat: lat.toFixed(4),
    windyLon: lon.toFixed(4),
  });
}
