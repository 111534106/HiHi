// 更健壯的 Vercel Serverless generate.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System instruction（保留你原本的提示，可自行調整內容）
const aiSystemInstruction = `
你是一個專業的簡報設計師。
你的任務是根據使用者提供的「主題」，並**優先使用**使用者提供的「現有資料」（如果有的話），來產生一份結構完整的簡報內容。

- 如果使用者提供了「現有資料」（context），請你**必須**以這份資料為**主要**內容來進行總結和整理，來生成簡報。
- 如果使用者沒有提供「現有資料」，你才根據「主題」自行發揮。

你必須總是回傳嚴格的 JSON 格式。
簡報內容應包含：
1. 一份吸引人的「簡報主標題」(presentation_title)。
2. 一個包含 7 張投影片的陣列 (slides)。
每張投影片 (slide) 都必須包含：
1. 投影片編號 (slide_number)，從 1 開始。
2. 投影片標題 (slide_title)。
3. 投影片的內容要點 (slide_content)，這必須是一個包含 2 到 4 個字串的陣列。
4. 一張給設計師的「圖片建議」(image_suggestion)。
`;

// 讀 raw body 的 helper（在 req.body 為空時嘗試解析）
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', err => reject(err));
  });
}

// 更謹慎的 pickBestModel：列出 models，避開包含 "flash" 的，並檢查 metadata 是否支援 generateContent
async function pickBestModel(apiKey) {
  if (!apiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error('List models returned non-ok status', resp.status);
      return null;
    }
    const info = await resp.json();
    const models = Array.isArray(info.models) ? info.models : [];

    if (!models || models.length === 0) return null;

    // helper 判斷 model 是否明確支援 generateContent
    const supportsGenerate = (m) => {
      if (!m) return false;
      if (Array.isArray(m.supportedMethods) && m.supportedMethods.includes('generateContent')) return true;
      if (Array.isArray(m.supportedGeneration) && m.supportedGeneration.includes('generateContent')) return true;
      // fallback：檢查字串里有沒有 generate 的提示
      const s = JSON.stringify(m).toLowerCase();
      if (s.includes('generatecontent') || s.includes('generate')) return true;
      return false;
    };

    const prefs = ['gemini-1.5-pro','gemini-1.5','gemini-1.0','gemini-pro','gemini'];

    // 1) 首先找 preferred 且非 flash 且明確支援 generate 的 model
    for (const p of prefs) {
      const found = models.find(m => (m.name || '').includes(p) && !(m.name || '').toLowerCase().includes('flash') && supportsGenerate(m));
      if (found) return found.name || found;
    }

    // 2) 再找任何非 flash 且明確支援 generate 的 model
    const anyGen = models.find(m => !(m.name || '').toLowerCase().includes('flash') && supportsGenerate(m));
    if (anyGen) return anyGen.name || anyGen;

    // 3) 若沒 metadata，選擇任何 preferred 且非 flash 的 model 名稱（風險較高）
    for (const p of prefs) {
      const found = models.find(m => (m.name || '').includes(p) && !(m.name || '').toLowerCase().includes('flash'));
      if (found) return found.name || found;
    }

    // 4) 試找任何非 flash 的 model
    const nonFlash = models.find(m => !(m.name || '').toLowerCase().includes('flash'));
    if (nonFlash) return nonFlash.name || nonFlash;

    // 5) 最後的 fallback：回傳第一個 model name（最後手段）
    return models[0].name || models[0];
  } catch (err) {
    console.error('Failed to list models for picking best model:', err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '僅允許 POST 方法' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '伺服器金鑰尚未設定 (GEMINI_API_KEY is missing)' });
  }

  try {
    // 確保我們有 request body：嘗試使用解析後的 req.body，若為 undefined，則讀 raw body 並嘗試解析
    let body = req.body;
    if (!body || Object.keys(body).length === 0) {
      const raw = await readRawBody(req);
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (e) {
          console.warn('Raw body is not JSON:', e.message);
          body = {};
        }
      } else {
        body = {};
      }
    }

    const { topic, context } = body || {};

    if (!topic) {
      return res.status(400).json({
        error: '請提供主題 (topic) 在 JSON request body 中，例如: { "topic": "你的主題" }',
        hint: "請加上標頭 -H 'Content-Type: application/json' 並以 -d 提供 JSON"
      });
    }

    const userMessage = `簡報主題：${topic}\n\n現有資料（請優先使用此資料）：\n${context || '無'}`;

    // 選模型（try list models）
    let chosenModel = await pickBestModel(apiKey);
    if (!chosenModel) {
      // 最保守的 fallback：使用 models/gemini-1.5-pro 全名（若你的帳號沒有該 model 仍會失敗）
      chosenModel = 'models/gemini-1.5-pro';
    }

    console.log('Using model:', chosenModel);

    const model = genAI.getGenerativeModel({
      model: chosenModel,
      systemInstruction: aiSystemInstruction,
      generationConfig: { responseMimeType: 'application/json' }
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    // 清理可能的 ```json 包裝
    let cleaned = responseText;
    if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);

    const parsed = JSON.parse(cleaned.trim());
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('AI 生成失敗:', err);
    return res.status(500).json({ error: err.message || 'AI 生成失敗，請查看後端日誌' });
  }
}
