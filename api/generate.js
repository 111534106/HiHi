// 這就是 server.js 的「Vercel 雲端版本」
// Vercel 會自動將 /api 資料夾中的 .js 檔案變成「Serverless Function」

import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. 取得你儲存在 Vercel 的 API 金鑰
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. [!! 功能更新 !!] AI 提示 (System Instruction)
const aiSystemInstruction = `
你是一個專業的簡報設計師。
你的任務是根據使用者提供的「主題」，並**優先使用**使用者提供的「現有資料」（如果有的話），來產生一份結構完整的簡報內容。

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
`;

// 3. 你的 JSON 結構 (Schema) - (與本機版相同)
const aiSchema = {
    "type": "object",
    "properties": {
      "presentation_title": {
        "type": "string",
        "description": "簡報的主標題"
      },
      "slides": {
        "type": "array",
        "description": "包含所有投影片的陣列",
        "items": {
          "type": "object",
          "properties": {
            "slide_number": {
              "type": "integer",
              "description": "投影片的編號 (例如：1)"
            },
            "slide_title": {
              "type": "string",
              "description": "這張投影片的標題"
            },
            "slide_content": {
              "type": "array",
              "description": "這張投影片的內容要點 (字串陣列)",
              "items": {
                "type": "string"
              }
            },
            "image_suggestion": {
              "type": "string",
              "description": "這張投影片的建議配圖描述"
            }
          },
          "required": ["slide_number", "slide_title", "slide_content", "image_suggestion"]
        }
      }
    },
    "required": ["presentation_title", "slides"]
};


// 4. Vercel 的 Serverless Function 主體
export default async function handler(req, res) {
    // 只接受 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '僅允許 POST 方法' });
    }

    // [!!] 檢查金鑰是否存在
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: '伺服器金鑰尚未設定 (GEMINI_API_KEY is missing)' });
    }

    try {
        // [!! 功能更新 !!] 同時取得 topic 和 context
        const { topic, context } = req.body;
        if (!topic) {
            return res.status(400).json({ error: '請提供主題 (topic)' });
        }

        // [!! 功能更新 !!] 組合給 AI 的最終訊息
        const userMessage = `
        簡報主題：${topic}

        現有資料（請優先使用此資料）：
        ${context || '無'}
        `;

        // 取得 AI 模型
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest", // 使用最新的 Flash 模型
            systemInstruction: aiSystemInstruction,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: aiSchema // [關鍵] 強制 AI 輸出 JSON
            }
        });

        const chat = model.startChat();
        const result = await chat.sendMessage(userMessage); // [!!] 傳送組合好的訊息
        const responseText = result.response.text();

        // 將 AI 回傳的 JSON 文字，解析後傳回給前端
        res.status(200).json(JSON.parse(responseText));

    } catch (error) {
        console.error("AI 生成失敗:", error);
        res.status(500).json({ error: error.message || 'AI 生成失敗，請查看後端日誌' });
    }
}
