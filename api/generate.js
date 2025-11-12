// api/generate.js
// Vercel serverless function for generating slide content via Google Generative AI
import { GoogleGenerativeAI } from '@google/generative-ai';

// 系統提示（system instruction）：要求模型輸出固定 JSON 結構
const aiSystemInstruction = `
你是一位專業的簡報設計師 (AI presenter assistant)。
輸出必須為有效的 JSON（不要包含多餘文字或程式碼區塊），且格式如下：
{
  "slides": [
    {
      "title": "第一頁標題",
      "bullets": ["要點 1", "要點 2", "..."],
      "notes": "備註或補充說明 (可選)"
    },
    ...
  ],
  "summary": "一段簡短總結 (一到兩句，非必需)"
}

要求：
- 請根據使用者提供的主題 (topic) 與補充內容 (contextText) 來生成投影片。
- 若使用者要求 "精簡"，bullets 應為短語或關鍵字；若為 "適中"，每條 bullets 為一句話；若為 "豐富"，可提供完整句子並包含 1-2 個延伸細節（但每頁 bullets 建議不超過 6 條）。
- 儘量生成接近使用者要求的頁數 (pageCount)，但若資料太少可適度合併或補充常識性內容（不要自創引用）。
- 不要輸出任何非 JSON 文本、說明或 debug 訊息。
`;

/**
 * 小工具：把文字限制到 maxLen 字元，並在過長時保留前後重點（簡單策略）
 */
function truncateTextForPrompt(text, maxLen = 4000) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  // 取前面的一部分 + 後面的一小段，讓模型仍能獲得上下文
  const head = text.slice(0, Math.floor(maxLen*0.7));
  const tail = text.slice(-Math.floor(maxLen*0.3));
  return head + "\n\n...（中間內容已截斷）...\n\n" + tail;
}

/**
 * 小工具：嘗試把 AI 回傳的文字清理成純 JSON
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  // 移除 code-fence
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    // 移除首尾 ``` 區塊，如果有語法標示也一併移掉
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length-1].startsWith("```")) lines.pop();
    t = lines.join("\n");
  }
  // 嘗試尋找第一個 { 與最後一個 }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = t.slice(first, last+1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // 解析失敗就返回 null，呼叫端會回傳原始文字供 debug
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  // 只接受 POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 檢查金鑰
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set.' });
  }

  // 初始化 client（只在有金鑰時）
  let genAI;
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.error('GenAI init error:', err);
    return res.status(500).json({ error: 'Failed to init GoogleGenerativeAI client.' });
  }

  try {
    // 從 body 取得參數（容錯）
    const {
      topic,
      contextText,    // 前端傳入的純文字 (user pasted / uploaded)
      pageCount = 5,  // 預設頁數
      richness = 'balanced' // 'concise' | 'balanced' | 'verbose'
    } = req.body || {};

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: '請提供主題 (topic)。' });
    }

    // 預處理 contextText：去頭尾空白並截斷
    const cleanedContext = truncateTextForPrompt(String(contextText || '').trim(), 3800);

    // 組出 user message（引導模型輸出 JSON）
    const userMessage = `
使用者主題：${topic.trim()}

使用者提供的補充資料（已截斷處理，若為空則忽略）：
${cleanedContext || "(無補充資料)"}

請依據上面資料產生簡報內容，輸出必須是有效 JSON（不要包含任何額外文字），格式請遵循 system instruction 中指定的 schema。
請根據以下額外規則來調整內容：
- pageCount: ${pageCount}
- richness: ${richness}
- 若資料不足以填滿頁數，可合理延伸一般性背景知識，但**不得**捏造引用或具體數據來源。
`;

    // 取得 Generative Model（保留你原本使用 gemini-pro 的做法）
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: aiSystemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1200, // 視情況調整
      },
    });

    // 開始會話並送出訊息
    const chat = model.startChat();
    const result = await chat.sendMessage(userMessage, {
      // 可以調整 temperature、candidateCount 等參數
      temperature: 0.2,
      candidateCount: 1,
    });

    // 取回文字
    const responseText = (result && result.response && result.response.text) ? result.response.text() : (result.response || '');

    // 嘗試直接解析成 JSON（先清理 code-fence 等）
    const parsed = extractJsonFromText(responseText);

    if (parsed) {
      // 若成功解析，確保回傳結構化資料
      return res.status(200).json({
        ok: true,
        source: 'gemini-pro',
        slides: parsed.slides || parsed.pages || parsed.items || [],
        summary: parsed.summary || parsed.note || '',
        raw: responseText
      });
    } else {
      // 解析失敗：回傳原始文字以利除錯（前端可顯示原始結果）
      console.warn('AI 回傳但無法解析為 JSON，回傳原始文字供 debug。');
      return res.status(200).json({
        ok: false,
        warning: 'AI 回傳內容無法解析為預期 JSON 格式。請查看 raw 欄位。',
        raw: responseText
      });
    }

  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
