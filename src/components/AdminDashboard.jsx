// 管理者儀表板元件
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    BarChart3, Users, DollarSign, Trash2, AlertTriangle,
    ChevronDown, ChevronUp, Download, RefreshCw, Database,
    Activity, Clock, FileJson
} from 'lucide-react'
import {
    subscribeToTodayOrders,
    deleteAllTodayOrders,
    deleteOrder,
    downloadBackup,
    getSystemStats,
    getActivityLogs
} from '../services/firebase'

const AdminDashboard = () => {
    const [orders, setOrders] = useState([])
    const [sortBy, setSortBy] = useState('name') // 'name', 'item', 'quantity'
    const [sortOrder, setSortOrder] = useState('asc')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [systemStats, setSystemStats] = useState(null)
    const [activityLogs, setActivityLogs] = useState([])
    const [backupLoading, setBackupLoading] = useState(false)

    // 訂閱訂單
    useEffect(() => {
        const unsubscribe = subscribeToTodayOrders(setOrders)
        return () => unsubscribe()
    }, [])

    // 訂閱操作記錄
    useEffect(() => {
        const unsubscribe = getActivityLogs(setActivityLogs, 20)
        return () => unsubscribe()
    }, [])

    // 載入系統統計
    useEffect(() => {
        loadSystemStats()
    }, [])

    const loadSystemStats = async () => {
        try {
            const stats = await getSystemStats()
            setSystemStats(stats)
        } catch (err) {
            console.error('載入系統統計失敗:', err)
        }
    }

    // 計算統計數據
    const stats = {
        totalOrders: orders.length,
        totalPeople: [...new Set(orders.map(o => o.userName))].length,
        totalAmount: orders.reduce((sum, order) => sum + (order.total || 0), 0),
        itemCounts: {}
    }

    // 統計每個品項的數量
    orders.forEach(order => {
        order.items?.forEach(item => {
            const key = item.name
            if (!stats.itemCounts[key]) {
                stats.itemCounts[key] = { count: 0, amount: 0 }
            }
            stats.itemCounts[key].count += item.quantity
            stats.itemCounts[key].amount += item.subtotal
        })
    })

    // 依姓名分組訂單
    const groupedByName = orders.reduce((acc, order) => {
        if (!acc[order.userName]) {
            acc[order.userName] = { orders: [], total: 0 }
        }
        acc[order.userName].orders.push(order)
        acc[order.userName].total += order.total || 0
        return acc
    }, {})

    // 依品項分組
    const groupedByItem = Object.entries(stats.itemCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)

    // 排序切換
    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('asc')
        }
    }

    // 刪除當日所有訂單
    const handleDeleteAll = async () => {
        setDeleting(true)
        try {
            await deleteAllTodayOrders()
            setShowDeleteConfirm(false)
        } catch (error) {
            console.error('刪除失敗:', error)
        } finally {
            setDeleting(false)
        }
    }

    // 刪除單筆訂單
    const handleDeleteOrder = async (orderId) => {
        try {
            await deleteOrder(orderId)
        } catch (error) {
            console.error('刪除失敗:', error)
        }
    }

    // 匯出為文字
    const exportToText = () => {
        let text = `📋 點餐統計 - ${new Date().toLocaleDateString('zh-TW')}\n`
        text += `${'='.repeat(40)}\n\n`

        text += `📊 總覽\n`
        text += `訂單數：${stats.totalOrders}\n`
        text += `人數：${stats.totalPeople}\n`
        text += `總金額：$${stats.totalAmount}\n\n`

        text += `🍽️ 品項統計\n`
        groupedByItem.forEach(item => {
            text += `  ${item.name} × ${item.count} = $${item.amount}\n`
        })
        text += `\n`

        text += `👥 個人訂單\n`
        Object.entries(groupedByName).forEach(([name, data]) => {
            text += `\n【${name}】 小計 $${data.total}\n`
            data.orders.forEach(order => {
                order.items?.forEach(item => {
                    text += `  - ${item.name} × ${item.quantity}\n`
                })
            })
        })

        // 複製到剪貼簿
        navigator.clipboard.writeText(text).then(() => {
            alert('已複製到剪貼簿！')
        })
    }

    return (
        <div className="admin-dashboard">
            {/* 統計卡片 */}
            <div className="stats-grid">
                <motion.div
                    className="stat-card glass"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="stat-icon">
                        <BarChart3 size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">訂單數</span>
                        <span className="stat-value">{stats.totalOrders}</span>
                    </div>
                </motion.div>

                <motion.div
                    className="stat-card glass"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="stat-icon">
                        <Users size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">點餐人數</span>
                        <span className="stat-value">{stats.totalPeople}</span>
                    </div>
                </motion.div>

                <motion.div
                    className="stat-card glass highlight"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="stat-icon">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">總金額</span>
                        <span className="stat-value">${stats.totalAmount}</span>
                    </div>
                </motion.div>
            </div>

            {/* 操作按鈕 */}
            <div className="action-bar">
                <button className="btn-secondary" onClick={exportToText}>
                    <Download size={18} />
                    <span>匯出統計</span>
                </button>
                <button
                    className="btn-secondary"
                    onClick={async () => {
                        setBackupLoading(true)
                        try {
                            await downloadBackup()
                            alert('備份已下載！')
                        } catch (err) {
                            alert('備份失敗：' + err.message)
                        } finally {
                            setBackupLoading(false)
                        }
                    }}
                    disabled={backupLoading}
                >
                    {backupLoading ? <RefreshCw size={18} className="spinning" /> : <FileJson size={18} />}
                    <span>{backupLoading ? '備份中...' : '備份資料'}</span>
                </button>
                <button
                    className="btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={orders.length === 0}
                >
                    <Trash2 size={18} />
                    <span>刪除當日紀錄</span>
                </button>
            </div>

            {/* 刪除確認對話框 */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <>
                        <motion.div
                            className="modal-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteConfirm(false)}
                        />
                        <motion.div
                            className="confirm-modal glass"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                        >
                            <div className="modal-icon danger">
                                <AlertTriangle size={48} />
                            </div>
                            <h3>確定要刪除嗎？</h3>
                            <p>此操作將刪除今日所有 {orders.length} 筆訂單，且無法復原。</p>
                            <div className="modal-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    取消
                                </button>
                                <button
                                    className="btn-danger"
                                    onClick={handleDeleteAll}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <RefreshCw size={18} className="spinning" />
                                    ) : (
                                        <Trash2 size={18} />
                                    )}
                                    <span>{deleting ? '刪除中...' : '確定刪除'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* 效能監控區塊 */}
            <section className="data-section">
                <h3 className="section-subtitle">
                    <Activity size={20} />
                    <span>系統監控</span>
                    <button
                        className="refresh-btn"
                        onClick={loadSystemStats}
                        title="重新整理"
                    >
                        <RefreshCw size={14} />
                    </button>
                </h3>

                <div className="monitor-grid">
                    <div className="monitor-card glass">
                        <Clock size={20} />
                        <div className="monitor-info">
                            <span className="monitor-label">API 回應時間</span>
                            <span className="monitor-value">
                                {systemStats?.responseTime || '--'} ms
                            </span>
                        </div>
                    </div>

                    <div className="monitor-card glass">
                        <Database size={20} />
                        <div className="monitor-info">
                            <span className="monitor-label">菜單項目</span>
                            <span className="monitor-value">
                                {systemStats?.menuCount || '--'}
                            </span>
                        </div>
                    </div>

                    <div className="monitor-card glass">
                        <BarChart3 size={20} />
                        <div className="monitor-info">
                            <span className="monitor-label">今日訂單</span>
                            <span className="monitor-value">
                                {systemStats?.todayOrdersCount || '--'}
                            </span>
                        </div>
                    </div>

                    <div className="monitor-card glass">
                        <Activity size={20} />
                        <div className="monitor-info">
                            <span className="monitor-label">今日操作</span>
                            <span className="monitor-value">
                                {systemStats?.todayLogsCount || '--'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 最近操作記錄 */}
                {activityLogs.length > 0 && (
                    <div className="activity-log glass">
                        <h4>📝 最近操作記錄</h4>
                        <div className="log-list">
                            {activityLogs.slice(0, 5).map(log => (
                                <div key={log.id} className="log-item">
                                    <span className="log-action">{log.action}</span>
                                    <span className="log-user">{log.userName}</span>
                                    <span className="log-time">
                                        {log.timestamp?.toDate?.()?.toLocaleTimeString('zh-TW') || '--'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* 品項統計表 */}
            <section className="data-section">
                <h3 className="section-subtitle">
                    <BarChart3 size={20} />
                    <span>品項統計</span>
                </h3>

                {groupedByItem.length === 0 ? (
                    <div className="empty-state glass">
                        <p>尚無訂單資料</p>
                    </div>
                ) : (
                    <div className="data-table glass">
                        <div className="table-header">
                            <span
                                className="sortable"
                                onClick={() => toggleSort('item')}
                            >
                                品項名稱
                                {sortBy === 'item' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </span>
                            <span
                                className="sortable"
                                onClick={() => toggleSort('quantity')}
                            >
                                數量
                                {sortBy === 'quantity' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </span>
                            <span>小計</span>
                        </div>
                        {groupedByItem.map((item, idx) => (
                            <motion.div
                                key={item.name}
                                className="table-row"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <span className="item-name">{item.name}</span>
                                <span className="item-count">
                                    <span className="count-badge">{item.count}</span>
                                </span>
                                <span className="item-amount">${item.amount}</span>
                            </motion.div>
                        ))}
                        <div className="table-footer">
                            <span>合計</span>
                            <span>{Object.values(stats.itemCounts).reduce((s, i) => s + i.count, 0)}</span>
                            <span className="total-amount">${stats.totalAmount}</span>
                        </div>
                    </div>
                )}
            </section>

            {/* 個人訂單明細 */}
            <section className="data-section">
                <h3 className="section-subtitle">
                    <Users size={20} />
                    <span>個人訂單明細</span>
                </h3>

                {Object.keys(groupedByName).length === 0 ? (
                    <div className="empty-state glass">
                        <p>尚無訂單資料</p>
                    </div>
                ) : (
                    <div className="user-orders-list">
                        {Object.entries(groupedByName)
                            .sort((a, b) => {
                                if (sortBy === 'name') {
                                    return sortOrder === 'asc'
                                        ? a[0].localeCompare(b[0], 'zh-TW')
                                        : b[0].localeCompare(a[0], 'zh-TW')
                                }
                                return 0
                            })
                            .map(([name, data]) => (
                                <motion.div
                                    key={name}
                                    className="user-order-card glass"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="user-header">
                                        <h4>{name}</h4>
                                        <span className="user-total">${data.total}</span>
                                    </div>
                                    <div className="user-items">
                                        {data.orders.map(order => (
                                            <div key={order.id} className="order-block">
                                                {order.items?.map((item, idx) => (
                                                    <div key={idx} className="order-line">
                                                        <span>{item.name}</span>
                                                        <span>×{item.quantity}</span>
                                                        <span>${item.subtotal}</span>
                                                    </div>
                                                ))}
                                                <button
                                                    className="delete-single"
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    title="刪除此訂單"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                    </div>
                )}
            </section>
        </div>
    )
}

export default AdminDashboard
