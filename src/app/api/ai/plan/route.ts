import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weatherData, waterType, targetFish, technique } = body;

    // 裝備清單
    if (targetFish && technique) {
      const prompt = `你是台灣專業釣魚顧問，請根據以下條件給出完整裝備清單。

環境：${weatherData.season}季，${weatherData.weatherDesc}，${weatherData.temperature}°C，${weatherData.windDirection}風${weatherData.windSpeed}km/h，潮汐${weatherData.tide}
水域：${waterType === 'saltwater' ? '海水' : '淡水'}
目標魚種：${targetFish}
釣法：${technique}

只輸出以下格式的JSON，欄位值請填入實際內容（不要保留說明文字）：
{
  "rod": { "spec": "磯釣竿3號5.3m", "reason": "適合磯釣遠投" },
  "reel": { "spec": "紡車式捲線器3000番", "type": "紡車", "reason": "適合磯釣" },
  "mainLine": { "type": "尼龍線3號", "lb": "12lb", "reason": "磯釣主流" },
  "leader": { "type": "碳纖維子線2號", "lb": "8lb", "length": "1.5m" },
  "hook": { "type": "伊勢尼鉤8號", "size": "8號", "reason": "適合黑鯛" },
  "weight": { "type": "中通鉛3B", "gram": "1.8g", "reason": "搭配浮標" },
  "float": { "use": true, "spec": "橢圓型浮標3B" },
  "baits": [
    { "name": "活蝦", "type": "活餌", "howTo": "穿尾部讓其自由游動", "priority": 1 },
    { "name": "蚯蚓", "type": "天然餌", "howTo": "穿頭部留尾端晃動", "priority": 2 }
  ],
  "accessories": ["磯釣袋", "抄網", "活餌桶", "太陽眼鏡"],
  "strategy": "在退潮前1小時開始作釣，找礁石邊緣投入，讓浮標順流漂送...",
  "castingTips": "投竿時注意風向，選擇礁石缺口往下游方向投入",
  "strategyDuration": 20
}

注意：strategyDuration請填數字（分鐘），所有欄位請填入針對${targetFish}/${technique}的真實建議。`;

      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = (msg.content[0] as any).text;
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 回應格式錯誤');
      const json = JSON.parse(match[0]);
      return NextResponse.json(json);
    }

    // 釣法推薦
    if (targetFish && !technique) {
      const prompt = `你是台灣專業釣魚顧問。根據條件推薦釣法。

環境：${weatherData.season}季，${weatherData.weatherDesc}，${weatherData.temperature}°C，${weatherData.windDirection}風${weatherData.windSpeed}km/h，潮汐${weatherData.tide}
水域：${waterType === 'saltwater' ? '海水' : '淡水'}，目標魚種：${targetFish}

只輸出JSON：
{
  "techniques": [
    { "name": "浮標磯釣", "description": "使用浮標控制釣棚深度，適合礁岩地形", "difficulty": "入門", "effectiveness": 85 },
    { "name": "落とし込み", "description": "沿礁石縫隙垂直落入，誘黑鯛開口", "difficulty": "進階", "effectiveness": 90 }
  ],
  "tips": "針對此魚種的特別注意事項"
}`;

      const msg = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = (msg.content[0] as any).text;
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 回應格式錯誤，請重試');
      const json = JSON.parse(match[0]);
      if (!json.techniques) throw new Error('AI 未回傳釣法資料，請重試');
      return NextResponse.json(json);
    }

    // 魚種推薦
    const spotName = weatherData.spotName || '';
    const spotType = weatherData.spotType || '';
    const region = weatherData.region || '';

    const prompt = `你是台灣最專業的釣魚顧問，熟知台灣每個海域、河川、水庫的魚種生態。

【釣點資訊】
釣點名稱：${spotName || '台灣'}
釣點類型：${spotType || '未知'}
所在區域：${region || '台灣'}
水域：${waterType === 'saltwater' ? '海水' : '淡水'}

【當前環境條件】
季節：${weatherData.season}季（${weatherData.month}月）
天氣：${weatherData.weatherDesc}，氣溫${weatherData.temperature}°C
風況：${weatherData.windDirection}風 ${weatherData.windSpeed}km/h
潮汐：${weatherData.tide}，月相：${weatherData.moonPhase}

請根據以上條件，從以下角度全面分析可釣魚種：
1. 此地點的原生/定居常見魚種
2. 當前月份的台灣季節洄游魚種（如：烏魚12月、旗魚5-9月、鬼頭刀4-10月、白帶魚秋冬等）
3. 當前潮汐、天氣條件下特別活躍的魚種
4. 此釣點地形（礁岩/沙地/河口/港口等）特有的魚種

請給出至少 10 種魚，從最推薦排到最不推薦。只輸出JSON（不要有任何其他文字）：
{
  "fish": [
    {
      "name": "黑鯛",
      "activity": "高",
      "reason": "漲潮礁岩區主動覓食，當季高峰期",
      "emoji": "🐟",
      "size": "20-50cm",
      "catchMethod": "浮標磯釣、落とし込み",
      "activeTime": "漲潮前後2小時、清晨、黃昏",
      "peakHours": [5, 6, 17, 18, 19]
    }
  ],
  "overallScore": 82,
  "bestTime": "下午4點至日落，搭配漲潮最佳",
  "seasonHighlight": "本月特別推薦：XXX（原因）",
  "warning": "注意事項或null"
}`;

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content[0] as any).text;

    // 安全解析 JSON
    let json: any;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('找不到 JSON');
      json = JSON.parse(match[0]);
    } catch {
      // 如果 JSON 截斷，嘗試修復
      const partial = text.match(/\{[\s\S]*/)?.[0] || '';
      const fixed = partial + ']}';
      try { json = JSON.parse(fixed); } catch { throw new Error('AI 回應解析失敗，請重試'); }
    }

    if (!json.fish || !Array.isArray(json.fish) || json.fish.length === 0) {
      throw new Error('AI 未回傳魚種資料，請重試');
    }

    return NextResponse.json(json);

  } catch (error: any) {
    console.error('Plan AI error:', error);
    return NextResponse.json({ error: error.message || 'AI 分析失敗' }, { status: 500 });
  }
}
