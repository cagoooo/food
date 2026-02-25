// 登入頁面元件
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, ChefHat, ArrowRight } from 'lucide-react'
import { saveCurrentUser, verifyAdminPassword, logActivity, ActivityTypes } from '../services/firebase'

const LoginPage = ({ onLogin, onBack }) => {
    const [name, setName] = useState('')
    const [clickCount, setClickCount] = useState(0)
    const [showAdminLogin, setShowAdminLogin] = useState(false)
    const [adminPassword, setAdminPassword] = useState('')
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

    // 管理者登入
    const handleAdminLogin = () => {
        if (verifyAdminPassword(adminPassword)) {
            const user = { name: '管理員', isAdmin: true }
            saveCurrentUser(user)
            logActivity(ActivityTypes.ADMIN_LOGIN, { success: true })
            onLogin(user)
        } else {
            logActivity(ActivityTypes.ADMIN_LOGIN, { success: false })
            setError('密碼錯誤')
            setAdminPassword('')
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

                            <div className="input-group">
                                <Lock size={20} className="input-icon" />
                                <input
                                    type="password"
                                    placeholder="請輸入管理者密碼"
                                    value={adminPassword}
                                    onChange={(e) => {
                                        setAdminPassword(e.target.value)
                                        setError('')
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
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

                            <div className="login-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowAdminLogin(false)
                                        setAdminPassword('')
                                        setError('')
                                    }}
                                >
                                    返回
                                </button>
                                <motion.button
                                    className="btn-luxury"
                                    onClick={handleAdminLogin}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Lock size={18} />
                                    <span>登入</span>
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
