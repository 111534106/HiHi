// api/generate.js - Vercel Serverless Function（無需 express）
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const aiSystemInstruction = `
你是一個專業簡報設計師。根據主題與補充資料，生成 1-20 頁投影片。
每頁包含：
- title: 投影片標題
- bullets: 2~5 個重點（陣列）
- notes: 講者備註（選填）

輸出純 JSON：
{
  "slides": [
    {
      "title": "標題",
      "bullets": ["重點1", "重點2"],
      "notes": "講者說..."
    }
  ]
}
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST' });
  }

  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY 未設定' });
  }

  const { topic, contextText = '', pageCount = 5, richness = 'balanced' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: '請提供主題' });
  }

  const pages = Math.max(1, Math.min(pageCount, 20));
  const richnessPrompt = richness === 'concise' ? '精簡' : richness === 'verbose' ? '詳細' : '適中';

  const userMessage = `
主題：${topic}
補充資料：${contextText || '無'}
頁數：${pages}
豐富度：${richnessPrompt}
請生成 ${pages} 頁投影片，嚴格遵循 JSON 格式。
`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: aiSystemInstruction,
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(userMessage);
    let text = result.response.text();

    // 清理 ```json 包裝
    text = text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ ok: false, raw: text, warning: 'JSON 解析失敗' });
    }

    if (!data.slides || !Array.isArray(data.slides)) {
      return res.status(500).json({ ok: false, raw: text, warning: '格式錯誤' });
    }

    res.status(200).json({ ok: true, slides: data.slides.slice(0, 20) });

  } catch (error) {
    console.error('AI 錯誤:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
}
