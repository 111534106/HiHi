// api/generate.js - 最終穩定版（正確 arrayBuffer + .txt/.docx/.pdf）
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import pdf from "pdf-parse";

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

// 呼叫模型（支援備援 + 重試）
async function callGeminiWithRetryAndFallback(message, retries = 3) {
  const models = [
    { name: "gemini-2.5-flash", config: {} },
    { name: "gemini-1.5-flash", config: { temperature: 0.4 } }
  ];

  for (const { name, config } of models) {
    const model = genAI.getGenerativeModel({
      model: name,
      systemInstruction: aiSystemInstruction,
      generationConfig: { ...config, responseMimeType: "application/json" }
    });

    for (let i = 0; i < retries; i++) {
      try {
        const result = await model.generateContent(message);
        return result;
      } catch (error) {
        const errMsg = error.message || '';
        if (i < retries - 1 && (errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('overloaded'))) {
          const delay = (i + 1) * 2000 + Math.random() * 1000;
          console.warn(`模型 ${name} 過載，${delay/1000}秒後重試...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (name === models[models.length - 1].name) throw error;
        break;
      }
    }
  }
}

// 解析檔案（支援 .txt, .docx, .pdf）
async function parseFile(buffer, fileName) {
  const ext = fileName.split('.').pop().toLowerCase();

  if (ext === 'txt') {
    return new TextDecoder().decode(buffer);
  }

  if (ext === 'docx') {
    // 關鍵修正：轉為 ArrayBuffer
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (ext === 'pdf') {
    const data = await pdf(buffer);
    return data.text;
  }

  throw new Error(`不支援的檔案格式：.${ext}（僅支援 .txt, .docx, .pdf）`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '僅支援 POST' });
  }

  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY 未設定' });
  }

  const { topic, fileBase64 = '', fileName = '', pageCount = 5, richness = 'balanced' } = req.body;

  if (!topic) {
    return res.status(400).json({ error: '請提供主題' });
  }

  // 處理檔案上傳
  let contextText = '';
  if (fileBase64 && fileName) {
    try {
      // 關鍵：移除 data:xxx;base64, 並正確轉 Buffer
      const base64Data = fileBase64.split(';base64,').pop();
      const buffer = Buffer.from(base64Data, 'base64');
      contextText = await parseFile(buffer, fileName);
      contextText = contextText.trim();
    } catch (e) {
      console.error('檔案解析錯誤:', e.message);
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
    const result = await callGeminiWithRetryAndFallback(userMessage);
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
