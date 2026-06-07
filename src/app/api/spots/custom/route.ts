import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseGoogleMapsUrl(url: string): { lat: number; lon: number } | null {
  try {
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };
    const placeMatch = url.match(/place\/[^@]*@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) return { lat: parseFloat(placeMatch[1]), lon: parseFloat(placeMatch[2]) };
    const coordMatch = url.match(/(-?\d{2,3}\.\d{3,7})[,\s]+(-?\d{2,3}\.\d{3,7})/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]), lon = parseFloat(coordMatch[2]);
      if (lat >= 20 && lat <= 27 && lon >= 118 && lon <= 124) return { lat, lon };
    }
    return null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mapUrl, water_type } = body;

    if (!name) return NextResponse.json({ error: '請輸入釣點名稱' }, { status: 400 });
    if (!mapUrl) return NextResponse.json({ error: '請貼上 Google Maps 連結或座標' }, { status: 400 });

    const coords = parseGoogleMapsUrl(mapUrl);
    if (!coords) return NextResponse.json({ error: '無法解析地圖連結，請貼上 Google Maps 網址或直接輸入座標（例：25.1234,121.5678）' }, { status: 400 });

    const { lat, lon } = coords;

    const prompt = `你是台灣專業釣魚顧問。根據以下釣點資訊，分析釣點詳細資料。
釣點名稱：${name}
座標：緯度 ${lat}，經度 ${lon}
水域類型：${water_type === 'saltwater' ? '海水' : '淡水'}
只輸出JSON：
{
  "description": "釣點特色描述（50字以內）",
  "target_fish": "適合魚種，逗號分隔（3-5種）",
  "best_season": "最佳季節（例：春秋、全年、夏季）",
  "spot_type": "釣點類型（磯岩/港口/堤防/沙灘/河口/水庫/溪流/池塘）",
  "difficulty": "難度（入門/進階/高手）",
  "tips": "簡短釣魚小技巧（30字以內）"
}`;

    const msg = await client.messages.create({ model: 'claude-opus-4-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] });
    const text = (msg.content[0] as any).text;
    const aiInfo = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);

    const { data, error } = await supabase.from('fishing_spots').insert({
      name, latitude: lat, longitude: lon,
      water_type: water_type || 'saltwater',
      description: aiInfo.description || '',
      target_fish: aiInfo.target_fish || '',
      best_season: aiInfo.best_season || '全年',
      spot_type: aiInfo.spot_type || '',
      difficulty: aiInfo.difficulty || '',
      tips: aiInfo.tips || '',
      source: '我的釣點',
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ id: data.id, lat, lon, aiInfo, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: '新增失敗：' + e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase.from('fishing_spots').select('*').eq('source', '我的釣點').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
