/**
 * Firebase Cloud Function: Gemini API 安全代理
 * 將 Gemini API Key 保存在伺服器端，前端的 JS Bundle 永遠不含金鑰。
 */
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const fetch = require('node-fetch')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

initializeApp()

// 從 Firebase Secret Manager 讀取金鑰（安全、不出現在代碼中）
const geminiApiKey = defineSecret('GEMINI_API_KEY')
// 管理員 Google 帳號名單（逗號分隔），放在 Secret Manager，不寫進公開原始碼
const adminEmails = defineSecret('ADMIN_EMAILS')

const ALLOWED_ORIGINS = ['https://cagoooo.github.io', 'http://localhost:5173', 'http://localhost:4173']

/**
 * 驗證請求帶的 Firebase 登入憑證（Authorization: Bearer <ID Token>），
 * 並確認是名單內、信箱已驗證的 Google 帳號。回傳 { ok, status, error, email }。
 */
async function verifyAdmin(req) {
    const header = req.get('Authorization') || ''
    const match = header.match(/^Bearer (.+)$/)
    if (!match) {
        return { ok: false, status: 401, error: '請先用管理員 Google 帳號登入' }
    }
    let decoded
    try {
        decoded = await getAuth().verifyIdToken(match[1])
    } catch (err) {
        return { ok: false, status: 401, error: '登入已過期，請重新登入' }
    }
    const email = String(decoded.email || '').toLowerCase()
    const allowed = String(adminEmails.value() || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    if (!email || decoded.email_verified !== true || !allowed.includes(email)) {
        return { ok: false, status: 403, error: '這個帳號沒有管理員權限' }
    }
    return { ok: true, email }
}

// 前端登入後用來確認「這個 Google 帳號是不是管理員」
exports.checkAdmin = onRequest(
    {
        region: 'asia-east1',
        cors: ALLOWED_ORIGINS,
        secrets: [adminEmails],
        invoker: 'public',
        maxInstances: 2
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' })
        }
        const result = await verifyAdmin(req)
        if (!result.ok) {
            return res.status(result.status).json({ isAdmin: false, error: result.error })
        }
        return res.json({ isAdmin: true })
    }
)

exports.analyzeMenu = onRequest(
    {
        region: 'asia-east1',
        cors: ALLOWED_ORIGINS,
        secrets: [geminiApiKey, adminEmails],
        // 網址對外開放，但程式內會檢查管理員 Google 登入憑證；同時最多 3 台，避免費用暴衝
        invoker: 'public',
        maxInstances: 3
    },
    async (req, res) => {
        // 只允許 POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' })
        }

        // 只有名單內的管理員 Google 帳號可以使用 AI 辨識（會花 Gemini 費用）
        const admin = await verifyAdmin(req)
        if (!admin.ok) {
            return res.status(admin.status).json({ error: admin.error })
        }

        const { base64Image, mimeType } = req.body

        if (!base64Image) {
            return res.status(400).json({ error: '缺少 base64Image 參數' })
        }

        const apiKey = geminiApiKey.value()
        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API Key 未設定' })
        }

        const prompt = `你是一個菜單辨識助手。請仔細分析這張菜單圖片，並將所有品項以嚴格的 JSON 陣列格式輸出。

輸出規範：
- 每個品項為一個物件
- 欄位說明：
  - name (必填 string)：品項名稱
  - price (選填 number)：單一定價（若有多種尺寸則省略此欄位）
  - prices (選填 object)：多尺寸價格，key 為尺寸名稱（如 S/M/L 或 小/大），value 為 number
  - options (選填 string[])：客製化選項，如 ["加辣", "去冰", "微糖", "加飯"]
  - category (選填 string)：分類，如 "主食"、"湯品"、"飲品"、"點心"

輸出範例：
[
  {"name":"珍珠奶茶","prices":{"M":55,"L":65},"options":["去冰","微冰","少冰"],"category":"飲品"},
  {"name":"排骨便當","price":110,"options":["加飯+10"],"category":"主食"},
  {"name":"貢丸湯","price":35,"category":"湯品"}
]

重要規則：
1. 只輸出 JSON 陣列，不要有任何說明文字、markdown 格式或程式碼區塊
2. 若看不清楚價格，該品項的 price 設為 0
3. 品項名稱保持原文，不要翻譯或修改
4. 若圖片無法辨識為菜單，回傳空陣列 []`

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Image } }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            topP: 0.9,
                            maxOutputTokens: 4096,
                            thinkingConfig: { thinkingBudget: 0 }
                        }
                    })
                }
            )

            if (!response.ok) {
                const errData = await response.json()
                return res.status(502).json({ error: errData.error?.message || `Gemini API 錯誤 ${response.status}` })
            }

            const data = await response.json()
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

            // 清理並解析 JSON
            const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
            let parsed = []
            try {
                parsed = JSON.parse(cleanedText)
                if (!Array.isArray(parsed)) parsed = []
            } catch {
                return res.status(200).json({ items: [], rawText })
            }

            return res.status(200).json({ items: parsed })

        } catch (err) {
            console.error('analyzeMenu error:', err)
            return res.status(500).json({ error: err.message })
        }
    }
)
