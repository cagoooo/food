import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Settings2, RotateCw, Star, Heart, Trash2, Clock, X, Plus,
  ExternalLink, Phone, Navigation, ChevronRight, Map as MapIcon,
  ChefHat, UtensilsCrossed, LayoutDashboard, LogOut, Coffee, ShoppingCart
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { initGoogleMaps, fetchNearbyRestaurants, fetchPlaceDetails, calculateTravelInfo } from './services/googleMaps'
import { getCurrentUser, logoutUser } from './services/firebase'
import LoginPage from './components/LoginPage'

// 使用 React.lazy 懶載入非核心組件
const OrderPage = React.lazy(() => import('./components/OrderPage'))
const MenuManager = React.lazy(() => import('./components/MenuManager'))
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'))

import RestaurantSpinWheel from './components/RestaurantSpinWheel'
import LandingPage from './components/LandingPage'
import './App.css'
import './components/OrderSystem.css'

// 載入中骨架屏
const LoadingFallback = () => (
  <div className="app-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="glass" style={{ padding: '40px', borderRadius: '24px', textAlign: 'center' }}>
      <RotateCw className="spinning" size={48} color="var(--c-gold)" style={{ marginBottom: '20px' }} />
      <p className="gradient-text" style={{ fontSize: '1.2rem', fontWeight: 800 }}>載入精緻介面中...</p>
    </div>
  </div>
)

function App() {
  // 使用者狀態
  const [user, setUser] = useState(null)
  const [appMode, setAppMode] = useState('landing') // 'landing', 'order', 'menu', 'admin', 'wheel'
  const [showLanding, setShowLanding] = useState(true)

  // 原有轉盤系統狀態
  const [coords, setCoords] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(false)
  const [spinLoading, setSpinLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)
  const [error, setError] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [showConfig, setShowConfig] = useState(true)
  const [activeTab, setActiveTab] = useState('nearby') // 'nearby', 'fav', 'blk'

  // 偏好設定
  const [radius, setRadius] = useState(1000)
  const [minRating, setMinRating] = useState(4.0)
  const [openNow, setOpenNow] = useState(true)

  // 收藏與黑名單 (LocalStorage)
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('fav_res') || '[]'))
  const [blacklist, setBlacklist] = useState(() => JSON.parse(localStorage.getItem('blk_res') || '[]'))

  useEffect(() => { localStorage.setItem('fav_res', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('blk_res', JSON.stringify(blacklist)) }, [blacklist])

  // 初始化時檢查登入狀態與離線訂單同步
  useEffect(() => {
    const savedUser = getCurrentUser()
    if (savedUser) {
      setUser(savedUser)
    }

    // 處理離線佇列同步
    const processOfflineQueue = async () => {
      const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      if (queue.length === 0) return

      console.log(`[Sync] 發現 ${queue.length} 筆離線訂單，正在嘗試同步...`)

      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('./services/firebase')
      const ordersRef = collection(db, 'orders')

      for (const order of queue) {
        try {
          await addDoc(ordersRef, { ...order, createdAt: serverTimestamp() })
        } catch (err) {
          console.error('[Sync] 單筆同步失敗:', err)
        }
      }

      localStorage.setItem('offline_queue', '[]')
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
      alert('📦 偵測到網路連線！您的離線訂單已自動同步成功。')
    }

    // 監聽來自 Service Worker 的同步訊息
    const handleSWMessage = (event) => {
      if (event.data && event.data.type === 'SYNC_ORDERS') {
        processOfflineQueue()
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage)
    }

    // 備援：監聽瀏覽器在線事件
    window.addEventListener('online', processOfflineQueue)

    // 如果目前是在線狀態，初始化時也檢查一次是否有漏掉的佇列
    if (navigator.onLine) processOfflineQueue()

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      }
      window.removeEventListener('online', processOfflineQueue)
    }
  }, [])

  // 模式選擇處理
  const handleSelectMode = (mode) => {
    setAppMode(mode)
    setShowLanding(false)
  }

  // 登入處理
  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    setAppMode('order')
  }

  // 登出處理
  const handleLogout = () => {
    logoutUser()
    setUser(null)
    setAppMode('landing')
    setShowLanding(true)
  }

  // 初始化地圖與獲取位置
  const getLocation = () => {
    setLoading(true)
    setError(null)
    if (!navigator.geolocation) {
      setError("您的瀏覽器不支援地理定位")
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(newCoords)
        fetchRestaurants(newCoords)
      },
      (err) => {
        setError("無法獲取位置，請確保已開啟權限 (Error: " + err.message + ")")
        setLoading(false)
      }
    )
  }

  const fetchRestaurants = async (location) => {
    setLoading(true)
    setError(null)
    console.log("開始獲取餐廳數據...", location)
    try {
      await initGoogleMaps()
      const data = await fetchNearbyRestaurants({
        lat: location.lat,
        lng: location.lng,
        radius,
        minRating
      })

      console.log(`獲取到 ${data.length} 家原始餐廳數據`)

      const filtered = data.filter(res => {
        const isNotBlacklisted = !blacklist.some(b => b.id === res.id)
        const isOpenCondition = !openNow || res.open

        if (!isNotBlacklisted) console.log(`🚫 過濾: ${res.name} 在黑名單中`)
        if (!isOpenCondition) console.log(`🕒 過濾: ${res.name} 目前休息中 (API 回傳: ${res.open})`)

        return isNotBlacklisted && isOpenCondition
      })

      console.log(`✅ 過濾後剩下 ${filtered.length} 家餐廳`)

      setRestaurants(filtered)
      setLoading(false)
      setActiveTab('nearby')
    } catch (err) {
      console.error("fetchRestaurants Error:", err)
      setError(err.message)
      setLoading(false)
    }
  }

  const spinWheel = () => {
    if (restaurants.length === 0) return
    setSpinLoading(true)
    setSelectedResult(null)

    const restaurantCount = Math.min(restaurants.length, 12) // 最多顯示 12 個以維持視覺
    const degPerSlice = 360 / restaurantCount
    const randomIndex = Math.floor(Math.random() * restaurantCount)

    // 精確對齊計算
    const targetRotation = 3600 + (360 - (randomIndex * degPerSlice + degPerSlice / 2))
    const newRotation = rotation + targetRotation

    setRotation(newRotation)

    const winningRestaurant = restaurants[randomIndex]
    const detailsPromise = fetchPlaceDetails(winningRestaurant.id)

    setTimeout(async () => {
      const details = await detailsPromise
      setSpinLoading(false)
      setSelectedResult({ ...winningRestaurant, ...details })

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#FAF9F6', '#E11D48']
      })

      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100])
      }
    }, 4500)
  }

  const toggleFavorite = (res) => {
    if (favorites.some(f => f.id === res.id)) {
      setFavorites(favorites.filter(f => f.id !== res.id))
    } else {
      setFavorites([...favorites, res])
    }
  }

  const addToBlacklist = (res) => {
    setBlacklist([...blacklist, res])
    setRestaurants(restaurants.filter(r => r.id !== res.id))
    if (selectedResult?.id === res.id) setSelectedResult(null)
  }

  const handleOpenMap = async (res) => {
    if (res.mapUrl) {
      window.open(res.mapUrl, '_blank')
    } else {
      const details = await fetchPlaceDetails(res.id)
      window.open(details?.mapUrl || `https://www.google.com/maps/search/?api=1&query=${res.name}&query_place_id=${res.id}`, '_blank')
    }
  }

  // --- SVG 轉盤渲染輔助 ---
  const renderWheelSVG = () => {
    const list = restaurants.slice(0, 12)
    const count = list.length
    const deg = 360 / count
    const radius = 250 // SVG 座標系半徑
    const cx = 300, cy = 300 // 中心點

    return (
      <svg viewBox="0 0 600 600" className="wheel-svg-container" style={{ transform: `rotate(${rotation}deg)` }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g>
          {list.map((res, i) => {
            const startAngle = i * deg
            const endAngle = (i + 1) * deg
            const x1 = cx + radius * Math.cos((startAngle - 90) * Math.PI / 180)
            const y1 = cy + radius * Math.sin((startAngle - 90) * Math.PI / 180)
            const x2 = cx + radius * Math.cos((endAngle - 90) * Math.PI / 180)
            const y2 = cy + radius * Math.sin((endAngle - 90) * Math.PI / 180)
            const largeArc = deg > 180 ? 1 : 0
            const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

            return (
              <g key={res.id}>
                <path
                  d={pathData}
                  fill={i % 2 === 0 ? "rgba(15, 23, 42, 0.95)" : "rgba(30, 41, 59, 0.95)"}
                  stroke="rgba(245, 158, 11, 0.2)"
                  strokeWidth="1"
                />
                <g transform={`rotate(${startAngle + deg / 2}, ${cx}, ${cy})`}>
                  <text
                    x={cx} y={cy - radius + 50}
                    fill="#F8FAFC"
                    textAnchor="middle"
                    style={{ fontSize: count > 8 ? '12px' : '14px', fontWeight: 700, letterSpacing: '0.02em', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                  >
                    {res.name.length > 10 ? res.name.substring(0, 9) + '..' : res.name}
                  </text>
                </g>
              </g>
            )
          })}
        </g>
        {/* 外圈裝飾 */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--c-gold)" strokeWidth="4" opacity="0.3" />
      </svg>
    )
  }

  // 渲染內容邏輯
  const renderContent = () => {
    if (showLanding) {
      return <LandingPage onSelectMode={handleSelectMode} />
    }

    if (appMode === 'order' && !user) {
      return <LoginPage onLogin={handleLogin} onBack={() => setShowLanding(true)} />
    }

    return (
      <>
        {/* 頂部導航 */}
        <nav className="top-nav">
          <div className="nav-title" style={{ cursor: 'pointer' }} onClick={() => setShowLanding(true)}>
            <ChefHat size={24} color="var(--c-gold)" />
            <span className="gradient-text">美食管家</span>
          </div>
          <div className="nav-user">
            {user ? (
              <>
                <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                  {user.isAdmin ? '🛡️ 管理員' : user.name}
                </span>
                <button className="logout-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button className="glass" style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem' }} onClick={() => setAppMode('order')}>
                登入點餐
              </button>
            )}
          </div>
        </nav>

        {/* 主要內容區域 */}
        <div style={{ paddingTop: '70px' }}>
          {/* ✅ AnimatePresence mode=wait 只能有一個直接子元素，Suspense 移到各 motion.div 內 */}
          <AnimatePresence mode="wait">
            {appMode === 'order' && user && (
              <motion.div
                key="order"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <React.Suspense fallback={<LoadingFallback />}>
                  <OrderPage user={user} />
                </React.Suspense>
              </motion.div>
            )}

            {appMode === 'menu' && user?.isAdmin && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <React.Suspense fallback={<LoadingFallback />}>
                  <MenuManager />
                </React.Suspense>
              </motion.div>
            )}

            {appMode === 'admin' && user?.isAdmin && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <React.Suspense fallback={<LoadingFallback />}>
                  <AdminDashboard />
                </React.Suspense>
              </motion.div>
            )}

            {appMode === 'wheel' && (
              <motion.div
                key="wheel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="app-viewport">
                  <div className="bento-grid">
                    <header className="cell-header">
                      <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                        <h1 className="title-display gradient-text">fate wheel</h1>
                        <p style={{ letterSpacing: '0.4em', textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.5 }}>restaurant selection / pro max 2.0</p>
                      </motion.div>
                    </header>

                    <div className="action-strip">
                      <button className="btn-luxury" onClick={getLocation} disabled={loading} style={{ flex: 1 }}>
                        {loading ? <RotateCw className="spinning" size={20} /> : <MapIcon size={20} />}
                        {loading ? '定位尋找中' : coords ? '重新整理餐廳' : '開始定位'}
                      </button>
                      <button className="glass" style={{ width: '64px', borderRadius: '50%', cursor: 'pointer', border: showConfig ? '1px solid var(--c-gold)' : '' }} onClick={() => setShowConfig(!showConfig)}>
                        <Settings2 size={24} color={showConfig ? "var(--c-gold)" : "white"} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="glass"
                          style={{ gridColumn: 'span 12', padding: '20px', borderRadius: '24px', color: '#fb7185', fontWeight: 700, border: '1px solid rgba(225, 29, 72, 0.3)', marginBottom: '20px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <X size={20} />
                            <span>{error}</span>
                            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={14} /></button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {showConfig && (
                        <motion.aside
                          initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }}
                          className="glass cell-side"
                        >
                          <h3 style={{ marginBottom: '25px', color: 'var(--c-gold)' }}>篩選器</h3>
                          <div style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '10px', opacity: 0.6 }}>搜尋範圍: {radius}m</label>
                            <input type="range" min="500" max="5000" step="500" value={radius} onChange={e => setRadius(e.target.value)} style={{ width: '100%', accentColor: 'var(--c-gold)' }} />
                          </div>
                          <div style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '10px', opacity: 0.6 }}>評分門檻: ★ {minRating}</label>
                            <input type="range" min="3" max="4.8" step="0.1" value={minRating} onChange={e => setMinRating(e.target.value)} style={{ width: '100%', accentColor: 'var(--c-gold)' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>目前營業中</label>
                            <input type="checkbox" checked={openNow} onChange={e => setOpenNow(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: 'var(--c-gold)' }} />
                          </div>
                        </motion.aside>
                      )}
                    </AnimatePresence>

                    <section className={`glass cell-main ${!showConfig ? 'full-width' : ''}`}>
                      {activeTab === 'nearby' && (
                        <RestaurantSpinWheel
                          restaurants={restaurants}
                          onNavigate={handleOpenMap}
                          onToggleFavorite={toggleFavorite}
                          favorites={favorites}
                          loading={loading}
                        />
                      )}

                      {(activeTab === 'fav' || activeTab === 'blk') && (
                        <div style={{ width: '100%' }}>
                          <h2 style={{ fontSize: '2.5rem', marginBottom: '40px', color: 'var(--c-gold)' }}>
                            {activeTab === 'fav' ? 'Favorite Gems' : 'Blacklist'}
                          </h2>
                          <div className="card-list">
                            {(activeTab === 'fav' ? favorites : blacklist).map(res => (
                              <div key={res.id} className="glass premium-card">
                                <div>
                                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{res.name}</h3>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <span className="star-badge">★ {res.rating}</span>
                                    {activeTab === 'blk' && <button onClick={() => setBlacklist(blacklist.filter(b => b.id !== res.id))} className="glass" style={{ padding: '0 10px', borderRadius: '4px', fontSize: '0.7rem' }}>移除</button>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button onClick={() => handleOpenMap(res)} className="glass" style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Navigation size={18} color="var(--c-gold)" />
                                  </button>
                                  <button onClick={() => toggleFavorite(res)} className="glass" style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Heart size={18} fill={favorites.some(f => f.id === res.id) ? "var(--c-gold)" : "none"} color={favorites.some(f => f.id === res.id) ? "var(--c-gold)" : "white"} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedResult && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="result-modal-overlay"
                onClick={() => setSelectedResult(null)}
              />
              <div className="result-modal-container" onClick={() => setSelectedResult(null)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 30 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="result-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="result-modal__label">命運之巔</p>
                  <h2 className="result-modal__title">{selectedResult.name}</h2>
                  <div className="result-modal__badges">
                    <span className="star-badge">★ {selectedResult.rating}</span>
                    <span className="glass" style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                      {selectedResult.open ? '營業中' : '已打烊'}
                    </span>
                  </div>
                  <p className="result-modal__address">{selectedResult.address}</p>
                  <div className="result-modal__actions">
                    <button className="btn-luxury" onClick={() => handleOpenMap(selectedResult)}>
                      <Navigation size={20} /> 導航前往
                    </button>
                    <button className="btn-secondary" onClick={() => setSelectedResult(null)}>
                      再次抽選
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* 底部導航列 */}
        <nav className="floating-dock">
          <button
            className={`dock-item ${appMode === 'order' ? 'active' : ''}`}
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10);
              setAppMode('order');
            }}
          >
            <ShoppingCart size={18} />
            點餐
          </button>

          {user?.isAdmin && (
            <>
              <button
                className={`dock-item ${appMode === 'menu' ? 'active' : ''}`}
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(10);
                  setAppMode('menu');
                }}
              >
                <Coffee size={18} />
                菜單
              </button>
              <button
                className={`dock-item ${appMode === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(10);
                  setAppMode('admin');
                }}
              >
                <LayoutDashboard size={18} />
                統計
              </button>
            </>
          )}

          <button
            className={`dock-item ${appMode === 'wheel' ? 'active' : ''}`}
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10);
              setAppMode('wheel');
            }}
          >
            <RotateCw size={18} />
            轉盤
          </button>
        </nav>
      </>
    )
  }

  return renderContent()
}

export default App
