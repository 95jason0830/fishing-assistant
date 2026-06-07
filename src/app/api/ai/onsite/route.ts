import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photoBase64, equipment, weatherData, targetFish, technique, previousStrategies, noBites } = body;

    // 支援 AI 辨識的結構化裝備 或 舊版文字格式
    const equipmentText = equipment ? `
釣竿：${equipment.rod?.spec || equipment.rod || '未知'}
捲線器：${equipment.reel?.spec || equipment.reel || '未知'}
主線：${equipment.mainLine?.type || equipment.mainLine || '未知'}
子線：${equipment.leader?.type || equipment.leader || '未知'}
魚鉤：${equipment.hook?.type || equipment.hook || '未知'}
配重：${equipment.weight?.type || equipment.weight || '未知'}
浮標：${equipment.float?.spec || equipment.float || '無'}
釣餌：${Array.isArray(equipment.baits) ? equipment.baits.map((b: any) => b.name || b).join('、') : (equipment.baits || '未知')}
其他裝備：${equipment.accessories?.join('、') || equipment.others || '無'}
${equipment.summary ? `AI辨識摘要：${equipment.summary}` : ''}
${equipment.recommendation ? `裝備搭配建議：${equipment.recommendation}` : ''}` : '未提供裝備資訊';

    const previousText = previousStrategies?.length
      ? `\n已嘗試策略：\n${previousStrategies.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
      : '';

    const noBitesText = noBites ? '\n【重要】上一個策略執行後沒有咬況，請給出不同的調整方向。' : '';

    // 自動偵測圖片格式
    function detectMediaType(b64: string): string {
      const bytes = Buffer.from(b64.substring(0, 16), 'base64');
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
      if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
      if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
      if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
      return 'image/jpeg';
    }

    let userContent: any[];

    if (photoBase64) {
      userContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: detectMediaType(photoBase64) as any,
            data: photoBase64,
          },
        },
        {
          type: 'text',
          text: `你是台灣專業釣魚顧問。請分析這張釣點照片，並根據釣魚條件給出現場策略建議。

【當前環境】
天氣：${weatherData?.weatherDesc || '未知'}，氣溫${weatherData?.temperature || '?'}°C
風向：${weatherData?.windDirection || '未知'}風 ${weatherData?.windSpeed || '?'}km/h
潮汐：${weatherData?.tide || '未知'}
目標魚種：${targetFish || '未指定'}
釣法：${technique || '未指定'}

【攜帶裝備】${equipmentText}
${previousText}${noBitesText}

請分析照片中的釣點環境（水流、底質、障礙物、水色等），並用JSON格式輸出（只輸出JSON）：
{
  "spotAnalysis": "釣點環境分析（觀察到的地形、水況、有利條件）",
  "recommendedPositions": ["建議站位1的描述", "建議站位2"],
  "strategy": {
    "setup": "具體的釣組設置方式",
    "casting": "投竿方向與落點建議",
    "retrieve": "收線或操作方式",
    "depth": "建議釣棚深度",
    "pace": "節奏建議"
  },
  "gearAdjustment": "根據攜帶的裝備，建議如何搭配使用（若需調整也請說明）",
  "strategyDuration": 20,
  "confidenceLevel": 80,
  "nextStepIfNoBite": "若此策略無效的備用方向"
}`
        }
      ];
    } else {
      // 無照片版本
      userContent = [{
        type: 'text',
        text: `你是台灣專業釣魚顧問。根據釣魚條件給出現場策略建議。

【當前環境】
天氣：${weatherData?.weatherDesc || '未知'}，氣溫${weatherData?.temperature || '?'}°C
風向：${weatherData?.windDirection || '未知'}風 ${weatherData?.windSpeed || '?'}km/h
潮汐：${weatherData?.tide || '未知'}
目標魚種：${targetFish || '未指定'}
釣法：${technique || '未指定'}

【攜帶裝備】${equipmentText}
${previousText}${noBitesText}

請用JSON格式輸出（只輸出JSON）：
{
  "spotAnalysis": "根據環境條件推測的釣場特性",
  "recommendedPositions": ["建議站位特徵1", "建議站位特徵2"],
  "strategy": {
    "setup": "具體的釣組設置方式",
    "casting": "投竿方向與落點建議",
    "retrieve": "收線或操作方式",
    "depth": "建議釣棚深度",
    "pace": "節奏建議"
  },
  "gearAdjustment": "根據攜帶裝備的搭配建議",
  "strategyDuration": 20,
  "confidenceLevel": 70,
  "nextStepIfNoBite": "若此策略無效的備用方向"
}`
      }];
    }

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = (msg.content[0] as any).text;
    const raw = text.match(/\{[\s\S]*\}/)?.[0];
    if (!raw) throw new Error('AI 回應格式錯誤，請重試');

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      // JSON 被截斷時，嘗試補齊結尾
      try {
        json = JSON.parse(raw + '"}');
      } catch {
        try {
          json = JSON.parse(raw + '"}}}');
        } catch {
          throw new Error('AI 回應解析失敗，請重試');
        }
      }
    }

    return NextResponse.json(json);

  } catch (error) {
    console.error('Onsite AI error:', error);
    return NextResponse.json({ error: '現場分析失敗' }, { status: 500 });
  }
}
