import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lon, waterType } = body;

    const prompt = `你是台灣專業釣魚顧問，熟悉台灣所有釣點的確切位置。

使用者目前位置：緯度 ${lat}，經度 ${lon}（台灣）
想要的水域類型：${waterType === 'saltwater' ? '海水（海釣、磯釣、港邊）' : waterType === 'freshwater' ? '淡水（溪流、水庫、池塘）' : '海水與淡水都可以'}

請推薦距離使用者最近的 5 個真實釣點，必須提供精確的經緯度座標（真實存在的地點）。

只輸出 JSON，不要其他文字：
{
  "spots": [
    {
      "name": "釣點名稱",
      "latitude": 25.1234,
      "longitude": 121.5678,
      "water_type": "saltwater 或 freshwater",
      "distance_km": 3.5,
      "description": "釣點特色簡介（50字以內）",
      "target_fish": "適合魚種，逗號分隔",
      "best_season": "最佳季節",
      "spot_type": "港口/磯岩/沙灘/河口/水庫/溪流/池塘等",
      "difficulty": "入門/進階/高手"
    }
  ]
}`;

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (msg.content[0] as any).text;
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    return NextResponse.json(json);

  } catch (error) {
    console.error('Spots recommend error:', error);
    return NextResponse.json({ error: '釣點推薦失敗' }, { status: 500 });
  }
}
