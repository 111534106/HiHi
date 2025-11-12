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
- 儘量遵守使用者要求的 pageCount（若無法完全滿足，請說明並合理合併內容）。
- richness: 'concise' => bullets 用短語；'balanced' => 完整句子；'verbose' => 詳細句子(但每頁 bullets 最多 6 條)。
- 儘量使用使用者提供的 contextText 中的事實；若資料不足，可補述常見背景，但不得捏造具體引用或數據。
- 嚴格只輸出 JSON（不要包含額外說明或 code fence）。
`;

/**
 * 把文字限制到 maxLen 字元，並在過長時保留前後重點（簡單策略）
 */
function truncateTextForPrompt(text, maxLen = 3800) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  const head = text.slice(0, Math.floor(maxLen * 0.7));
  const tail = text.slice(-Math.floor(maxLen * 0.3));
  return head + "\n\n...（中間內容已截斷）...\n\n" + tail;
}

/**
 * 嘗試把 AI 回傳的文字清理成純 JSON
 */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  // 移除 code-fence
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length - 1].startsWith("```")) lines.pop();
    t = lines.join("\n");
  }
  // 找到第一個 { 與最後一個 }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = t.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 驗證金鑰
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set.' });
  }

  // 初始化 client
  let genAI;
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.error('GenAI init error:', err);
    return res.status(500).json({ error: 'Failed to init GoogleGenerativeAI client.' });
  }

  try {
    const {
      topic,
      contextText = '',
      pageCount = 5,
      richness = 'balanced'
    } = req.body || {};

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: '請提供主題 (topic)。' });
    }

    // 強制頁數上限 1..20
    const requested = parseInt(pageCount) || 5;
    const pageLimit = Math.max(1, Math.min(requested, 20));

    // 處理 contextText
    const cleanedContext = truncateTextForPrompt(String(contextText || '').trim(), 3800);

    // 組 user message（要求 JSON 輸出）
    const userMessage = `
使用者主題：${topic.trim()}

使用者提供的補充資料（已截斷處理）：
${cleanedContext || "(無補充資料)"}

請依據上面資料產生簡報內容，輸出必須是有效 JSON（請不要輸出任何額外文字），格式請遵循 system instruction 中指定的 schema。
額外要求：
- 請生成最多 ${pageLimit} 頁投影片（slides）。
- richness: ${richness}
`;

    // 取得模型（保留 gemini-pro）
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: aiSystemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1400
      },
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(userMessage, {
      temperature: 0.2,
      candidateCount: 1
    });

    // 取回文字（兼容不同版本回傳格式）
    const responseText = (result && result.response && typeof result.response.text === 'function')
      ? result.response.text()
      : (result && result.response) || '';

    // 嘗試解析 JSON
    const parsed = extractJsonFromText(String(responseText || ''));

    if (parsed && parsed.slides && Array.isArray(parsed.slides)) {
      // 成功解析出 slides
      return res.status(200).json({
        ok: true,
        source: 'gemini-pro',
        slides: parsed.slides.slice(0, pageLimit),
        summary: parsed.summary || '',
        raw: responseText
      });
    } else {
      // 解析失敗：回傳 raw 供前端 debug
      console.warn('AI 回傳但無法解析為 JSON，回傳原始文字供 debug。');
      return res.status(200).json({
        ok: false,
        warning: 'AI 回傳內容無法解析為預期 JSON 格式，請查看 raw 欄位。',
        raw: responseText
      });
    }

  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
