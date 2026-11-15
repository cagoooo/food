// 登入頁面元件
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, ChefHat, ArrowRight } from 'lucide-react'
import { saveCurrentUser, signInAdminWithGoogle, logActivity, ActivityTypes } from '../services/firebase'

const LoginPage = ({ onLogin, onBack }) => {
    const [name, setName] = useState('')
    const [clickCount, setClickCount] = useState(0)
    const [showAdminLogin, setShowAdminLogin] = useState(false)
    const [adminLoading, setAdminLoading] = useState(false)
    const [error, setError] = useState('')

    // 點擊 Logo 5 次觸發管理者登入
    const handleLogoClick = () => {
        const newCount = clickCount + 1
        setClickCount(newCount)
        if (newCount >= 5) {
            setShowAdminLogin(true)
            setClickCount(0)
        }
        // 3 秒後重置計數
        setTimeout(() => setClickCount(0), 3000)
    }

    // 一般用戶登入
    const handleUserLogin = () => {
        if (!name.trim()) {
            setError('請輸入您的姓名')
            return
        }
        const user = { name: name.trim(), isAdmin: false }
        saveCurrentUser(user)
        logActivity(ActivityTypes.LOGIN, { userName: user.name })
        onLogin(user)
    }

    // 管理者登入：Google 帳號＋伺服器端名單確認
    const handleAdminLogin = async () => {
        setError('')
        setAdminLoading(true)
        try {
            const user = await signInAdminWithGoogle()
            saveCurrentUser(user)
            logActivity(ActivityTypes.ADMIN_LOGIN, { success: true })
            onLogin(user)
        } catch (err) {
            logActivity(ActivityTypes.ADMIN_LOGIN, { success: false })
            if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
                setError('已取消登入')
            } else if (err?.code === 'auth/popup-blocked') {
                setError('瀏覽器擋住了登入視窗，請允許彈出視窗後再試一次')
            } else {
                setError(err?.message || '登入失敗，請再試一次')
            }
        } finally {
            setAdminLoading(false)
        }
    }

    return (
        <div className="login-container">
            <motion.div
                className="login-card glass"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                {/* Logo 區域 - 點擊 5 次觸發管理者登入 */}
                <motion.div
                    className="login-logo"
                    onClick={handleLogoClick}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ cursor: 'pointer' }}
                >
                    <ChefHat size={64} color="var(--c-gold)" />
                    <h1 className="gradient-text" style={{ fontSize: '2rem', marginTop: '16px' }}>
                        同事點餐
                    </h1>
                    <p style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: '8px' }}>
                        COLLEAGUE ORDERING SYSTEM
                    </p>
                </motion.div>

                <AnimatePresence mode="wait">
                    {!showAdminLogin ? (
                        <motion.div
                            key="user-login"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="login-form"
                        >
                            <div className="input-group">
                                <User size={20} className="input-icon" />
                                <input
                                    type="text"
                                    placeholder="請輸入您的姓名"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value)
                                        setError('')
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleUserLogin()}
                                    className="glass-input"
                                />
                            </div>

                            {error && (
                                <motion.p
                                    className="error-text"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    {error}
                                </motion.p>
                            )}

                            <motion.button
                                className="btn-luxury login-btn"
                                onClick={handleUserLogin}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{ marginBottom: '12px' }}
                            >
                                <span>開始點餐</span>
                                <ArrowRight size={20} />
                            </motion.button>

                            <button
                                className="btn-secondary"
                                onClick={onBack}
                                style={{ width: '100%', opacity: 0.7 }}
                            >
                                返回功能選單
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="admin-login"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="login-form"
                        >
                            <div className="admin-badge">
                                <Lock size={16} />
                                <span>管理者登入</span>
                            </div>

                            <p style={{ opacity: 0.75, fontSize: '0.9rem', lineHeight: 1.6, margin: '8px 0 4px' }}>
                                請用管理員的 Google 帳號登入，只有名單內的帳號能管理菜單與使用 AI 辨識。
                            </p>

                            {error && (
                                <motion.p
                                    className="error-text"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    {error}
                                </motion.p>
                            )}

                            <div className="login-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowAdminLogin(false)
                                        setError('')
                                    }}
                                >
                                    返回
                                </button>
                                <motion.button
                                    className="btn-luxury"
                                    onClick={handleAdminLogin}
                                    disabled={adminLoading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Lock size={18} />
                                    <span>{adminLoading ? '確認中…' : '使用 Google 帳號登入'}</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

export default LoginPage
