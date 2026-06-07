import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function detectMediaType(b64: string): string {
  const bytes = Buffer.from(b64.substring(0, 16), 'base64');
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

export async function POST(request: NextRequest) {
  try {
    const { photoBase64 } = await request.json();
    if (!photoBase64) return NextResponse.json({ error: '請提供照片' }, { status: 400 });

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: detectMediaType(photoBase64) as any, data: photoBase64 },
          },
          {
            type: 'text',
            text: `你是台灣魚類專家。請辨識這張照片中的魚，只輸出JSON：
{
  "name": "魚種中文名",
  "scientificName": "學名",
  "confidence": 90,
  "description": "簡短描述（30字以內）",
  "estimatedWeight_g": 500,
  "estimatedLength_cm": 30,
  "isProtected": false,
  "protectedNote": "若為保育類請說明（否則null）",
  "legalSize_cm": 25,
  "belowLegalSize": false,
  "edible": true,
  "cookingTips": "簡短料理建議",
  "habitat": "主要棲息環境",
  "season": "盛產季節",
  "alternativeNames": ["其他俗名"]
}`
          }
        ]
      }]
    });

    const text = (msg.content[0] as any).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('辨識失敗');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
