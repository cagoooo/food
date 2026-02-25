import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Plus, Minus, Check, Coffee, UtensilsCrossed, Trash2, Target, MessageSquare, X, Search, Heart, Star, Clock, RotateCcw, Layers, Save, Edit2 } from 'lucide-react'
import MenuSpinWheel from './MenuSpinWheel'
import {
    subscribeToMenu,
    subscribeToTodayOrders,
    addOrder,
    deleteOrder,
    getOrderHistory,
    getCurrentUser
} from '../services/firebase'

const OrderPage = ({ user }) => {
    const [menuItems, setMenuItems] = useState([])
    const [orders, setOrders] = useState([])
    const [cart, setCart] = useState({})
    const [showConfirm, setShowConfirm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('menu') // 'menu' | 'wheel'
    const [editingNote, setEditingNote] = useState(null) // 正在編輯備註的項目 key
    const [searchQuery, setSearchQuery] = useState('') // 搜尋關鍵字
    const [priceFilter, setPriceFilter] = useState('all') // 'all' | '0-50' | '50-100' | '100+'
    const [favorites, setFavorites] = useState(() => {
        // 從 localStorage 讀取收藏
        const saved = localStorage.getItem('food_favorites')
        return saved ? JSON.parse(saved) : []
    })
    const [showHistory, setShowHistory] = useState(false)
    const [historyOrders, setHistoryOrders] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [combos, setCombos] = useState(() => {
        // 從 localStorage 讀取組合
        const saved = localStorage.getItem('food_combos')
        return saved ? JSON.parse(saved) : []
    })
    const [showComboModal, setShowComboModal] = useState(false)
    const [newComboName, setNewComboName] = useState('')

    // 儲存收藏到 localStorage
    useEffect(() => {
        localStorage.setItem('food_favorites', JSON.stringify(favorites))
    }, [favorites])

    // 儲存組合到 localStorage
    useEffect(() => {
        localStorage.setItem('food_combos', JSON.stringify(combos))
    }, [combos])

    // 儲存當前購物車為組合
    const saveCurrentAsCombo = () => {
        if (Object.keys(cart).length === 0) return
        if (!newComboName.trim()) {
            alert('請輸入組合名稱')
            return
        }

        const newCombo = {
            id: Date.now().toString(),
            name: newComboName,
            items: Object.values(cart).map(item => ({
                name: item.name,
                price: item.price,
                size: item.size,
                quantity: item.quantity,
                note: item.note || ''
            })),
            totalPrice: cartTotal.price
        }

        setCombos(prev => [...prev, newCombo])
        setNewComboName('')
        setShowComboModal(false)
    }

    // 刪除組合
    const deleteCombo = (comboId) => {
        if (window.confirm('確定要刪除這個組合嗎？')) {
            setCombos(prev => prev.filter(c => c.id !== comboId))
        }
    }

    // 載入組合到購物車
    const loadCombo = (combo) => {
        reorder(combo.items) // 重用 reorder 邏輯
    }

    // 載入歷史紀錄
    const loadHistory = async () => {
        setLoadingHistory(true)
        setShowHistory(true)
        try {
            const history = await getOrderHistory(user.name)
            setHistoryOrders(history)
        } catch (error) {
            console.error('載入歷史失敗:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    // 再來一單
    const reorder = (orderItems) => {
        setCart({}) // 清空當前購物車
        const newCart = {}

        orderItems.forEach(item => {
            // 尋找對應的菜單項目以獲取最新價格（避免價格變動）
            const menuItem = menuItems.find(m => m.name === item.name.split(' (')[0])
            if (menuItem) {
                // 處理尺寸
                let size = null
                if (item.name.includes('(')) { // 有尺寸
                    const match = item.name.match(/\((.*?)\)/)
                    if (match) size = match[1]
                }

                const key = size ? `${menuItem.id}_${size}` : menuItem.id
                // 確保價格正確
                const currentPrice = size && menuItem.prices ? menuItem.prices[size] : menuItem.price

                newCart[key] = {
                    itemId: menuItem.id,
                    name: item.name,
                    price: currentPrice || item.price, // 如果找不到最新價格，用歷史價格
                    size: size,
                    quantity: item.quantity,
                    note: item.note || ''
                }
            } else {
                // 如果菜單項目已被刪除，仍然允許加入，但可能會有風險
                const key = `history_${Date.now()}_${Math.random()}`
                newCart[key] = {
                    itemId: 'unknown',
                    name: item.name,
                    price: item.price,
                    size: null,
                    quantity: item.quantity,
                    note: item.note || ''
                }
            }
        })

        setCart(newCart)
        setShowHistory(false)
    }

    // 訂閱菜單與訂單
    useEffect(() => {
        const unsubMenu = subscribeToMenu(setMenuItems)
        const unsubOrders = subscribeToTodayOrders(setOrders)
        return () => {
            unsubMenu()
            unsubOrders()
        }
    }, [])

    // 過濾菜單
    const filteredMenuItems = useMemo(() => {
        return menuItems.filter(item => {
            // 搜尋過濾
            const matchesSearch = searchQuery === '' ||
                item.name.toLowerCase().includes(searchQuery.toLowerCase())

            // 價格過濾
            let matchesPrice = true
            if (priceFilter !== 'all') {
                const itemPrice = item.prices
                    ? Math.min(...Object.values(item.prices))
                    : item.price

                switch (priceFilter) {
                    case '0-50':
                        matchesPrice = itemPrice <= 50
                        break
                    case '50-100':
                        matchesPrice = itemPrice > 50 && itemPrice <= 100
                        break
                    case '100+':
                        matchesPrice = itemPrice > 100
                        break
                    default:
                        matchesPrice = true
                }
            }

            return matchesSearch && matchesPrice
        })
    }, [menuItems, searchQuery, priceFilter])

    // 計算購物車總數量與總金額
    const cartTotal = Object.entries(cart).reduce((acc, [itemId, item]) => {
        return {
            count: acc.count + item.quantity,
            price: acc.price + (item.price * item.quantity)
        }
    }, { count: 0, price: 0 })

    // 新增到購物車
    const addToCart = (item, size = null) => {
        const key = size ? `${item.id}_${size}` : item.id
        const price = size && item.prices ? item.prices[size] : item.price
        const itemName = size ? `${item.name} (${size})` : item.name

        setCart(prev => ({
            ...prev,
            [key]: {
                itemId: item.id,
                name: itemName,
                price: price,
                size: size,
                quantity: (prev[key]?.quantity || 0) + 1
            }
        }))
    }

    // 切換收藏狀態
    const toggleFavorite = (itemId) => {
        setFavorites(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId)
            } else {
                return [...prev, itemId]
            }
        })
    }

    // 已收藏的菜單項目
    const favoriteItems = useMemo(() => {
        return menuItems.filter(item => favorites.includes(item.id))
    }, [menuItems, favorites])

    // 減少購物車數量
    const removeFromCart = (key) => {
        setCart(prev => {
            const newCart = { ...prev }
            if (newCart[key].quantity > 1) {
                newCart[key].quantity -= 1
            } else {
                delete newCart[key]
            }
            return newCart
        })
    }

    // 更新備註
    const updateNote = (key, note) => {
        setCart(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                note: note
            }
        }))
    }

    // 提交訂單
    const submitOrder = async () => {
        if (Object.keys(cart).length === 0) return

        setSubmitting(true)
        try {
            const orderItems = Object.values(cart).map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity,
                note: item.note || ''
            }))

            await addOrder({
                userName: user.name,
                items: orderItems,
                total: cartTotal.price
            })

            setCart({})
            setShowConfirm(true)
            setTimeout(() => setShowConfirm(false), 2000)
        } catch (error) {
            console.error('訂單提交失敗:', error)
        } finally {
            setSubmitting(false)
        }
    }

    // 刪除自己的訂單
    const handleDeleteOrder = async (orderId) => {
        try {
            await deleteOrder(orderId)
        } catch (error) {
            console.error('刪除訂單失敗:', error)
        }
    }

    // 我的訂單
    const myOrders = orders.filter(order => order.userName === user.name)

    // 所有同事訂單（依姓名分組）
    const groupedOrders = orders.reduce((acc, order) => {
        if (!acc[order.userName]) {
            acc[order.userName] = []
        }
        acc[order.userName].push(order)
        return acc
    }, {})

    return (
        <div className="order-page">
            {/* Tab 切換與歷史按鈕 */}
            <div className="order-tabs-wrapper">
                <div className="order-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
                        onClick={() => setActiveTab('menu')}
                    >
                        <Coffee size={18} />
                        菜單點餐
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'wheel' ? 'active' : ''}`}
                        onClick={() => setActiveTab('wheel')}
                    >
                        <Target size={18} />
                        🎰 轉盤決定
                    </button>
                </div>
                <button
                    className="history-btn glass"
                    onClick={() => setShowComboModal(true)}
                    title="餐點組合"
                >
                    <Layers size={20} />
                </button>
                <button
                    className="history-btn glass"
                    onClick={loadHistory}
                    title="歷史訂單"
                >
                    <Clock size={20} />
                </button>
            </div>

            {/* 餐點組合 Modal */}
            <AnimatePresence>
                {showComboModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowComboModal(false)}
                    >
                        <motion.div
                            className="history-modal glass"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3>
                                    <Layers size={24} />
                                    我的餐點組合
                                </h3>
                                <button onClick={() => setShowComboModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="history-content">
                                {/* 新增組合區塊 */}
                                <div className="add-combo-section">
                                    <h4>將當前購物車存為組合</h4>
                                    {Object.keys(cart).length > 0 ? (
                                        <div className="add-combo-form">
                                            <input
                                                type="text"
                                                placeholder="輸入組合名稱（如：早餐套餐）"
                                                value={newComboName}
                                                onChange={(e) => setNewComboName(e.target.value)}
                                            />
                                            <button onClick={saveCurrentAsCombo}>
                                                <Save size={18} />
                                                儲存
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="empty-cart-hint">購物車是空的，無法建立組合</p>
                                    )}
                                </div>

                                <div className="divider"></div>

                                {/* 組合列表 */}
                                <h4>已儲存的組合</h4>
                                {combos.length === 0 ? (
                                    <div className="empty-state">
                                        <Layers size={48} style={{ opacity: 0.3 }} />
                                        <p>還沒有儲存任何組合</p>
                                    </div>
                                ) : (
                                    <div className="history-list">
                                        {combos.map(combo => (
                                            <div key={combo.id} className="history-card">
                                                <div className="history-header">
                                                    <span className="combo-name">{combo.name}</span>
                                                    <div className="combo-actions">
                                                        <span className="history-total">${combo.totalPrice}</span>
                                                        <button
                                                            className="delete-combo-btn"
                                                            onClick={() => deleteCombo(combo.id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="history-items">
                                                    {combo.items.map((item, idx) => (
                                                        <div key={idx} className="history-item">
                                                            <span>{item.name} x{item.quantity}</span>
                                                            {item.note && <span className="history-note">📝 {item.note}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    className="reorder-btn"
                                                    onClick={() => {
                                                        loadCombo(combo)
                                                        setShowComboModal(false)
                                                    }}
                                                >
                                                    <RotateCcw size={16} />
                                                    載入此組合
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* 歷史訂單 Modal */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowHistory(false)}
                    >
                        <motion.div
                            className="history-modal glass"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3>
                                    <Clock size={24} />
                                    歷史訂單
                                </h3>
                                <button onClick={() => setShowHistory(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="history-content">
                                {loadingHistory ? (
                                    <div className="loading-state">
                                        <div className="spinner"></div>
                                        <p>載入中...</p>
                                    </div>
                                ) : historyOrders.length === 0 ? (
                                    <div className="empty-state">
                                        <Clock size={48} style={{ opacity: 0.3 }} />
                                        <p>沒有歷史訂單</p>
                                    </div>
                                ) : (
                                    <div className="history-list">
                                        {historyOrders.map(order => (
                                            <div key={order.id} className="history-card">
                                                <div className="history-header">
                                                    <span className="history-date">
                                                        {order.createdAt?.seconds
                                                            ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                                                            : '剛剛'}
                                                    </span>
                                                    <span className="history-total">${order.total}</span>
                                                </div>
                                                <div className="history-items">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="history-item">
                                                            <span>{item.name} x{item.quantity}</span>
                                                            {item.note && <span className="history-note">📝 {item.note}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    className="reorder-btn"
                                                    onClick={() => reorder(order.items)}
                                                >
                                                    <RotateCcw size={16} />
                                                    再來一單
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 轉盤模式 */}
            {activeTab === 'wheel' && (
                <MenuSpinWheel
                    onAddToCart={(item) => {
                        addToCart(item, item.selectedSize)
                    }}
                />
            )}

            {/* 菜單模式 */}
            {activeTab === 'menu' && (
                <section className="menu-section">
                    <h2 className="section-title">
                        <Coffee size={24} />
                        <span>今日菜單</span>
                    </h2>
                    {/* 我的收藏 */}
                    {favoriteItems.length > 0 && (
                        <div className="favorites-section">
                            <h3 className="favorites-title">
                                <Star size={18} />
                                我的收藏
                            </h3>
                            <div className="favorites-list">
                                {favoriteItems.map(item => (
                                    <button
                                        key={item.id}
                                        className="favorite-quick-btn glass"
                                        onClick={() => addToCart(item, item.prices ? Object.keys(item.prices)[0] : null)}
                                    >
                                        <span>{item.name}</span>
                                        <Plus size={16} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 搜尋和篩選區 */}
                    <div className="search-filter-bar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="搜尋餐點..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="search-clear"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <div className="price-filters">
                            {[
                                { key: 'all', label: '全部' },
                                { key: '0-50', label: '$50以下' },
                                { key: '50-100', label: '$50-100' },
                                { key: '100+', label: '$100以上' }
                            ].map(filter => (
                                <button
                                    key={filter.key}
                                    className={`filter-btn ${priceFilter === filter.key ? 'active' : ''}`}
                                    onClick={() => setPriceFilter(filter.key)}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {menuItems.length === 0 ? (
                        <div className="empty-menu glass">
                            <UtensilsCrossed size={48} style={{ opacity: 0.3 }} />
                            <p>目前沒有菜單項目</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>請等待管理者新增菜單</p>
                        </div>
                    ) : filteredMenuItems.length === 0 ? (
                        <div className="empty-menu glass">
                            <Search size={48} style={{ opacity: 0.3 }} />
                            <p>找不到符合條件的餐點</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>試試其他關鍵字或價格區間</p>
                        </div>
                    ) : (
                        <div className="menu-grid">
                            {filteredMenuItems.map(item => (
                                <motion.div
                                    key={item.id}
                                    className="menu-card glass"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ scale: 1.02 }}
                                >
                                    <div className="menu-card-header">
                                        <div className="menu-card-title-row">
                                            <h3>{item.name}</h3>
                                            <button
                                                className={`fav-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                                                onClick={() => toggleFavorite(item.id)}
                                                title={favorites.includes(item.id) ? '取消收藏' : '加入收藏'}
                                            >
                                                <Heart
                                                    size={18}
                                                    fill={favorites.includes(item.id) ? 'var(--c-gold)' : 'none'}
                                                />
                                            </button>
                                        </div>
                                        {item.description && (
                                            <p className="menu-description">{item.description}</p>
                                        )}
                                    </div>

                                    {/* 判斷是否有多種尺寸 */}
                                    {item.prices ? (
                                        <div className="size-buttons">
                                            {Object.entries(item.prices).map(([size, price]) => (
                                                <button
                                                    key={size}
                                                    className="size-btn glass"
                                                    onClick={() => addToCart(item, size)}
                                                >
                                                    <span className="size-label">{size}</span>
                                                    <span className="size-price">${price}</span>
                                                    <Plus size={16} />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="single-price">
                                            <span className="price-tag">${item.price}</span>
                                            <button
                                                className="add-btn glass"
                                                onClick={() => addToCart(item)}
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* 購物車區域 */}
            <AnimatePresence>
                {Object.keys(cart).length > 0 && (
                    <motion.section
                        className="cart-section glass"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                    >
                        <h3 className="cart-title">
                            <ShoppingCart size={20} />
                            <span>我的購物車</span>
                            <span className="cart-count">{cartTotal.count}</span>
                        </h3>

                        <div className="cart-items">
                            {Object.entries(cart).map(([key, item]) => (
                                <div key={key} className="cart-item-wrapper">
                                    <div className="cart-item">
                                        <div className="item-info">
                                            <span className="item-name">{item.name}</span>
                                            {item.note && (
                                                <span className="item-note-badge">📝 {item.note}</span>
                                            )}
                                        </div>
                                        <div className="item-controls">
                                            <button onClick={() => removeFromCart(key)}>
                                                <Minus size={16} />
                                            </button>
                                            <span className="item-quantity">{item.quantity}</span>
                                            <button onClick={() => addToCart({ id: item.itemId, name: item.name.split(' (')[0], price: item.price }, item.size)}>
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <button
                                            className={`note-btn ${item.note ? 'has-note' : ''}`}
                                            onClick={() => setEditingNote(editingNote === key ? null : key)}
                                            title="加入備註"
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                        <span className="item-subtotal">${item.price * item.quantity}</span>
                                    </div>

                                    {/* 備註輸入區 */}
                                    <AnimatePresence>
                                        {editingNote === key && (
                                            <motion.div
                                                className="note-input-wrapper"
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                            >
                                                <input
                                                    type="text"
                                                    className="note-input"
                                                    placeholder="輸入備註（如：少冰、去糖、加辣...）"
                                                    value={item.note || ''}
                                                    onChange={(e) => updateNote(key, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') setEditingNote(null)
                                                    }}
                                                    autoFocus
                                                />
                                                <button
                                                    className="note-close-btn"
                                                    onClick={() => setEditingNote(null)}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>

                        <div className="cart-footer">
                            <div className="cart-total">
                                <span>總計</span>
                                <span className="total-price">${cartTotal.price}</span>
                            </div>
                            <motion.button
                                className="btn-luxury submit-btn"
                                onClick={submitOrder}
                                disabled={submitting}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {submitting ? '送出中...' : '確認送出'}
                            </motion.button>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* 訂單確認動畫 */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        className="confirm-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="confirm-icon"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                        >
                            <Check size={64} color="var(--c-gold)" />
                            <p>訂單已送出！</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 同事訂單區域 */}
            <section className="orders-section">
                <h2 className="section-title">
                    <UtensilsCrossed size={24} />
                    <span>大家的訂單</span>
                </h2>

                {orders.length === 0 ? (
                    <div className="empty-orders glass">
                        <p>目前還沒有訂單</p>
                    </div>
                ) : (
                    <div className="orders-list">
                        {Object.entries(groupedOrders).map(([userName, userOrders]) => (
                            <div key={userName} className="user-orders glass">
                                <h4 className="user-name">
                                    {userName}
                                    {userName === user.name && <span className="me-badge">我</span>}
                                </h4>
                                {userOrders.map(order => (
                                    <div key={order.id} className="order-detail">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="order-item">
                                                <div className="order-item-info">
                                                    <span>{item.name} x{item.quantity}</span>
                                                    {item.note && (
                                                        <span className="order-item-note">📝 {item.note}</span>
                                                    )}
                                                </div>
                                                <span>${item.subtotal}</span>
                                            </div>
                                        ))}
                                        <div className="order-total">
                                            <span>小計</span>
                                            <span>${order.total}</span>
                                        </div>
                                        {userName === user.name && (
                                            <button
                                                className="delete-order-btn"
                                                onClick={() => handleDeleteOrder(order.id)}
                                            >
                                                <Trash2 size={14} />
                                                <span>刪除</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

export default OrderPage
