import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// === 🔑 你的 Google Gemini API 金鑰 ===
// 請確保在環境變數中設置 GOOGLE_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// === 🧠 系統提示：讓 AI 知道如何產出格式 ===
const aiSystemInstruction = `
你是一個簡報內容生成助理，請根據主題生成最多 20 頁投影片資料。
每一頁都應包含：
{
  "title": "投影片標題",
  "bullets": ["重點1", "重點2", "重點3"],
  "notes": "講者筆記"
}
請只輸出純 JSON 格式，不要包含多餘文字或代碼框。
`;

// === 🚀 自動重試功能（處理 503 / 429 錯誤）===
async function safeSendMessage(chat, msg, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chat.sendMessage(msg, { temperature: 0.4 });
    } catch (err) {
      const errorMsg = String(err);
      if (errorMsg.includes("503") || errorMsg.includes("429")) {
        console.warn(`⚠️ 模型過載，等待 2 秒後重試 (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("伺服器忙碌，請稍後再試。");
}

// === 🧩 主邏輯：生成簡報內容 ===
router.post("/", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "請提供主題 (topic)。" });
    }

    // 初始化模型
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: aiSystemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 3000
      },
    });

    const chat = model.startChat();

    const userMessage = `
請根據主題「${topic}」生成投影片內容。
最多 20 頁，格式嚴格遵守以下 JSON 結構：

{
  "slides": [
    {
      "title": "投影片標題",
      "bullets": ["重點1", "重點2", "重點3"],
      "notes": "講者筆記"
    }
  ]
}

請只輸出 JSON，不要包含其他說明或文字。
`;

    // 呼叫模型（含重試機制）
    const result = await safeSendMessage(chat, userMessage);

    // === 🧹 清理文字 ===
    let rawText = result.response.text();
    rawText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .replace(/```/g, "")
      .replace(/[\u0000-\u001F]+/g, "")
      .trim();

    // === 🧠 嘗試解析 JSON ===
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.warn("⚠️ AI 回傳格式錯誤，自動修正中...");
      const fixed = rawText
        .replace(/(\w+):/g, '"$1":')
        .replace(/'/g, '"')
        .replace(/,(\s*[}\]])/g, "$1"); // 移除多餘逗號
      data = JSON.parse(fixed);
    }

    // === 📏 限制頁數 ===
    if (data.slides && data.slides.length > 20) {
      data.slides = data.slides.slice(0, 20);
    }

    return res.json(data);

  } catch (error) {
    console.error("❌ 伺服器錯誤：", error);
    return res.status(500).json({
      error: error.message || "伺服器發生未知錯誤。"
    });
  }
});

export default router;
