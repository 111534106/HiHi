// api/generate.js - 全功能版（rate limit + 備援 + 檔案上傳）
import { GoogleGenerativeAI } from "@google/generative-ai";
import KV from "@vercel/kv";
import officeParser from "officeparser";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const kv = KV; // Vercel KV for rate limiting

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

// Rate limiting: 每分鐘 5 次（用 IP 或 user-agent）
async function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const key = `rate:${ip}`;
  const now = Date.now();
  const window = 60 * 1000; // 1 分鐘
  const limit = 5;

  const calls = await kv.zrange(key, 0, -1, { withScores: true });
  const recent = calls.filter(([, timestamp]) => now - timestamp < window);
  if (recent.length >= limit) {
    throw new Error('請求過多，請 1 分鐘後再試');
  }
  await kv.zadd(key, { score: now, member: now.toString() });
  setTimeout(() => kv.zrem(key, now.toString()), window);
}

// 呼叫模型（支援備援）
async function callGeminiWithRetryAndFallback(model, message, retries = 3) {
  const models = [
    { name: "gemini-2.5-flash", config: {} },
    { name: "gemini-1.5-flash", config: { temperature: 0.4 } } // 備援
  ];

  for (const { name, config } of models) {
    const fallbackModel = genAI.getGenerativeModel({
      model: name,
      systemInstruction: aiSystemInstruction,
      generationConfig: { ...config, responseMimeType: "application/json" }
    });

    for (let i = 0; i < retries; i++) {
      try {
        return await fallbackModel.generateContent(message);
      } catch (error) {
        const errMsg = error.message || '';
        if (i < retries - 1 && (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('overloaded'))) {
          const delay = (i + 1) * 2000 + Math.random() * 1000;
          console.warn(`模型 ${name} 過載，${delay/1000}秒後重試...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (name === models[models.length - 1].name) throw error; // 最後模型失敗才拋
        break; // 切換下個模型
      }
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST' });
  }

  try {
    await checkRateLimit(req); // Rate limit
  } catch (e) {
    return res.status(429).json({ error: e.message });
  }

  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY 未設定' });
  }

  const { topic, fileBase64 = '', pageCount = 5, richness = 'balanced' } = req.body; // fileBase64 從前端傳 base64

  if (!topic) {
    return res.status(400).json({ error: '請提供主題' });
  }

  // 處理檔案上傳（base64 轉文字）
  let contextText = '';
  if (fileBase64) {
    try {
      const buffer = Buffer.from(fileBase64.split(',')[1], 'base64'); // 移除 data: URL prefix
      const text = await officeParser(buffer); // 提取文字
      contextText = text;
    } catch (e) {
      return res.status(400).json({ error: '檔案解析失敗：' + e.message });
    }
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
    const result = await callGeminiWithRetryAndFallback(null, userMessage);
    let text = result.response.text();

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
    res.status(500).json({ ok: false, error: '生成失敗，請稍後再試' });
  }
}
