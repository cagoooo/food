// 餐廳轉盤組件 - 豪華版
// 功能：從附近餐廳隨機選擇，Canvas 繪製，物理慣性動畫，音效回饋
import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    RotateCw, Navigation, RefreshCw, Volume2, VolumeX, Sparkles,
    Star, Heart, MapPin, Phone, Clock, ExternalLink
} from 'lucide-react'
import confetti from 'canvas-confetti'

// 轉盤顏色配置
const WHEEL_COLORS = [
    '#F59E0B', '#EF4444', '#10B981', '#3B82F6',
    '#8B5CF6', '#EC4899', '#F97316', '#14B8A6',
    '#6366F1', '#84CC16', '#F43F5E', '#06B6D4'
]

const RestaurantSpinWheel = ({
    restaurants,
    onNavigate,
    onToggleFavorite,
    favorites = [],
    loading = false
}) => {
    const canvasRef = useRef(null)
    const [spinning, setSpinning] = useState(false)
    const [result, setResult] = useState(null)
    const [showResult, setShowResult] = useState(false)
    const [rotation, setRotation] = useState(0)
    const [history, setHistory] = useState([])
    const [soundEnabled, setSoundEnabled] = useState(true)

    // 音效 refs
    const tickSoundRef = useRef(null)
    const winSoundRef = useRef(null)

    // 限制顯示數量
    const displayItems = restaurants.slice(0, 12)

    // 初始化音效
    useEffect(() => {
        // 使用 Web Audio API 產生音效
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()

        // 產生滴答聲
        const createTickSound = () => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            const filter = audioContext.createBiquadFilter()

            oscillator.connect(filter)
            filter.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.frequency.value = 1200
            oscillator.type = 'square'
            filter.type = 'lowpass'
            filter.frequency.value = 800

            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03)
            oscillator.start()
            oscillator.stop(audioContext.currentTime + 0.03)
        }

        // 產生中獎聲
        const createWinSound = () => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            oscillator.frequency.value = 523.25 // C5
            oscillator.type = 'sine'
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
            oscillator.start()

            // 播放和弦
            setTimeout(() => {
                const osc2 = audioContext.createOscillator()
                const gain2 = audioContext.createGain()
                osc2.connect(gain2)
                gain2.connect(audioContext.destination)
                osc2.frequency.value = 659.25 // E5
                osc2.type = 'sine'
                gain2.gain.setValueAtTime(0.2, audioContext.currentTime)
                gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
                osc2.start()
                osc2.stop(audioContext.currentTime + 0.4)
            }, 100)

            setTimeout(() => {
                const osc3 = audioContext.createOscillator()
                const gain3 = audioContext.createGain()
                osc3.connect(gain3)
                gain3.connect(audioContext.destination)
                osc3.frequency.value = 783.99 // G5
                osc3.type = 'sine'
                gain3.gain.setValueAtTime(0.2, audioContext.currentTime)
                gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
                osc3.start()
                osc3.stop(audioContext.currentTime + 0.3)
            }, 200)

            oscillator.stop(audioContext.currentTime + 0.5)
        }

        tickSoundRef.current = createTickSound
        winSoundRef.current = createWinSound
    }, [])

    // 繪製轉盤
    const drawWheel = useCallback((ctx, items, currentRotation) => {
        const canvas = canvasRef.current
        if (!canvas || items.length === 0) return

        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const radius = Math.min(centerX, centerY) - 20
        const sliceAngle = (2 * Math.PI) / items.length

        // 清空畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // 繪製外框陰影
        ctx.save()
        ctx.shadowColor = 'rgba(245, 158, 11, 0.3)'
        ctx.shadowBlur = 30
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
        ctx.lineWidth = 4
        ctx.stroke()
        ctx.restore()

        // 繪製每個扇形
        items.forEach((item, i) => {
            const startAngle = currentRotation + i * sliceAngle - Math.PI / 2
            const endAngle = currentRotation + (i + 1) * sliceAngle - Math.PI / 2

            // 繪製扇形
            ctx.beginPath()
            ctx.moveTo(centerX, centerY)
            ctx.arc(centerX, centerY, radius, startAngle, endAngle)
            ctx.closePath()

            // 漸層填充
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
            const baseColor = WHEEL_COLORS[i % WHEEL_COLORS.length]
            gradient.addColorStop(0, baseColor + '40')
            gradient.addColorStop(0.7, baseColor + '80')
            gradient.addColorStop(1, baseColor)
            ctx.fillStyle = gradient
            ctx.fill()

            // 繪製邊框
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
            ctx.lineWidth = 2
            ctx.stroke()

            // 繪製文字
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(startAngle + sliceAngle / 2)
            ctx.textAlign = 'right'
            ctx.fillStyle = 'white'
            ctx.font = 'bold 12px "Inter", sans-serif'
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
            ctx.shadowBlur = 4

            const text = item.name.length > 10 ? item.name.substring(0, 9) + '..' : item.name
            ctx.fillText(text, radius - 15, 5)

            // 繪製評分
            ctx.font = '10px "Inter", sans-serif'
            ctx.fillStyle = '#FBBF24'
            ctx.fillText(`★${item.rating || '?'}`, radius - 15, 18)
            ctx.restore()
        })

        // 繪製中心圓
        const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 45)
        centerGradient.addColorStop(0, '#1e293b')
        centerGradient.addColorStop(1, '#0f172a')
        ctx.beginPath()
        ctx.arc(centerX, centerY, 45, 0, 2 * Math.PI)
        ctx.fillStyle = centerGradient
        ctx.fill()
        ctx.strokeStyle = 'var(--c-gold)'
        ctx.lineWidth = 3
        ctx.stroke()

        // 中心 Logo
        ctx.fillStyle = '#F59E0B'
        ctx.font = 'bold 28px "Inter", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🍜', centerX, centerY)
    }, [])

    // 動畫更新
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        drawWheel(ctx, displayItems, rotation)
    }, [displayItems, rotation, drawWheel])

    // 開始轉動
    const spin = () => {
        if (spinning || displayItems.length === 0) return

        setSpinning(true)
        setShowResult(false)
        setResult(null)

        // 計算目標角度
        const itemCount = displayItems.length
        const sliceAngle = (2 * Math.PI) / itemCount

        // 排除最近選過的項目（如果可能）
        let availableItems = displayItems.filter(item => !history.includes(item.id))
        if (availableItems.length === 0) {
            availableItems = displayItems
            setHistory([])
        }

        const randomIndex = Math.floor(Math.random() * availableItems.length)
        const selectedItem = availableItems[randomIndex]
        const actualIndex = displayItems.findIndex(item => item.id === selectedItem.id)

        // 計算最終角度（確保指針對準中間）
        const targetSliceRotation = actualIndex * sliceAngle + sliceAngle / 2
        const totalRotation = Math.PI * 10 + (2 * Math.PI - targetSliceRotation) // 5 圈 + 對齊

        // 物理慣性動畫
        let startTime = null
        const duration = 5000 // 5 秒
        const startRotation = rotation

        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

        let lastTickAngle = startRotation

        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = easeOutCubic(progress)

            const currentRotation = startRotation + totalRotation * eased
            setRotation(currentRotation)

            // 播放滴答聲（每經過一個扇形）
            if (soundEnabled && tickSoundRef.current) {
                const angleChange = currentRotation - lastTickAngle
                if (angleChange > sliceAngle) {
                    try {
                        tickSoundRef.current()
                    } catch (e) {
                        // 忽略音效錯誤
                    }
                    lastTickAngle = currentRotation
                }
            }

            if (progress < 1) {
                requestAnimationFrame(animate)
            } else {
                // 動畫結束
                setSpinning(false)
                setResult(selectedItem)
                setShowResult(true)
                setHistory(prev => [...prev.slice(-4), selectedItem.id])

                // 播放中獎音效
                if (soundEnabled && winSoundRef.current) {
                    try {
                        winSoundRef.current()
                    } catch (e) {
                        // 忽略音效錯誤
                    }
                }

                // 發射彩帶
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#F59E0B', '#FAF9F6', '#E11D48']
                })

                // 震動回饋
                if ('vibrate' in navigator) {
                    navigator.vibrate([100, 50, 100, 50, 200])
                }
            }
        }

        requestAnimationFrame(animate)
    }

    // 收藏狀態
    const isFavorite = result ? favorites.some(f => f.id === result.id) : false

    return (
        <div className="restaurant-spin-wheel">
            <div className="wheel-header">
                <h2 className="gradient-text">🍜 今天去哪吃？</h2>
                <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>
                    {displayItems.length} 間餐廳等你來轉
                </p>
                <button
                    className="sound-toggle"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    title={soundEnabled ? '關閉音效' : '開啟音效'}
                >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
            </div>

            {displayItems.length > 0 ? (
                <div className="wheel-container">
                    {/* 指針 */}
                    <div className="wheel-pointer">
                        <svg width="40" height="50" viewBox="0 0 40 50">
                            <defs>
                                <linearGradient id="pointerGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#F59E0B" />
                                    <stop offset="100%" stopColor="#D97706" />
                                </linearGradient>
                                <filter id="pointerShadow2">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
                                </filter>
                            </defs>
                            <path
                                d="M 0 0 L 40 0 L 20 50 Z"
                                fill="url(#pointerGradient2)"
                                filter="url(#pointerShadow2)"
                            />
                        </svg>
                    </div>

                    {/* Canvas 轉盤 */}
                    <canvas
                        ref={canvasRef}
                        width={420}
                        height={420}
                        className={`wheel-canvas ${spinning ? 'spinning' : ''}`}
                    />

                    {/* 轉動按鈕 */}
                    <motion.button
                        className="spin-button btn-luxury"
                        onClick={spin}
                        disabled={spinning || displayItems.length === 0}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {spinning ? (
                            <>
                                <RotateCw size={20} className="spinning" />
                                命運轉動中...
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                開始抽選餐廳
                            </>
                        )}
                    </motion.button>
                </div>
            ) : (
                <div className="wheel-empty">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    >
                        <MapPin size={80} style={{ color: 'var(--c-gold)', opacity: 0.3 }} />
                    </motion.div>
                    <p style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
                        {loading ? '正在尋找餐廳...' : '尚未載入餐廳'}
                    </p>
                    <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>
                        請先點擊「開始定位」
                    </p>
                </div>
            )}

            {/* 結果彈窗 - 使用 Portal 確保置中 */}
            {ReactDOM.createPortal(
                <AnimatePresence>
                    {showResult && result && (
                        <>
                            <motion.div
                                className="wheel-result-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowResult(false)}
                            />
                            <div className="wheel-result-wrapper">
                                <motion.div
                                    className="wheel-result-modal-container"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <div
                                        className="restaurant-3d-card"
                                        onMouseMove={(e) => {
                                            const card = e.currentTarget;
                                            const rect = card.getBoundingClientRect();
                                            const x = e.clientX - rect.left;
                                            const y = e.clientY - rect.top;
                                            const centerX = rect.width / 2;
                                            const centerY = rect.height / 2;
                                            const rotateX = (y - centerY) / 10;
                                            const rotateY = (centerX - x) / 10;

                                            card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                                            card.style.setProperty('--shine-x', `${(x / rect.width) * 100}%`);
                                            card.style.setProperty('--shine-y', `${(y / rect.height) * 100}%`);
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'rotateX(0deg) rotateY(0deg)';
                                        }}
                                    >
                                        <div className="restaurant-3d-card__inner">
                                            <div className="restaurant-3d-card__shine" />
                                            <div className="restaurant-3d-card__content">
                                                <div className="result-confetti">🎉</div>
                                                <p className="result-label">命運之巔</p>
                                                <h3 className="result-restaurant-name">{result.name}</h3>

                                                <div className="result-badges">
                                                    <span className="star-badge">★ {result.rating || '?'}</span>
                                                    {result.open !== undefined && (
                                                        <span className={`status-badge ${result.open ? 'open' : 'closed'}`}>
                                                            {result.open ? '營業中' : '已打烊'}
                                                        </span>
                                                    )}
                                                </div>

                                                {result.address && (
                                                    <p className="result-address">
                                                        <MapPin size={14} />
                                                        {result.address}
                                                    </p>
                                                )}

                                                <div className="result-actions restaurant-actions">
                                                    <motion.button
                                                        className="btn-luxury"
                                                        onClick={() => onNavigate && onNavigate(result)}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={() => {
                                                            if ('vibrate' in navigator) navigator.vibrate(20);
                                                            onNavigate && onNavigate(result);
                                                        }}
                                                    >
                                                        <Navigation size={18} />
                                                        導航前往
                                                    </motion.button>
                                                    <div className="action-row">
                                                        <button
                                                            className="btn-secondary"
                                                            onClick={() => {
                                                                if ('vibrate' in navigator) navigator.vibrate(10);
                                                                setShowResult(false)
                                                                setTimeout(spin, 300)
                                                            }}
                                                        >
                                                            <RefreshCw size={18} />
                                                            再轉一次
                                                        </button>
                                                        <button
                                                            className={`btn-icon ${isFavorite ? 'favorited' : ''}`}
                                                            onClick={() => {
                                                                if ('vibrate' in navigator) navigator.vibrate(10);
                                                                onToggleFavorite && onToggleFavorite(result);
                                                            }}
                                                        >
                                                            <Heart
                                                                size={20}
                                                                fill={isFavorite ? 'var(--c-gold)' : 'none'}
                                                                color={isFavorite ? 'var(--c-gold)' : 'white'}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* 歷史記錄 */}
            {history.length > 0 && (
                <div className="wheel-history">
                    <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>最近選過：</span>
                    <div className="history-items">
                        {history.slice(-3).map((itemId, idx) => {
                            const item = displayItems.find(m => m.id === itemId)
                            return item ? (
                                <span key={idx} className="history-tag">{item.name}</span>
                            ) : null
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default RestaurantSpinWheel
