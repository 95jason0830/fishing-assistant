import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weatherData, location, waterType, pastLogs } = body;

    const pastLogsText = pastLogs && pastLogs.length > 0
      ? `\n\n【你的歷史釣魚紀錄（供學習分析）】\n${pastLogs.map((log: any) =>
          `- ${log.date} 在${log.location_name || '未知地點'}，天氣${log.weather}，溫度${log.temperature}°C，釣到：${log.caught_fish || '無'}，使用：${log.lure_bait || '未記錄'}，釣法：${log.technique || '未記錄'}`
        ).join('\n')}`
      : '';

    const prompt = `你是一位專業的台灣釣魚顧問，請根據以下當前環境條件，給出詳細的釣魚建議。

【當前環境條件】
- 地點：${location?.name || '台灣'}
- 水域類型：${waterType === 'saltwater' ? '海水' : '淡水'}
- 季節：${weatherData.season}季
- 時間：${weatherData.time}
- 氣溫：${weatherData.temperature}°C
- 天氣：${weatherData.weatherDesc}
- 風向：${weatherData.windDirection}風
- 風速：${weatherData.windSpeed} km/h
- 雲量：${weatherData.cloudCover}%
- 降雨：${weatherData.precipitation} mm
- 潮汐：${weatherData.tide}
- 月相：${weatherData.moonPhase}
${pastLogsText}

請用繁體中文回答，並以 JSON 格式輸出以下內容（不要加任何其他文字，直接輸出 JSON）：
{
  "targetFish": ["魚種1", "魚種2", "魚種3"],
  "fishReason": "為什麼這些魚種在當前條件下活躍的說明",
  "techniques": [
    {
      "name": "釣法名稱",
      "description": "詳細說明",
      "suitability": "高/中/低"
    }
  ],
  "gear": {
    "rod": "建議釣竿",
    "reel": "建議捲線器",
    "line": "建議釣線",
    "hook": "建議魚鉤"
  },
  "baits": [
    {
      "name": "釣餌名稱",
      "type": "活餌/假餌/餌料",
      "reason": "為什麼適合"
    }
  ],
  "bestSpots": "建議的釣位特徵（礁石、沙灘、河口等）",
  "timing": "今日最佳釣魚時段",
  "warnings": "注意事項或安全警告",
  "overallScore": 85,
  "scoreReason": "今日釣魚條件評分說明"
}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // 解析 JSON
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('無法解析 AI 回應');

    const aiResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json({ error: 'AI 分析失敗' }, { status: 500 });
  }
}
