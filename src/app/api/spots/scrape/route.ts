import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lon, waterType } = body;

    // 爬取台灣釣魚論壇
    const scrapedSpots: any[] = [];

    // 1. 爬取釣魚達人論壇
    try {
      const res = await fetch('https://www.fish168.com.tw/forum/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      // 用 regex 找經緯度格式
      const coordMatches = html.matchAll(/(\d{2,3}\.\d{3,6})[,\s]+(\d{2,3}\.\d{3,6})/g);
      for (const m of coordMatches) {
        const lat2 = parseFloat(m[1]);
        const lon2 = parseFloat(m[2]);
        // 過濾台灣範圍
        if (lat2 >= 21 && lat2 <= 26 && lon2 >= 119 && lon2 <= 123) {
          scrapedSpots.push({ latitude: lat2, longitude: lon2, source: 'fish168.com.tw' });
        }
      }
    } catch {}

    // 2. 爬取 PTT Fishing 板
    try {
      const res = await fetch('https://www.ptt.cc/bbs/Fishing/index.html', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'over18=1' },
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      const coordMatches = html.matchAll(/(\d{2}\.\d{4,6})[,\s]*N?[,\s]+(\d{3}\.\d{4,6})[,\s]*E?/g);
      for (const m of coordMatches) {
        const lat2 = parseFloat(m[1]);
        const lon2 = parseFloat(m[2]);
        if (lat2 >= 21 && lat2 <= 26 && lon2 >= 119 && lon2 <= 123) {
          scrapedSpots.push({ latitude: lat2, longitude: lon2, source: 'PTT Fishing' });
        }
      }
    } catch {}

    // 3. 用 AI 生成更多基於位置的釣點（主要來源）
    const prompt = `你是台灣最專業的釣魚達人，熟知全台每一個釣點，包括知名釣點和釣友私藏點。

使用者位置：緯度 ${lat}，經度 ${lon}
水域偏好：${waterType === 'saltwater' ? '海水' : waterType === 'freshwater' ? '淡水' : '海水與淡水'}

請推薦 10 個附近真實存在的釣點，包含：
- 一般釣友知道的知名釣點（3-4個）
- 較少人知道的私藏好釣點（3-4個）
- 港邊、堤防、橋墩等都市釣點（2-3個）

每個釣點都必須提供真實精確的 GPS 座標。

只輸出JSON：
{
  "spots": [
    {
      "name": "釣點名稱",
      "latitude": 25.12345,
      "longitude": 121.56789,
      "water_type": "saltwater",
      "distance_km": 2.3,
      "description": "釣點特色",
      "target_fish": "適合魚種",
      "best_season": "最佳季節",
      "spot_type": "磯岩/港口/堤防/沙灘/河口/水庫/溪流",
      "difficulty": "入門/進階/高手",
      "is_secret": false
    }
  ]
}`;

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content[0] as any).text;
    const aiData = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);

    // 將 AI 推薦的釣點存入資料庫（避免重複）
    for (const spot of (aiData.spots || [])) {
      const { data: existing } = await supabase.from('fishing_spots').select('id').eq('name', spot.name).maybeSingle();
      if (!existing) {
        await supabase.from('fishing_spots').insert({
          name: spot.name, latitude: spot.latitude, longitude: spot.longitude,
          water_type: spot.water_type, description: spot.description,
          target_fish: spot.target_fish, best_season: spot.best_season,
          source: spot.is_secret ? '釣友私藏點' : 'AI推薦',
        });
      }
    }

    return NextResponse.json({ spots: aiData.spots || [], scraped: scrapedSpots.length });
  } catch (error: any) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
