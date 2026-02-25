// 菜單管理元件 (管理者專用)
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Plus, Trash2, Edit2, Save, X, Upload, Camera,
    Coffee, DollarSign, FileText, Loader, AlertCircle,
    CheckSquare, Square, XSquare, Sparkles, Bot
} from 'lucide-react'
import {
    subscribeToMenu,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addMenuItems
} from '../services/firebase'

const MenuManager = () => {
    const [menuItems, setMenuItems] = useState([])
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [loading, setLoading] = useState(false)
    const [ocrLoading, setOcrLoading] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef(null)
    const aiFileInputRef = useRef(null)   // AI OCR 專用 ref

    // AI OCR 模式狀態
    const [aiOcrLoading, setAiOcrLoading] = useState(false)
    const [aiOcrResult, setAiOcrResult] = useState(null) // 原始 AI 回應文字（供除錯）

    // 批次刪除狀態
    const [selectMode, setSelectMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState(new Set())

    // OCR 預覽狀態
    const [previewItems, setPreviewItems] = useState([])
    const [showPreview, setShowPreview] = useState(false)

    // 菜單模板狀態
    const [menuTemplate, setMenuTemplate] = useState('auto')
    const [showTemplateSelector, setShowTemplateSelector] = useState(false)

    // 模板定義
    const MENU_TEMPLATES = {
        auto: {
            name: '🔍 自動偵測',
            desc: '智能判斷菜單格式',
            sizeKeys: null
        },
        chinese: {
            name: '🍜 中式餐廳',
            desc: '小碗/大碗 價格',
            sizeKeys: ['小', '大']
        },
        drinks: {
            name: '🥤 飲料店',
            desc: 'S/M/L 尺寸價格',
            sizeKeys: ['S', 'M', 'L']
        },
        bento: {
            name: '🍱 便當店',
            desc: '單一價格',
            singlePrice: true
        },
        combo: {
            name: '🍽️ 套餐組合',
            desc: 'N號餐 + 內容',
            comboFormat: true
        }
    }

    // 新增表單狀態
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        description: '',
        hasMultipleSizes: false,
        prices: { S: '', M: '', L: '' }
    })

    // 訂閱菜單
    useEffect(() => {
        const unsubscribe = subscribeToMenu(setMenuItems)
        return () => unsubscribe()
    }, [])

    // 重置表單
    const resetForm = () => {
        setNewItem({
            name: '',
            price: '',
            description: '',
            hasMultipleSizes: false,
            prices: { S: '', M: '', L: '' }
        })
        setShowAddForm(false)
        setEditingItem(null)
        setError('')
    }

    // 新增菜單項目
    const handleAddItem = async () => {
        if (!newItem.name.trim()) {
            setError('請輸入品項名稱')
            return
        }

        if (newItem.hasMultipleSizes) {
            const validPrices = Object.entries(newItem.prices).filter(([, v]) => v)
            if (validPrices.length === 0) {
                setError('請至少輸入一個尺寸價格')
                return
            }
        } else if (!newItem.price) {
            setError('請輸入價格')
            return
        }

        setLoading(true)
        try {
            const itemData = {
                name: newItem.name.trim(),
                description: newItem.description.trim() || null
            }

            if (newItem.hasMultipleSizes) {
                itemData.prices = Object.fromEntries(
                    Object.entries(newItem.prices)
                        .filter(([, v]) => v)
                        .map(([k, v]) => [k, parseInt(v)])
                )
            } else {
                itemData.price = parseInt(newItem.price)
            }

            await addMenuItem(itemData)
            resetForm()
        } catch (err) {
            setError('新增失敗：' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // 更新菜單項目
    const handleUpdateItem = async () => {
        if (!editingItem.name.trim()) {
            setError('請輸入品項名稱')
            return
        }

        setLoading(true)
        try {
            const updates = {
                name: editingItem.name.trim(),
                description: editingItem.description?.trim() || null
            }

            if (editingItem.hasMultipleSizes) {
                updates.prices = Object.fromEntries(
                    Object.entries(editingItem.prices)
                        .filter(([, v]) => v)
                        .map(([k, v]) => [k, parseInt(v)])
                )
                updates.price = null
            } else {
                updates.price = parseInt(editingItem.price)
                updates.prices = null
            }

            await updateMenuItem(editingItem.id, updates)
            resetForm()
        } catch (err) {
            setError('更新失敗：' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // 刪除菜單項目
    const handleDeleteItem = async (itemId) => {
        if (!confirm('確定要刪除此品項嗎？')) return

        try {
            await deleteMenuItem(itemId)
        } catch (err) {
            setError('刪除失敗：' + err.message)
        }
    }

    // 切換選擇模式
    const toggleSelectMode = () => {
        setSelectMode(!selectMode)
        setSelectedIds(new Set())
    }

    // 切換單一項目選擇
    const toggleItemSelect = (itemId) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId)
        } else {
            newSelected.add(itemId)
        }
        setSelectedIds(newSelected)
    }

    // 全選/取消全選
    const toggleSelectAll = () => {
        if (selectedIds.size === menuItems.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(menuItems.map(item => item.id)))
        }
    }

    // 批次刪除
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return

        if (!confirm(`確定要刪除選中的 ${selectedIds.size} 個品項嗎？`)) return

        setLoading(true)
        try {
            const deletePromises = Array.from(selectedIds).map(id => deleteMenuItem(id))
            await Promise.all(deletePromises)
            setSelectedIds(new Set())
            setSelectMode(false)
        } catch (err) {
            setError('批次刪除失敗：' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // OCR 圖片辨識（支援多張圖片）
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setOcrLoading(true)
        setError('')

        try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
            let allParsedItems = []
            let processedCount = 0

            // 逐一處理每張圖片
            for (const file of files) {
                processedCount++
                console.log(`處理圖片 ${processedCount}/${files.length}: ${file.name}`)

                // 將圖片轉為 base64
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result.split(',')[1])
                    reader.onerror = reject
                    reader.readAsDataURL(file)
                })

                // 呼叫 Google Cloud Vision API
                const response = await fetch(
                    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            requests: [{
                                image: { content: base64 },
                                features: [
                                    { type: 'DOCUMENT_TEXT_DETECTION' }  // 支援手寫與複雜排版
                                ]
                            }]
                        })
                    }
                )

                const data = await response.json()

                if (data.error) {
                    console.error(`圖片 ${file.name} 辨識失敗:`, data.error.message)
                    continue
                }

                const text = data.responses?.[0]?.fullTextAnnotation?.text || ''

                if (text) {
                    const parsedItems = parseMenuText(text)
                    allParsedItems = [...allParsedItems, ...parsedItems]
                }
            }

            // 去重複
            const seenNames = new Set()
            const uniqueItems = allParsedItems.filter(item => {
                if (seenNames.has(item.name)) return false
                seenNames.add(item.name)
                return true
            })

            if (uniqueItems.length === 0) {
                setError('無法從圖片中解析出菜單項目')
                return
            }

            // 顯示預覽
            setPreviewItems(uniqueItems.map((item, index) => ({
                ...item,
                id: `preview_${index}`,
                selected: true
            })))
            setShowPreview(true)

            if (files.length > 1) {
                console.log(`已合併 ${files.length} 張圖片，共 ${uniqueItems.length} 個品項`)
            }
        } catch (err) {
            console.error('OCR Error:', err)
            setError('圖片辨識失敗：' + err.message)
        } finally {
            setOcrLoading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // =============================================
    // 🤖 AI 智慧 OCR 2.0 (透過 Firebase Cloud Function 安全代理)
    // =============================================
    const handleAiOcr = async (e) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        // 📌 Cloud Function URL（安全代理 - Gemini API Key 在伺服器端，前端不可見）
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        const FUNCTION_URL = isLocalhost
            ? 'http://localhost:5001/vendor-5383c/asia-east1/analyzeMenu'
            : 'https://analyzemenu-dzebozreea-de.a.run.app'

        setAiOcrLoading(true)
        setError('')

        try {
            let allParsedItems = []

            for (const file of files) {
                // 1. 將圖片轉為 base64
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result.split(',')[1])
                    reader.onerror = reject
                    reader.readAsDataURL(file)
                })

                // 2. 呼叫 Firebase Cloud Function 代理（API Key 在伺服器端，前端不可見）
                const response = await fetch(FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base64Image: base64,
                        mimeType: file.type || 'image/jpeg'
                    })
                })

                if (!response.ok) {
                    const errData = await response.json()
                    throw new Error(errData.error || `Function 錯誤 ${response.status}`)
                }

                const data = await response.json()
                const parsed = Array.isArray(data.items) ? data.items : []
                allParsedItems = [...allParsedItems, ...parsed]
            }

            // 3. 去除重複品項
            const seenNames = new Set()
            const uniqueItems = allParsedItems.filter(item => {
                if (!item.name || seenNames.has(item.name)) return false
                seenNames.add(item.name)
                return true
            })

            if (uniqueItems.length === 0) {
                setError('AI 無法從圖片中辨識出菜單品項，請確認圖片清晰度。')
                return
            }

            // 4. 進入預覽介面
            setPreviewItems(uniqueItems.map((item, index) => ({
                id: `ai_preview_${index}`,
                name: item.name || '',
                price: item.prices ? undefined : (item.price || 0),
                prices: item.prices || null,
                options: item.options || [],
                category: item.category || '',
                selected: true
            })))
            setShowPreview(true)

        } catch (err) {
            console.error('[AI OCR] 錯誤:', err)
            setError('AI 辨識失敗：' + err.message)
        } finally {
            setAiOcrLoading(false)
            if (aiFileInputRef.current) {
                aiFileInputRef.current.value = ''
            }
        }
    }

    // 解析菜單文字 (優化版 v4 - 完整支援)
    const parseMenuText = (text) => {
        console.log('OCR 原始文字:', text)

        const items = []
        const seenNames = new Set()

        // 分割成行並清理
        const rawLines = text.split('\n').map(l => l.trim()).filter(l => l)

        // 完全跳過的行
        const isSkipLine = (line) => {
            const skipPatterns = [
                /^No[\.\s№]*$/i,
                /^品\s*名$/,
                /^價\s*格$/,
                /^數\s*量$/,
                /^總\s*計$/,
                /^商品$/,
                /^麵品$/,
                /^名$/,
                /^[小中大]碗/,
                /^[小中大]\/價格/,
                /小\/價格.*大\/?價格/,
                /價格\/數量/,
                /現燙滷味$/,
                /^\d+粒\d+$/  // 純粒數格式如 "15粒110"
            ]
            return skipPatterns.some(p => p.test(line))
        }

        // 判斷是否為純價格行
        const isPriceLine = (line) => {
            return /^\d{2,3}\/?$/.test(line) || /^\d+粒?\s*\d{2,3}/.test(line)
        }

        // 判斷是否為品名行
        const isItemNameLine = (line) => {
            if (/^\d+\s*[▶▲△]?\s*[\u4e00-\u9fff]/.test(line)) return true
            if (/^[▶▲△,，\|\[]?\s*[\u4e00-\u9fff]/.test(line)) return true
            return false
        }

        // 清理品名
        const cleanName = (name) => {
            return name
                .replace(/^\d+\s*/, '')              // 移除開頭編號
                .replace(/^[▶▲△●○,，\|\[]+\s*/, '') // 移除特殊符號
                .replace(/[\[\]「」【】\|]+/g, '')    // 移除括號
                .replace(/\d+粒\d+.*$/, '')          // 移除結尾的粒數價格
                .replace(/\s+/g, '')                 // 移除空格
                .trim()
        }

        // 驗證品名
        const isValidName = (name) => {
            if (!name || name.length < 2) return false
            if (/^\d+$/.test(name)) return false
            if (/^[小中大]碗?$/.test(name)) return false
            if (/系列$/.test(name) && name.length < 5) return false  // 排除純"系列"
            if (!/[\u4e00-\u9fff]/.test(name)) return false
            return true
        }

        // 提取價格（擴大範圍 15-200）
        const extractPrices = (text) => {
            // 移除粒數標記後提取價格
            const cleanText = text.replace(/\d+粒/g, ' ')
            const nums = cleanText.match(/\d+/g) || []
            return nums.map(n => parseInt(n)).filter(n => n >= 10 && n <= 2000)
        }

        // 提取帶斜線的價格（如 35/ 或 20/）
        const extractSlashPrices = (text) => {
            const matches = text.match(/(\d+)\s*\//g) || []
            return matches.map(m => parseInt(m.replace('/', '')))
        }

        // 添加品項的輔助函數
        const addItem = (name, prices) => {
            if (!isValidName(name) || seenNames.has(name)) return false

            // 取得模板設定
            const template = MENU_TEMPLATES[menuTemplate]

            // 便當店模式：只取第一個價格
            if (template.singlePrice && prices.length > 0) {
                items.push({ name, price: prices[0] })
                seenNames.add(name)
                return true
            }

            // 多尺寸模式
            if (prices.length >= 2 && prices[1] > prices[0]) {
                // 根據模板決定 size key
                let sizeKeys = template.sizeKeys || ['小', '大']

                // 如果是飲料店模板，使用 S/M/L
                if (menuTemplate === 'drinks') {
                    if (prices.length >= 3) {
                        items.push({ name, prices: { 'S': prices[0], 'M': prices[1], 'L': prices[2] } })
                    } else {
                        items.push({ name, prices: { 'S': prices[0], 'L': prices[1] } })
                    }
                } else {
                    items.push({ name, prices: { [sizeKeys[0]]: prices[0], [sizeKeys[1]]: prices[1] } })
                }
            } else if (prices.length > 0) {
                items.push({ name, price: prices[0] })
            } else {
                return false
            }
            seenNames.add(name)
            return true
        }

        // 遍歷行
        let i = 0
        while (i < rawLines.length) {
            const line = rawLines[i]

            // 跳過標題行
            if (isSkipLine(line)) {
                i++
                continue
            }

            // === 模式1: 套餐格式 (如 "151號餐:..." 或 "162號餐:...") ===
            const comboMatch = line.match(/[^\d]*(\d)(\d*)號餐[:\：]?\s*([\u4e00-\u9fff\(\)（）\+\/]+)/)
            if (comboMatch) {
                // 處理黏連編號：如 "151號餐" 最後一位數是編號
                const comboNum = comboMatch[2] ? comboMatch[1] + comboMatch[2] : comboMatch[1]
                const lastDigit = comboNum.slice(-1)  // 取最後一位作為真正編號
                const content = cleanName(comboMatch[3])
                const name = `${lastDigit}號餐:${content}`

                // 嘗試從同行或下行找價格
                let prices = extractPrices(line)
                if (prices.length === 0 && i + 1 < rawLines.length) {
                    prices = extractPrices(rawLines[i + 1])
                }

                if (addItem(name, prices)) {
                    i++
                    continue
                }
            }

            // === 模式2: 同一行包含品名和價格 ===
            const sameLineMatch = line.match(/([\u4e00-\u9fff\(\)（）\/\+]+)\s+(\d{2,3})(?:\s+(\d{2,3}))?/)
            if (sameLineMatch) {
                const name = cleanName(sameLineMatch[1])
                const prices = extractPrices(line)

                if (addItem(name, prices)) {
                    i++
                    continue
                }
            }

            // === 模式3: 帶斜線價格 (如 "涼拌小菜 35/") ===
            const slashMatch = line.match(/([\u4e00-\u9fff]+)\s+(\d+)\s*\//)
            if (slashMatch) {
                const name = cleanName(slashMatch[1])
                const prices = extractSlashPrices(line)

                if (prices.length > 0 && addItem(name, prices)) {
                    i++
                    continue
                }
            }

            // === 模式4: 粒數格式 (如 "牛肉湯餃(高麗/韮菜) 10粒 85") ===
            const portionMatch = line.match(/([\u4e00-\u9fff\(\)（）\/]+)\s*\d+粒\s*(\d{2,3})/)
            if (portionMatch) {
                const name = cleanName(portionMatch[1])
                const price = parseInt(portionMatch[2])

                if (isValidName(name) && !seenNames.has(name) && price >= 10 && price <= 2000) {
                    items.push({ name, price })
                    seenNames.add(name)
                    i++
                    continue
                }
            }

            // === 模式5: 品名在這一行，價格在下一行 ===
            if (isItemNameLine(line)) {
                let name = cleanName(line)
                let priceText = ''

                // 向前查看收集價格
                let j = i + 1
                while (j < rawLines.length && j <= i + 3) {
                    const nextLine = rawLines[j]
                    if (isPriceLine(nextLine) || /^\d{2,3}\/?$/.test(nextLine)) {
                        priceText += ' ' + nextLine
                        j++
                    } else if (isItemNameLine(nextLine) || isSkipLine(nextLine)) {
                        break
                    } else {
                        j++
                    }
                }

                const prices = extractPrices(priceText)

                if (addItem(name, prices)) {
                    i = j
                    continue
                }
            }

            i++
        }

        console.log(`解析結果: ${items.length} 個品項`, items)
        return items
    }

    // 開始編輯
    const startEdit = (item) => {
        // 處理價格格式：將中文 key (小/中/大) 轉為英文 key (S/M/L)
        let normalizedPrices = { S: '', M: '', L: '' }

        if (item.prices) {
            // 中文 key 對應
            if (item.prices['小']) normalizedPrices.S = item.prices['小']
            if (item.prices['中']) normalizedPrices.M = item.prices['中']
            if (item.prices['大']) normalizedPrices.L = item.prices['大']
            // 英文 key 對應
            if (item.prices.S) normalizedPrices.S = item.prices.S
            if (item.prices.M) normalizedPrices.M = item.prices.M
            if (item.prices.L) normalizedPrices.L = item.prices.L
        }

        setEditingItem({
            ...item,
            hasMultipleSizes: !!item.prices,
            price: item.price || '',
            prices: normalizedPrices
        })
    }

    // === OCR 預覽相關函數 ===

    // 更新預覽項目
    const updatePreviewItem = (id, field, value) => {
        setPreviewItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    // 更新預覽項目價格（多尺寸）
    const updatePreviewItemPrice = (id, size, value) => {
        setPreviewItems(prev => prev.map(item => {
            if (item.id !== id) return item
            return {
                ...item,
                prices: { ...item.prices, [size]: value ? parseInt(value) : '' }
            }
        }))
    }

    // 切換預覽項目選擇
    const togglePreviewItem = (id) => {
        setPreviewItems(prev => prev.map(item =>
            item.id === id ? { ...item, selected: !item.selected } : item
        ))
    }

    // 全選/取消全選預覽項目
    const toggleAllPreview = (selected) => {
        setPreviewItems(prev => prev.map(item => ({ ...item, selected })))
    }

    // 刪除預覽項目
    const deletePreviewItem = (id) => {
        setPreviewItems(prev => prev.filter(item => item.id !== id))
    }

    // 手動新增預覽項目
    const addPreviewItem = () => {
        const newId = `preview_new_${Date.now()}`
        setPreviewItems(prev => [...prev, {
            id: newId,
            name: '',
            price: '',
            prices: null,
            selected: true
        }])
    }

    // 確認匯入 (支援 options 與 category)
    const confirmImport = async () => {
        const selectedItems = previewItems.filter(item => item.selected && item.name.trim())

        if (selectedItems.length === 0) {
            setError('請至少選擇一個有效的品項')
            return
        }

        setLoading(true)
        try {
            // 準備匯入的資料（移除預覽用的 id 和 selected 欄位，保留 options/category）
            const itemsToImport = selectedItems.map(({ id, selected, ...rest }) => {
                const item = { ...rest }
                // 清理空值欄位
                if (!item.options || item.options.length === 0) delete item.options
                if (!item.category) delete item.category
                if (item.price === undefined) delete item.price
                if (!item.prices) delete item.prices
                return item
            })
            await addMenuItems(itemsToImport)
            alert(`🎉 成功匯入 ${itemsToImport.length} 個菜單項目！`)
            setShowPreview(false)
            setPreviewItems([])
        } catch (err) {
            setError('匯入失敗：' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // 取消預覽
    const cancelPreview = () => {
        setShowPreview(false)
        setPreviewItems([])
    }

    return (
        <div className="menu-manager">
            <div className="manager-header">
                <h2 className="section-title">
                    <Coffee size={24} />
                    <span>菜單管理</span>
                </h2>

                <div className="header-actions">
                    {/* OCR 上傳按鈕 - 支援多張圖片 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={ocrLoading || aiOcrLoading}
                        title="傳統 OCR (Google Vision API)"
                    >
                        {ocrLoading ? (
                            <Loader size={18} className="spinning" />
                        ) : (
                            <Camera size={18} />
                        )}
                        <span>{ocrLoading ? '辨識中...' : 'OCR 匯入'}</span>
                    </button>

                    {/* 🤖 AI 智慧 OCR 2.0 按鈕 */}
                    <input
                        ref={aiFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAiOcr}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn-luxury"
                        onClick={() => aiFileInputRef.current?.click()}
                        disabled={aiOcrLoading || ocrLoading}
                        title="AI 智慧辨識 (Gemini Vision) - 可辨識選項與分類"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none' }}
                    >
                        {aiOcrLoading ? (
                            <Loader size={18} className="spinning" />
                        ) : (
                            <Sparkles size={18} />
                        )}
                        <span>{aiOcrLoading ? 'AI 辨識中...' : 'AI 智慧辨識'}</span>
                    </button>

                    {/* 模板選擇器 */}
                    <div className="template-selector">
                        <button
                            className={`btn-secondary template-btn ${showTemplateSelector ? 'active' : ''}`}
                            onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                            title="選擇菜單格式以提升辨識準確度"
                        >
                            <FileText size={18} />
                            <span>{MENU_TEMPLATES[menuTemplate].name}</span>
                        </button>

                        {showTemplateSelector && (
                            <div className="template-dropdown">
                                {Object.entries(MENU_TEMPLATES).map(([key, template]) => (
                                    <button
                                        key={key}
                                        className={`template-option ${menuTemplate === key ? 'active' : ''}`}
                                        onClick={() => {
                                            setMenuTemplate(key)
                                            setShowTemplateSelector(false)
                                        }}
                                    >
                                        <span className="template-name">{template.name}</span>
                                        <span className="template-desc">{template.desc}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 批次刪除模式切換 */}
                    <button
                        className={`btn-secondary ${selectMode ? 'active' : ''}`}
                        onClick={toggleSelectMode}
                    >
                        {selectMode ? <XSquare size={18} /> : <CheckSquare size={18} />}
                        <span>{selectMode ? '取消選擇' : '批次刪除'}</span>
                    </button>

                    <button
                        className="btn-luxury"
                        onClick={() => setShowAddForm(true)}
                        disabled={selectMode}
                    >
                        <Plus size={18} />
                        <span>新增品項</span>
                    </button>
                </div>
            </div>

            {/* 錯誤訊息 */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        className="error-banner glass"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <AlertCircle size={18} />
                        <span>{error}</span>
                        <button onClick={() => setError('')}>
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 新增表單 */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        className="add-form glass"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <h3>新增菜單項目</h3>

                        <div className="form-group">
                            <label>品項名稱</label>
                            <input
                                type="text"
                                className="glass-input"
                                placeholder="例：珍珠奶茶"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>描述（選填）</label>
                            <input
                                type="text"
                                className="glass-input"
                                placeholder="例：招牌推薦"
                                value={newItem.description}
                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            />
                        </div>

                        <div className="form-check">
                            <input
                                type="checkbox"
                                id="multiSize"
                                checked={newItem.hasMultipleSizes}
                                onChange={(e) => setNewItem({ ...newItem, hasMultipleSizes: e.target.checked })}
                            />
                            <label htmlFor="multiSize">有多種尺寸 (S/M/L)</label>
                        </div>

                        {newItem.hasMultipleSizes ? (
                            <div className="size-prices">
                                {['S', 'M', 'L'].map(size => (
                                    <div key={size} className="form-group inline">
                                        <label>{size}</label>
                                        <input
                                            type="number"
                                            className="glass-input"
                                            placeholder="價格"
                                            value={newItem.prices[size]}
                                            onChange={(e) => setNewItem({
                                                ...newItem,
                                                prices: { ...newItem.prices, [size]: e.target.value }
                                            })}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="form-group">
                                <label>價格</label>
                                <input
                                    type="number"
                                    className="glass-input"
                                    placeholder="例：50"
                                    value={newItem.price}
                                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="form-actions">
                            <button className="btn-secondary" onClick={resetForm}>
                                取消
                            </button>
                            <button
                                className="btn-luxury"
                                onClick={handleAddItem}
                                disabled={loading}
                            >
                                {loading ? '新增中...' : '確認新增'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 批次操作列 */}
            <AnimatePresence>
                {selectMode && (
                    <motion.div
                        className="batch-actions glass"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <div className="batch-info">
                            <span>已選擇 <strong>{selectedIds.size}</strong> / {menuItems.length} 項</span>
                        </div>
                        <div className="batch-buttons">
                            <button onClick={toggleSelectAll} className="btn-secondary">
                                {selectedIds.size === menuItems.length ? (
                                    <><XSquare size={16} /> 取消全選</>
                                ) : (
                                    <><CheckSquare size={16} /> 全選</>
                                )}
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                className="btn-danger"
                                disabled={selectedIds.size === 0 || loading}
                            >
                                <Trash2 size={16} />
                                {loading ? '刪除中...' : `刪除 (${selectedIds.size})`}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 菜單列表 */}
            <div className="menu-list">
                {menuItems.length === 0 ? (
                    <div className="empty-state glass">
                        <FileText size={48} style={{ opacity: 0.3 }} />
                        <p>尚無菜單項目</p>
                        <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                            點擊上方按鈕新增品項，或上傳菜單圖片自動辨識
                        </p>
                    </div>
                ) : (
                    menuItems.map(item => (
                        <motion.div
                            key={item.id}
                            className="menu-item-card glass"
                            layout
                        >
                            {editingItem?.id === item.id ? (
                                // 編輯模式
                                <div className="edit-mode">
                                    <input
                                        type="text"
                                        className="glass-input"
                                        value={editingItem.name}
                                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                    />

                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            checked={editingItem.hasMultipleSizes}
                                            onChange={(e) => setEditingItem({
                                                ...editingItem,
                                                hasMultipleSizes: e.target.checked
                                            })}
                                        />
                                        <label>多尺寸</label>
                                    </div>

                                    {editingItem.hasMultipleSizes ? (
                                        <div className="size-prices inline">
                                            {['S', 'M', 'L'].map(size => (
                                                <input
                                                    key={size}
                                                    type="number"
                                                    className="glass-input small"
                                                    placeholder={size}
                                                    value={editingItem.prices[size] || ''}
                                                    onChange={(e) => setEditingItem({
                                                        ...editingItem,
                                                        prices: { ...editingItem.prices, [size]: e.target.value }
                                                    })}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <input
                                            type="number"
                                            className="glass-input small"
                                            placeholder="價格"
                                            value={editingItem.price}
                                            onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                        />
                                    )}

                                    <div className="edit-actions">
                                        <button onClick={resetForm}>
                                            <X size={18} />
                                        </button>
                                        <button onClick={handleUpdateItem} className="save-btn">
                                            <Save size={18} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // 顯示模式
                                <div className={`display-mode ${selectMode ? 'select-mode' : ''}`}>
                                    {/* 選擇模式 checkbox */}
                                    {selectMode && (
                                        <button
                                            className={`select-checkbox ${selectedIds.has(item.id) ? 'selected' : ''}`}
                                            onClick={() => toggleItemSelect(item.id)}
                                        >
                                            {selectedIds.has(item.id) ?
                                                <CheckSquare size={22} color="var(--c-gold)" /> :
                                                <Square size={22} />
                                            }
                                        </button>
                                    )}
                                    <div className="item-info">
                                        <h4>{item.name}</h4>
                                        {item.description && (
                                            <p className="item-desc">{item.description}</p>
                                        )}
                                    </div>

                                    <div className="item-prices">
                                        {item.prices ? (
                                            Object.entries(item.prices).map(([size, price]) => (
                                                <span key={size} className="price-badge">
                                                    {size}: ${price}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="price-badge main">${item.price}</span>
                                        )}
                                    </div>

                                    {!selectMode && (
                                        <div className="item-actions">
                                            <button onClick={() => startEdit(item)}>
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => handleDeleteItem(item.id)} className="delete-btn">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>

            {/* OCR 預覽 Modal */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div
                        className="ocr-preview-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="ocr-preview-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="preview-header">
                                <h3>
                                    {previewItems[0]?.id?.startsWith('ai_')
                                        ? '🤖 AI 智慧辨識結果預覽'
                                        : '📋 OCR 辨識結果預覽'
                                    }
                                </h3>
                                <p>共辨識到 {previewItems.length} 個品項，已選擇 {previewItems.filter(i => i.selected).length} 個</p>
                            </div>

                            <div className="preview-list">
                                {previewItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`preview-item ${item.selected ? 'selected' : ''}`}
                                    >
                                        <button
                                            className="preview-checkbox"
                                            onClick={() => togglePreviewItem(item.id)}
                                        >
                                            {item.selected ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </button>

                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    className="preview-name"
                                                    value={item.name}
                                                    onChange={(e) => updatePreviewItem(item.id, 'name', e.target.value)}
                                                    placeholder="品項名稱"
                                                    style={{ flex: 1 }}
                                                />
                                                {/* 分類標籤 */}
                                                {item.category && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        background: 'rgba(124, 58, 237, 0.3)',
                                                        color: '#c4b5fd',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.category}
                                                    </span>
                                                )}
                                            </div>

                                            {/* 客製化選項標籤 */}
                                            {item.options && item.options.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {item.options.map((opt, idx) => (
                                                        <span key={idx} style={{
                                                            fontSize: '0.65rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '8px',
                                                            background: 'rgba(245, 158, 11, 0.2)',
                                                            color: '#fcd34d',
                                                            border: '1px solid rgba(245, 158, 11, 0.3)'
                                                        }}>
                                                            {opt}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {item.prices ? (
                                            <div className="preview-prices">
                                                {Object.entries(item.prices).map(([size, price]) => (
                                                    <div key={size} className="preview-price-group">
                                                        <span className="size-label">{size}</span>
                                                        <input
                                                            type="number"
                                                            value={price || ''}
                                                            onChange={(e) => updatePreviewItemPrice(item.id, size, e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                className="preview-single-price"
                                                value={item.price || ''}
                                                onChange={(e) => updatePreviewItem(item.id, 'price', e.target.value ? parseInt(e.target.value) : '')}
                                                placeholder="價格"
                                            />
                                        )}

                                        <button
                                            className="preview-delete"
                                            onClick={() => deletePreviewItem(item.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="preview-actions">
                                <button className="btn-secondary" onClick={addPreviewItem}>
                                    <Plus size={16} />
                                    手動新增
                                </button>

                                <div className="preview-select-actions">
                                    <button className="btn-link" onClick={() => toggleAllPreview(true)}>全選</button>
                                    <button className="btn-link" onClick={() => toggleAllPreview(false)}>取消全選</button>
                                </div>
                            </div>

                            <div className="preview-footer">
                                <button className="btn-secondary" onClick={cancelPreview}>
                                    <X size={18} />
                                    取消
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={confirmImport}
                                    disabled={loading || previewItems.filter(i => i.selected).length === 0}
                                >
                                    {loading ? <Loader size={18} className="spin" /> : <Save size={18} />}
                                    確認匯入 ({previewItems.filter(i => i.selected).length})
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default MenuManager
