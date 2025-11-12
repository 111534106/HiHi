// api/generate.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const aiSystemInstruction = `
你是一位專業的簡報設計師 (AI presenter assistant)。
輸出必須為有效的 JSON（不要包含多餘文字或程式碼區塊），格式如下：
{
  "slides": [
    {
      "title": "第一頁標題",
      "bullets": ["要點 1", "要點 2", "..."],
      "notes": "備註或補充說明 (可選)"
    },
    ...
  ],
  "summary": "簡短總結 (一到兩句，非必需)"
}

要求：
- 根據使用者主題 (topic) 與補充資料 (contextText) 生成簡報。
- pageCount 用戶指定數量（最多 20 頁）。
- richness: 'concise' => 短語；'balanced' => 完整句子；'verbose' => 詳細句子（每頁最多 6 條要點）。
- 儘量使用使用者提供資料，不足時可補充常識，但不得捏造引用或數據。
`;

function truncateTextForPrompt(text, maxLen = 3800) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  const head = text.slice(0, Math.floor(maxLen * 0.7));
  const tail = text.slice(-Math.floor(maxLen * 0.3));
  return head + "\n\n...（中間內容已截斷）...\n\n" + tail;
}

function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length - 1].startsWith("```")) lines.pop();
    t = lines.join("\n");
  }
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

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set.' });
  }

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

    const requested = parseInt(pageCount) || 5;
    const pageLimit = Math.max(1, Math.min(requested, 20));

    const cleanedContext = truncateTextForPrompt(String(contextText || '').trim(), 3800);

    const userMessage = `
使用者主題：${topic.trim()}

使用者提供的補充資料（已截斷處理）：
${cleanedContext || "(無補充資料)"}

請依據上面資料產生簡報內容，輸出必須是有效 JSON（請不要輸出任何額外文字），格式請遵循 system instruction 中指定的 schema。
額外要求：
- 生成最多 ${pageLimit} 頁投影片（slides）。
- richness: ${richness}
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",   // ← 更新為最新版模型
      systemInstruction: aiSystemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1600
      },
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(userMessage, {
      temperature: 0.2,
      candidateCount: 1
    });

    const responseText = (result && result.response && typeof result.response.text === 'function')
      ? result.response.text()
      : (result && result.response) || '';

    const parsed = extractJsonFromText(String(responseText || ''));

    if (parsed && Array.isArray(parsed.slides)) {
      return res.status(200).json({
        ok: true,
        source: 'gemini-2.5-pro',
        slides: parsed.slides.slice(0, pageLimit),
        summary: parsed.summary || '',
        raw: responseText
      });
    } else {
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
