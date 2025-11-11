// 這就是 server.js 的「Vercel 雲端版本」
// Vercel 會自動將 /api 資料夾中的 .js 檔案變成「Serverless Function」

import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. 取得你儲存在 Vercel 的 API 金鑰
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. AI 提示 (System Instruction)
//    [!! 修正 !!] 由於 'gemini-pro' 不支援 'responseSchema'，
//    我們在提示中加入 JSON 範本來強化 AI 遵循格式的穩定性。
const aiSystemInstruction = `
你是一個專業的簡報設計師。
你的任務是根據使用者提供的「主題」，並**優先使用**使用者提供的「現有資料」（如果有的話），来產生一份結構完整的簡報內容。

- 如果使用者提供了「現有資料」（context），請你**必須**以這份資料為**主要**內容來進行總結和整理，生成簡報。
- 如果使用者沒有提供「現有資料」，你才根據「主題」自行發揮。

你必須總是回傳嚴格的 JSON 格式。
簡報內容應包含：
1.  一份吸引人的「簡報主標題」(presentation_title)。
2.  一個包含 7 張投影片的陣列 (slides)。
每張投影片 (slide) 都必須包含：
1.  投影片編號 (slide_number)，從 1 開始。
2.  投影片標題 (slide_title)，例如「封面」、「介紹」、「結論」等。
3.  投影片的內容要點 (slide_content)，這必須是一個包含 2 到 4 個字串的陣列。
4.  一張給設計師的「圖片建議」(image_suggestion)，用來描述這張投影片適合的配圖。

JSON 結構範本如下：
{
  "presentation_title": "範例標題",
  "slides": [
    {
      "slide_number": 1,
      "slide_title": "封面",
      "slide_content": ["要點1", "要點2"],
      "image_suggestion": "圖片建議1"
    },
    {
      "slide_number": 2,
      "slide_title": "介紹",
      "slide_content": ["要點A", "要點B", "要點C"],
      "image_suggestion": "圖片建議2"
    }
  ]
}
`;

// 3. Vercel 的 Serverless Function 主體
export default async function handler(req, res) {
    // 只接受 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '僅允許 POST 方法' });
    }

    // 檢查金鑰是否存在
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: '伺服器金鑰尚未設定 (GEMINI_API_KEY is missing)' });
    }

    try {
        // 同時取得 topic 和 context
        const { topic, context } = req.body;
        if (!topic) {
            return res.status(400).json({ error: '請提供主題 (topic)' });
        }

        // 組合給 AI 的最終訊息
        const userMessage = `
        簡報主題：${topic}

        現有資料（請優先使用此資料）：
        ${context || '無'}
        `;

        // [!! 最終修正 !!] 
        // 1. 更換為 'gemini-pro' 模型
        // 2. 移除 'responseSchema'，因為 gemini-pro 不支援
        const model = genAI.getGenerativeModel({ 
            model: "gemini-pro", 
            systemInstruction: aiSystemInstruction,
            generationConfig: {
                // 我們依賴 systemInstruction 來強制 JSON
                responseMimeType: "application/json", 
            }
        });

        const chat = model.startChat();
        const result = await chat.sendMessage(userMessage); // 傳送組合好的訊息
        const responseText = result.response.text();

        // [!! 清理修正 !!] 
        // 嘗試解析 AI 回傳的文字
        // 有時 AI 會在 JSON 外面包裝 ```json ... ```，我們需要把它去掉
        
        let cleanedText = responseText;
        if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText.substring(7); // 移除 "```json"
        }
        if (cleanedText.endsWith("```")) {
            cleanedText = cleanedText.substring(0, cleanedText.length - 3); // 移除 "```"
        }
        
        res.status(200).json(JSON.parse(cleanedText.trim()));

    } catch (error) {
        console.error("AI 生成失敗:", error);
        // 如果 AI 回傳的不是 JSON，JSON.parse 會失敗，也會進到這裡
        res.status(500).json({ error: error.message || 'AI 生成失敗，請查看後端日誌' });
    }
}
