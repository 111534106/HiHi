AI 簡報產生器 (完整教學與程式碼)

這是一份完整的教學文件，包含了你需要的所有步驟和程式碼。請從「步驟一」開始，依序操作。

步驟一：取得 Google API 金鑰 (你唯一需要的鑰匙)

前往 Google AI Studio 並登入。

在頁面左側，點選 Get API key (取得 API 金鑰)。

點選 Create API key in new project (在 thermostats 專案中建立 API 金鑰)。

你會得到一長串祕密金鑰 (看起來像 AIzaSy...)。

立刻將這串金鑰複製並貼到你電腦的記事本上。這個金鑰只會顯示這一次，關掉視窗後就看不到了。
([安全提醒] 絕對不要將此金鑰分享給任何人！)

步驟二：將你的程式碼上傳到 GitHub

註冊/登入 GitHub：前往 GitHub 並登入。

建立新倉庫：

點選右上角的 + 號，選擇 New repository (新倉庫)。

Repository name (倉庫名稱)：幫它取個名字，例如 my-ai-presenter (或 HiHi)。

選擇 Public (公開)。

點選 Create repository (建立倉庫)。

上傳檔案 (關鍵步驟)：

在你新倉庫的頁面上 (例如 HiHi 倉庫)，點選藍色的 creating a new file (建立新檔案) 連結。

建立 index.html：

在檔名欄位輸入 index.html。

複製下面「檔案 A: index.html (前端介面)」的所有內容，貼上到 GitHub 的編輯框中。

捲到下面，點選綠色的 Commit changes (提交變更) 按鈕。

建立 package.json：

回到倉庫首頁 (這時你就會看到 Add file 按鈕了)。

點選 Add file -> Create new file。

在檔名欄位輸入 package.json。

複製下面「檔案 C: package.json (後端設定檔)」的所有內容，貼上並儲存。

點選 Commit changes (提交變更)。

建立 api/generate.js：

再回到倉庫首頁，點選 Add file -> Create new file。

(關鍵！) 在檔名欄位輸入 api/generate.js (當你輸入 api 和 / 時，GitHub 會自動幫你建立 api 資料夾)。

複製下面「檔案 B: api/generate.js (雲端後端 - 最終修正版)」的所有內容，貼上並儲存。

點選 Commit changes (提交變更)。

檢查結構：

現在，你的 GitHub 倉庫檔案結構看起來應該像這樣：

my-ai-presenter/
├── index.html
├── package.json
└── api/
    └── generate.js


(這個 api 資料夾結構是 Vercel 的關鍵！)

步驟三：用 Vercel 部署你的網站

註冊/登入 Vercel：

前往 Vercel。

強烈建議點選 Continue with GitHub (以 GitHub 帳號繼續)，這樣最快。

Vercel 會要求授權存取你的 GitHub 帳號，請點選 Authorize Vercel (授權)。

匯入你的專案：

登入 Vercel 儀表板後，點選 Add New... -> Project (新增專案)。

Vercel 會顯示你所有的 GitHub 倉庫。找到你剛剛建立的 my-ai-presenter (或 HiHi) 倉庫，點選它右邊的 Import (匯入)。

設定專案 (最重要的步驟)：

Vercel 會顯示 New Project 頁面 (就像你上次 image_f6f2c2.png 的截圖)。

Project Name (專案名稱) 可以保持預設 (例如 hi-hi)。

（關鍵！） 找到並展開 Environment Variables (環境變數) 區塊。

在 Name (名稱) 欄位，精確地輸入：GEMINI_API_KEY

在 Value (值) 欄位，貼上你**在「步驟一」**取得的那串 Google API 金鑰 (AIzaSy...)。

點選 Add (新增)。

部署！

完成環境變數設定後，捲到最下方，點選黑色的 Deploy (部署) 按鈕。

步驟四：恭喜！你的網站上線了

Vercel 會開始部署你的網站（通常需要 1-2 分鐘）。

當它顯示 Congratulations! (恭喜！) 時，你的網站就上線了。

Vercel 會給你一個公開網址 (例如：hi-hi.vercel.app)。

點選這個網址，你就會看到你的 index.html 介面。

現在，任何人（包括你）都可以透過這個網址使用你的 AI 簡報產生器了！

檔案 A: index.html (前端介面)

請複製這整段程式碼，並貼到 GitHub 的 index.html 檔案中。

<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 簡報產生器</title>
    <!-- 載入 Tailwind CSS -->
    <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
    <link href="[https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&display=swap)" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', 'Noto Sans TC', sans-serif;
        }
        .slide {
            display: none;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
            min-height: 450px; /* 最小高度 */
        }
        .slide.active {
            display: block;
            opacity: 1;
        }
        /* 簡易 loading 轉圈動畫 */
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gray-100 flex flex-col items-center justify-start min-h-screen p-4 md:p-8">

    <!-- 1. 輸入區域 -->
    <div class="w-full max-w-4xl mb-4 p-4 bg-white rounded-lg shadow-lg">
        <h2 class="text-xl font-bold mb-3 text-gray-800">AI 簡報產生器</h2>
        
        <div class="mb-3">
            <label for="topic-input" class="block text-sm font-medium text-gray-700 mb-1">簡報主題 (必填)</label>
            <input type="text" id="topic-input" class="w-full border border-gray-300 rounded-lg p-3 text-base" placeholder="例如：AI 對未來工作的影響">
        </div>

        <div class="mb-3">
            <label for="context-input" class="block text-sm font-medium text-gray-700 mb-1">貼上您的現有資料 (選填)</label>
            <textarea id="context-input" rows="8" class="w-full border border-gray-300 rounded-lg p-3 text-base" placeholder="將您的草稿、筆記或任何相關文字貼在這裡，AI 會為您整理成簡報..."></textarea>
            
            <div class="flex items-center justify-between mt-2">
                <span class="text-sm text-gray-500">或上傳 .txt 純文字檔案：</span>
                <input type="file" id="file-input" accept=".txt, text/plain" class="text-sm text-gray-600
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 transition duration-150
                ">
            </div>
        </div>

        <button id="generate-btn" class="w-full bg-blue-600 text-white font-medium py-3 px-5 rounded-lg hover:bg-blue-700 transition duration-200 shadow-md">
            <span id="btn-text">生成簡報</span>
            <span id="btn-loading" class="hidden">生成中...</span>
        </button>
    </div>

    <!-- 2. 讀取中提示 -->
    <div id="loading-indicator" class="w-full max-w-4xl mb-4 p-6 bg-white rounded-lg shadow-lg text-center hidden">
        <div class="loader mx-auto"></div>
        <p class="text-gray-600 mt-3">AI 正在生成中，請稍候... (可能需要 10-20 秒)</p>
    </div>

    <!-- 3. 簡報顯示區域 -->
    <div id="presentation-container" class="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden hidden">
        <!-- 簡報標題 -->
        <header class="bg-gray-800 text-white p-4">
            <h1 id="presentation-title" class="text-xl md:text-2xl font-bold text-center"></h1>
        </header>

        <!-- 投影片內容區域 -->
        <main id="slide-container" class="p-6 md:p-10 relative">
            <!-- 投影片將由 JavaScript 動態插入此處 -->
        </main>

        <!-- 導覽控制 -->
        <footer class="bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center">
            <button id="prev-btn" class="bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition duration-200">
                &larr; 上一頁
            </button>
            <div id="slide-counter" class="text-sm text-gray-600">
                第 <span id="current-slide-num">1</span> / <span id="total-slides-num">1</span> 頁
            </div>
            <button id="next-btn" class="bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition duration-200">
                下一頁 &rarr;
            </button>
        </footer>
    </div>

    <script>
        let currentSlideIndex = 0;
        let slides = [];
        let totalSlides = 0;

        // 取得 DOM 元素
        const generateBtn = document.getElementById('generate-btn');
        const topicInput = document.getElementById('topic-input');
        const contextInput = document.getElementById('context-input');
        const fileInput = document.getElementById('file-input');
        const loadingIndicator = document.getElementById('loading-indicator');
        const presentationContainer = document.getElementById('presentation-container');
        
        const slideContainer = document.getElementById('slide-container');
        const presentationTitle = document.getElementById('presentation-title');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const currentSlideNumEl = document.getElementById('current-slide-num');
        const totalSlidesNumEl = document.getElementById('total-slides-num');

        // 渲染投影片
        function renderSlidesUI(presentationData) {
            slideContainer.innerHTML = ''; // 清空
            presentationTitle.textContent = presentationData.presentation_title;
            
            slides = presentationData.slides;
            totalSlides = slides.length;

            slides.forEach((slide, index) => {
                const slideEl = document.createElement('div');
                slideEl.id = `slide-${index}`;
                slideEl.className = 'slide w-full';

                const title = document.createElement('h2');
                title.className = 'text-2xl md:text-3xl font-bold text-gray-900 mb-6';
                title.textContent = slide.slide_title;
                slideEl.appendChild(title);

                const contentList = document.createElement('ul');
                contentList.className = 'list-disc list-inside space-y-3 text-gray-700 text-base md:text-lg';
                slide.slide_content.forEach(point => {
                    const item = document.createElement('li');
                    item.textContent = point;
                    contentList.appendChild(item);
                });
                slideEl.appendChild(contentList);
                
                const suggestion = document.createElement('div');
                suggestion.className = 'mt-8 p-3 bg-gray-50 border border-gray-200 rounded-lg';
                suggestion.innerHTML = `
                    <h4 class="font-semibold text-sm text-gray-600">AI 圖片建議：</h4>
                    <p class="text-sm text-gray-500 italic">${slide.image_suggestion}</p>
                `;
                slideEl.appendChild(suggestion);

                slideContainer.appendChild(slideEl);
            });

            totalSlidesNumEl.textContent = totalSlides;
        }

        // 顯示投影片
        function showSlide(index) {
            const currentActive = document.querySelector('.slide.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            const newSlide = document.getElementById(`slide-${index}`);
            if (newSlide) {
                newSlide.classList.add('active');
            }
            currentSlideNumEl.textContent = index + 1;
            currentSlideIndex = index;
            updateControls();
        }

        // 更新按鈕
        function updateControls() {
            prevBtn.disabled = (currentSlideIndex === 0);
            nextBtn.disabled = (currentSlideIndex === totalSlides - 1);
            if (totalSlides <= 1) {
                 prevBtn.disabled = true;
                 nextBtn.disabled = true;
            }
        }

        prevBtn.addEventListener('click', () => {
            if (currentSlideIndex > 0) showSlide(currentSlideIndex - 1);
        });

        nextBtn.addEventListener('click', () => {
            if (currentSlideIndex < totalSlides - 1) showSlide(currentSlideIndex + 1);
        });

        // 綁定「上傳檔案」事件
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type !== "text/plain") {
                    alert("僅支援 .txt 純文字檔案。");
                    event.target.value = null; return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    contextInput.value = e.target.result; // 填入文字框
                };
                reader.onerror = (e) => { alert("檔案讀取失敗。"); };
                reader.readAsText(file);
                event.target.value = null;
            }
        });

        // 綁定「生成」按鈕事件
        generateBtn.addEventListener('click', async () => {
            const topic = topicInput.value;
            const context = contextInput.value;

            if (!topic) {
                alert('請輸入簡報主題');
                return;
            }

            // 1. 開始讀取
            loadingIndicator.classList.remove('hidden');
            presentationContainer.classList.add('hidden'); // 隱藏舊的簡報
            generateBtn.disabled = true;
            generateBtn.querySelector('#btn-text').classList.add('hidden');
            generateBtn.querySelector('#btn-loading').classList.remove('hidden');

            try {
                // 2. 呼叫我們的「雲端後端」
                // Vercel 會自動把 /api/generate.js 變成一個公開的 API 端點
                // [注意] 我們使用相對路徑 '/api/generate'
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // 把 topic 和 context 一起傳過去
                    body: JSON.stringify({ topic: topic, context: context })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || '後端伺服器錯誤');
                }

                const data = await response.json(); // 這就是 AI 產生的 JSON

                // 3. 渲染新的簡報
                renderSlidesUI(data);
                showSlide(0); // 顯示第一張
                presentationContainer.classList.remove('hidden'); // 顯示簡報區

            } catch (error) {
                console.error('生成失敗:', error);
                alert('簡報生成失敗：\n' + error.message);
            } finally {
                // 4. 結束讀取
                loadingIndicator.classList.add('hidden');
                generateBtn.disabled = false;
                generateBtn.querySelector('#btn-text').classList.remove('hidden');
                generateBtn.querySelector('#btn-loading').classList.add('hidden');
            }
        });

    </script>
</body>
</html>


檔案 B: api/generate.js (雲端後端 - 最終修正版)

請複製這整段程式碼，並貼到 GitHub 的 api/generate.js 檔案中。

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


檔案 C: package.json (後端設定檔)

請複製這整段程式碼，並貼到 GitHub 的 package.json 檔案中。

{
  "name": "ai-presenter-cloud",
  "version": "1.0.0",
  "description": "AI 簡報產生器的 Vercel 後端",
  "main": "api/generate.js",
  "type": "module",
  "dependencies": {
    "@google/generative-ai": "^0.15.0"
  }
}
