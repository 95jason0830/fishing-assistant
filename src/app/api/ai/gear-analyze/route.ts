import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photoBase64, targetFish, technique, fromPlan } = body;

    if (!photoBase64) {
      return NextResponse.json({ error: '請提供裝備照片' }, { status: 400 });
    }

    // 自動偵測圖片格式（從 base64 magic bytes 判斷）
    function detectMediaType(b64: string): string {
      const head = b64.substring(0, 16);
      const bytes = Buffer.from(head, 'base64');
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
      if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
      if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
      // WebP: RIFF....WEBP
      if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
      return 'image/jpeg'; // 預設
    }
    const mediaType = detectMediaType(photoBase64) as any;

    const planContext = fromPlan
      ? `\n規劃推薦裝備：${fromPlan.rod?.spec || ''}、${fromPlan.reel?.spec || ''}、餌料：${fromPlan.baits?.map((b: any) => b.name).join('、') || ''}`
      : '';

    const prompt = `你是台灣專業釣魚顧問，擅長辨識各種釣魚裝備。

請仔細分析這張照片中的所有釣魚裝備，辨識並列出所有可見的釣具，然後根據這些裝備給出最佳搭配建議。

目標魚種：${targetFish || '未指定'}
釣法：${technique || '未指定'}${planContext}

請辨識照片中的：
- 魚竿（品牌、型號、規格）
- 捲線器（品牌、型號）
- 釣線（種類）
- 浮標（種類、大小）
- 鉤子（種類）
- 餌料（活餌、假餌等）
- 其他配件（鉛墜、磯釣袋、抄網等）

只輸出以下 JSON 格式（不要有任何其他文字）：
{
  "summary": "簡短描述辨識到的裝備（50字以內）",
  "items": ["魚竿：XXX竿XX號", "捲線器：XX2000番", "浮標：橢圓型XX號", "餌料：活蝦", "配件：磯釣袋"],
  "recommendation": "根據辨識到的裝備和目標魚種，建議如何搭配使用（100字以內，具體說明竿/輪/線/餌的搭配）",
  "missing": ["建議補充但照片中沒看到的重要裝備"],
  "rod": { "spec": "辨識到的竿子規格" },
  "reel": { "spec": "辨識到的捲線器規格" },
  "mainLine": { "type": "辨識到或推測的主線" },
  "leader": { "type": "辨識到或推測的子線" },
  "hook": { "type": "辨識到的鉤子" },
  "weight": { "type": "辨識到的鉛墜" },
  "float": { "use": true, "spec": "辨識到的浮標或null" },
  "baits": [{ "name": "辨識到的餌料", "type": "活餌/假餌/粉餌", "howTo": "建議使用方式", "priority": 1 }],
  "accessories": ["辨識到的配件"]
}`;

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: photoBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const text = (msg.content[0] as any).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 回應格式錯誤');

    const json = JSON.parse(match[0]);
    return NextResponse.json(json);
  } catch (error: any) {
    console.error('Gear analyze error:', error);
    return NextResponse.json({ error: error.message || '裝備辨識失敗' }, { status: 500 });
  }
}
