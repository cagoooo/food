# 🍱 美食管家 — 開發進度表 & 未來藍圖

> **最後更新：2026-02-26**　｜　當前版本：**v2.3.0 (Secure Architecture)**

---

## ✅ 已完成里程碑 (Complete Log)

### 🏗️ 基礎架構
- [x] **React + Vite 前端框架**：完整 SPA 架構
- [x] **Firebase Firestore**：訂單資料即時同步
- [x] **GitHub Pages 自動部署**：GitHub Actions CI/CD 完整流程
- [x] **RWD 響應式設計**：支援手機、平板、桌機
- [x] **Service Worker (PWA)**：離線快取 + 背景同步
- [x] **首屏效能優化**：React.lazy 程式碼分割
- [x] **離線訂單補發**：Background Sync 機制

### 🎨 視覺 & UX
- [x] **深色主題設計**：深藍 + 金色配色系統
- [x] **LandingPage 雙入口**：同事點餐 / 找找餐廳 分流介面
- [x] **Glassmorphism 視覺**：毛玻璃卡片、動態漸層
- [x] **Framer Motion 動畫**：頁面切換、卡片出現動畫
- [x] **AnimatePresence 修復**：mode=wait 多子元素警告消除
- [x] **震動回饋 (Haptic)**：Web Vibration API 觸感回應
- [x] **Web Audio 音效**：轉盤滴答聲 & 中獎音效

### 🎰 餐廳轉盤功能
- [x] **Canvas 轉盤**：物理慣性旋轉動畫
- [x] **Google Places API 整合**：GPS 定位 + 附近餐廳搜尋
- [x] **Places API 自動重試**：Google 500 暫時錯誤自動重試 2 次
- [x] **收藏 & 黑名單**：LocalStorage 持久化
- [x] **結果 Modal 完全重寫**：Portal + Flexbox 置中 (RWD)
- [x] **結果按鈕修復**：「導航前往」「再轉一次」「收藏」完全可點擊

### 🔐 安全性大升級（2026-02-26 核心重建）
- [x] **Gemini API Key 洩漏修復**：完全從前端移除
- [x] **Firebase Cloud Function 代理**：`analyzeMenu` 伺服器端調用
- [x] **GCP Secret Manager**：API Key 加密儲存雲端
- [x] **Repo 完整重建**：清除所有 git history 中的洩漏記錄
- [x] **Service Worker chrome-extension 修復**：排除非 HTTP scheme

### 🤖 AI 功能
- [x] **Gemini 菜單 OCR**：照片轉結構化菜單品項
- [x] **多圖批次辨識**：一次上傳多張菜單頁面
- [x] **重複品項去重**：相同名稱自動合併
- [x] **預覽確認介面**：辨識結果可勾選後匯入

---

## 🚧 進行中 / 待修復

- [ ] **Places API 偶發 500**：已加重試，但 Google 方面仍有機率再次發生
- [ ] **轉盤結果鈕 iOS 體驗**：iOS Safari pointer-events 有時行為差異

---

## 🗺️ 未來開發路線圖

> 依照建議優先順序排列，越前面越值得先做 ⬇️

---

### 🥇 優先級 Lv.1 — 高影響 × 低難度（強烈建議先做）

#### 📣 A. Firebase Cloud Messaging (FCM) 推送通知
- **解決什麼問題**：主揪忘記提醒同事截止點餐
- **功能設計**：
  - 點餐截止前 X 分鐘自動廣播通知
  - 新菜單上傳時通知所有人
  - 訂單成立確認回條
- **技術路線**：Firebase Auth (Google 登入) → 取得 FCM Token → Cloud Function 定時觸發通知
- **預估工時**：3-5 天

#### 📊 B. 統計分析 Dashboard v3
- **解決什麼問題**：主揪不知道同事喜好、訂單趨勢
- **功能設計**：
  - 每人最愛品項 Top 3（圓餅圖）
  - 每週各天點餐人數熱力圖
  - 最受歡迎品項排行榜
  - 月份訂單金額趨勢折線圖
- **技術路線**：從 Firestore 聚合查詢 → 純 CSS SVG 圖表（無外部依賴）
- **預估工時**：2-3 天

---

### 🥈 優先級 Lv.2 — 高影響 × 中難度（戰略加分功能）

#### 💳 C. 智慧帳單分拆 + 收款連結
- **解決什麼問題**：主揪每次要手動算錢、傳 LINE
- **功能設計**：
  - 自動計算每人金額（含加點/特殊選項）
  - 一鍵產生「LINE Pay 收款連結」或顯示 QRC code
  - 可截圖分享的帳單圖片（Canvas 繪製）
- **技術路線**：Canvas API 繪製帳單 → `canvas.toDataURL()` → 分享
- **預估工時**：3-4 天

#### 🔑 D. Google 真實帳號登入 (Firebase Auth)
- **解決什麼問題**：現在任何人都能用任意名稱點餐，無法追蹤
- **功能設計**：
  - Google Sign-In（無需輸入帳密）
  - 訂單與帳號綁定，不再匿名
  - 個人點餐歷史記錄查詢
- **技術路線**：`signInWithPopup(GoogleAuthProvider)` → UID 取代現有名稱標籤
- **預估工時**：2 天

#### 🧠 E. Gemini AI 點餐推薦引擎
- **解決什麼問題**：「今天要吃什麼？」→ AI 幫你決定
- **功能設計**：
  - 分析個人過去 30 天訂單習慣
  - 考量今日天氣（API 串接）推薦：「今天降溫，推薦暖呼呼的湯麵！」
  - 智慧搭配：自動推薦主餐 + 飲料 + 點心組合
- **技術路線**：Firestore 訂單記錄 → Cloud Function → Gemini 1.5 Flash → 回傳推薦結果
- **預估工時**：3-5 天

---

### 🥉 優先級 Lv.3 — 中等影響 × 可選（讓體驗更精緻）

#### ⏰ F. 點餐倒數計時器
- **功能**：主揪設定截止時間 → 所有人看板顯示即時倒數 → 時間到自動鎖定點餐
- **技術**：Firestore `deadlineAt` 欄位 + 前端 `setInterval` 倒數
- **預估工時**：1 天

#### 🔔 G. 訂單狀態即時同步看板
- **功能**：「5 位同事已點 / 2 位尚未點」的即時追蹤頁面
- **讓主揪知道**：誰點了、誰還沒點（可 tag 催促）
- **技術**：Firestore `onSnapshot` 即時監聽
- **預估工時**：1-2 天

#### 🗓️ H. 週期性訂餐排程
- **功能**：每週一固定提醒「今天輪到 A 同事主揪」
- **技術**：Cloud Scheduler + Cloud Function 定時任務
- **預估工時**：1-2 天

#### 🏷️ I. 品項標籤系統
- **功能**：菜單品項加上標籤（🌶️ 辣、🥗 素食、⚡ 招牌）
- **讓用戶過濾**：過敏原、飲食偏好快速篩選
- **預估工時**：1 天

---

### 🔭 Lv.4 — 長期願景（進階創新）

#### 🗺️ J. 餐廳轉盤進階版
- [ ] **更智慧的黑名單**：「本週已去」自動暫時排除
- [ ] **小組投票模式**：每人轉一次，票數最高的去
- [ ] **餐廳詳細資訊卡**：Google Maps 評論、照片輪播
- [ ] **歷史紀錄回顧**：「我們 2 月去哪吃了什麼」時間軸

#### 📱 K. 原生 PWA 完整優化
- [ ] **App Install Banner**：偵測 beforeinstallprompt → 引導加入主畫面
- [ ] **離線頁面設計**：斷網時顯示精美的離線提示
- [ ] **Push Notification** (搭配 FCM)

#### 🤝 L. 多餐廳 / 多場次支援
- 支援同一天點多家店（A 組點 A 店、B 組點 B 店）
- 跨部門協作點餐

#### 🌐 M. 多語言支援 (i18n)
- 基於 `react-i18next` 的繁/簡/英 三語切換

---

## 📐 技術債清單（建議修整）

| 項目 | 影響 | 優先度 |
|------|------|--------|
| `App.jsx` 超過 600 行 | 維護困難 | ⭐⭐⭐ |
| 轉盤邏輯 & UI 混在一個檔案 | 難以測試 | ⭐⭐ |
| `localStorage` 收藏無上限 | 大量數據時效能問題 | ⭐ |
| Firestore 安全規則需收緊 | 任意用戶可讀寫 | ⭐⭐⭐ |
| 無 Unit Test / E2E Test | 發布時無安全網 | ⭐⭐ |

---

## 🎯 建議下一步 (Quick Wins)

```
1. 🔐 Firebase Firestore 安全規則收緊（30 分鐘）
   → rules: request.auth != null
   → 防止匿名用戶直接讀寫

2. ⏰ 點餐截止倒數（1 天）
   → 主揪最需要的實用功能

3. 📊 統計 Dashboard v3（2-3 天）
   → 用圓餅圖 + 熱力圖讓數據更直觀

4. 🔑 Google 登入（2 天）
   → 開啟所有需要身份識別的高階功能的鑰匙
```

---

> [!TIP]
> **推薦路線**：`Firestore 安全規則` → `倒數計時器` → `Google 登入` → `FCM 推送通知` → `AI 推薦引擎`
>
> 每個功能都互相依賴，越前面的完成，後面越容易實作！

> [!NOTE]
> **AI 功能強化**：菜單 OCR 已透過 Firebase Cloud Function 安全實作。
> 下一步 AI 目標是「點餐推薦引擎」，核心技術架構（Cloud Function + Secret Manager）已就位，直接接 Gemini 即可。

---

*最後更新：2026-02-26 08:43　｜　版本：v2.3.0 Secure Architecture*
