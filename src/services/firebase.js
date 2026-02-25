// Firebase 初始化與資料庫操作 (使用 Cloud Firestore)
import { initializeApp } from 'firebase/app'
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore'

// Firebase 設定 (從環境變數讀取)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)
// 使用 "food" 資料庫（非預設）
const db = getFirestore(app, 'food')

// === 菜單操作 ===

// 監聽菜單變化
export const subscribeToMenu = (callback) => {
    const menuRef = collection(db, 'menu')
    return onSnapshot(menuRef, (snapshot) => {
        const menuItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        callback(menuItems)
    })
}

// 新增菜單項目
export const addMenuItem = async (item) => {
    const menuRef = collection(db, 'menu')
    const docRef = await addDoc(menuRef, {
        ...item,
        createdAt: serverTimestamp()
    })
    return docRef.id
}

// 更新菜單項目
export const updateMenuItem = async (itemId, updates) => {
    const itemRef = doc(db, 'menu', itemId)
    await updateDoc(itemRef, updates)
}

// 刪除菜單項目
export const deleteMenuItem = async (itemId) => {
    const itemRef = doc(db, 'menu', itemId)
    await deleteDoc(itemRef)
}

// 批量新增菜單項目 (用於 OCR 匯入)
export const addMenuItems = async (items) => {
    const batch = writeBatch(db)
    const menuRef = collection(db, 'menu')

    items.forEach(item => {
        const newDocRef = doc(menuRef)
        batch.set(newDocRef, {
            ...item,
            createdAt: serverTimestamp()
        })
    })

    await batch.commit()
}

// === 訂單操作 ===

// 獲取今日日期字串 (用於分組訂單)
const getTodayKey = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// 監聽今日訂單
export const subscribeToTodayOrders = (callback) => {
    const todayKey = getTodayKey()
    const ordersRef = collection(db, 'orders')
    const q = query(ordersRef, where('dateKey', '==', todayKey))

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        callback(orders)
    })
}

// 新增訂單 (加入離線與背景同步支援)
export const addOrder = async (order) => {
    const todayKey = getTodayKey()
    const orderData = {
        ...order,
        dateKey: todayKey,
        createdAt: serverTimestamp()
    }

    try {
        const ordersRef = collection(db, 'orders')
        const docRef = await addDoc(ordersRef, orderData)
        return docRef.id
    } catch (err) {
        // 如果離線，將訂單存入 LocalStorage 並註冊同步任務
        if (!navigator.onLine) {
            const offlineQueue = JSON.parse(localStorage.getItem('offline_queue') || '[]')
            offlineQueue.push({ ...order, timestamp: new Date().toISOString() })
            localStorage.setItem('offline_queue', JSON.stringify(offlineQueue))

            // 註冊 SW 背景同步
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
                const reg = await navigator.serviceWorker.ready
                try {
                    await reg.sync.register('sync-orders')
                } catch (syncErr) {
                    console.warn('[Offline] 背景同步註冊失敗')
                }
            }
            return 'offline_pending'
        }
        throw err
    }
}

// 刪除單筆訂單
export const deleteOrder = async (orderId) => {
    const orderRef = doc(db, 'orders', orderId)
    await deleteDoc(orderRef)
}

// 刪除當日所有訂單
export const deleteAllTodayOrders = async () => {
    const todayKey = getTodayKey()
    const ordersRef = collection(db, 'orders')
    const q = query(ordersRef, where('dateKey', '==', todayKey))

    const snapshot = await getDocs(q)
    const batch = writeBatch(db)

    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref)
    })

    await batch.commit()
}

// 獲取使用者歷史訂單
export const getOrderHistory = async (userName) => {
    try {
        const ordersRef = collection(db, 'orders')
        const q = query(
            ordersRef,
            where('userName', '==', userName),
            orderBy('createdAt', 'desc')
        )

        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
    } catch (error) {
        // 如果是索引建立中的錯誤，改用客戶端過濾（暫時解法）
        console.warn('索引可能尚未建立，嘗試客戶端排序:', error)
        const ordersRef = collection(db, 'orders')
        const q = query(ordersRef, where('userName', '==', userName))
        const snapshot = await getDocs(q)
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
    }
}

// 更新訂單
export const updateOrder = async (orderId, updates) => {
    const orderRef = doc(db, 'orders', orderId)
    await updateDoc(orderRef, updates)
}

// === 使用者管理 ===

// 儲存當前使用者
export const saveCurrentUser = (user) => {
    sessionStorage.setItem('orderUser', JSON.stringify(user))
}

// 取得當前使用者
export const getCurrentUser = () => {
    const user = sessionStorage.getItem('orderUser')
    return user ? JSON.parse(user) : null
}

// 登出
export const logoutUser = () => {
    sessionStorage.removeItem('orderUser')
}

// 管理者密碼驗證
export const verifyAdminPassword = (password) => {
    return password === import.meta.env.VITE_ADMIN_PASSWORD
}

// === 操作記錄 ===

// 記錄使用者操作
export const logActivity = async (action, details = {}) => {
    try {
        const user = getCurrentUser()
        const logsRef = collection(db, 'activityLogs')
        await addDoc(logsRef, {
            action,
            details,
            userId: user?.id || 'anonymous',
            userName: user?.name || '匿名',
            isAdmin: user?.isAdmin || false,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            dateKey: getTodayKey()
        })
    } catch (err) {
        console.warn('操作記錄失敗:', err.message)
    }
}

// 取得今日操作記錄
export const getActivityLogs = (callback, limit = 100) => {
    const todayKey = getTodayKey()
    const logsRef = collection(db, 'activityLogs')
    const q = query(
        logsRef,
        where('dateKey', '==', todayKey)
    )

    return onSnapshot(q, (snapshot) => {
        let logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        // 客戶端排序，避免需要建立索引
        logs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))

        if (limit) {
            logs = logs.slice(0, limit)
        }

        callback(logs)
    }, (error) => {
        console.warn('操作記錄監聽失敗:', error)
    })
}

// 操作類型常數
export const ActivityTypes = {
    LOGIN: 'login',
    LOGOUT: 'logout',
    ADMIN_LOGIN: 'admin_login',
    ORDER_SUBMIT: 'order_submit',
    ORDER_DELETE: 'order_delete',
    MENU_ADD: 'menu_add',
    MENU_EDIT: 'menu_edit',
    MENU_DELETE: 'menu_delete',
    MENU_OCR_IMPORT: 'menu_ocr_import',
    ORDERS_CLEAR: 'orders_clear'
}

// === 資料備份 ===

// 匯出所有資料為 JSON（備份）
export const exportAllData = async () => {
    const menuRef = collection(db, 'menu')
    const ordersRef = collection(db, 'orders')
    const logsRef = collection(db, 'activityLogs')

    const [menuSnap, ordersSnap, logsSnap] = await Promise.all([
        getDocs(menuRef),
        getDocs(ordersRef),
        getDocs(logsRef)
    ])

    const backup = {
        exportedAt: new Date().toISOString(),
        menu: menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        orders: ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        activityLogs: logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    return backup
}

// 下載備份檔案
export const downloadBackup = async () => {
    const backup = await exportAllData()
    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `food-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    return backup
}

// === 效能監控 ===

// 取得系統統計資訊
export const getSystemStats = async () => {
    const startTime = performance.now()

    const menuRef = collection(db, 'menu')
    const ordersRef = collection(db, 'orders')
    const logsRef = collection(db, 'activityLogs')

    const [menuSnap, ordersSnap, logsSnap] = await Promise.all([
        getDocs(menuRef),
        getDocs(query(ordersRef, where('dateKey', '==', getTodayKey()))),
        getDocs(query(logsRef, where('dateKey', '==', getTodayKey())))
    ])

    const endTime = performance.now()

    return {
        responseTime: Math.round(endTime - startTime),
        menuCount: menuSnap.size,
        todayOrdersCount: ordersSnap.size,
        todayLogsCount: logsSnap.size,
        timestamp: new Date().toISOString()
    }
}

export { db }

