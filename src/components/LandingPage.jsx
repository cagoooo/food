import React from 'react'
import { motion } from 'framer-motion'
import { ChefHat, RotateCw, ShoppingCart, MapPin, ArrowRight } from 'lucide-react'

const LandingPage = ({ onSelectMode }) => {
    return (
        <div className="landing-container">
            <motion.div
                className="landing-header"
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <ChefHat size={48} color="var(--c-gold)" />
                <h1 className="gradient-text landing-title">美食管家</h1>
                <p className="landing-subtitle">專業點餐系統 & 餐廳命運轉盤</p>
            </motion.div>

            <div className="landing-grid">
                {/* 同事點餐區塊 */}
                <motion.div
                    className="landing-card glass"
                    whileHover={{ scale: 1.05, borderColor: 'var(--c-gold)' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    onClick={() => onSelectMode('order')}
                >
                    <div className="landing-card__icon order-icon">
                        <ShoppingCart size={40} />
                    </div>
                    <div className="landing-card__content">
                        <h2>同事點餐</h2>
                        <p>與團隊一起輕鬆訂購午餐、飲料，統計不再頭痛。</p>
                        <div className="landing-card__action">
                            <span>立即點餐</span>
                            <ArrowRight size={18} />
                        </div>
                    </div>
                    <div className="landing-card__badge">需登入</div>
                </motion.div>

                {/* 輪盤找餐廳區塊 */}
                <motion.div
                    className="landing-card glass"
                    whileHover={{ scale: 1.05, borderColor: 'var(--c-gold)' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    onClick={() => onSelectMode('wheel')}
                >
                    <div className="landing-card__icon wheel-icon">
                        <RotateCw size={40} />
                    </div>
                    <div className="landing-card__content">
                        <h2>找找餐廳</h2>
                        <p>不知道吃什麼？讓命運轉盤為您決定附近的美味提案。</p>
                        <div className="landing-card__action">
                            <span>開啟轉盤</span>
                            <ArrowRight size={18} />
                        </div>
                    </div>
                    <div className="landing-card__badge primary">快速進入</div>
                </motion.div>
            </div>

            <motion.footer
                className="landing-footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1, duration: 1 }}
            >
                <a
                    href="https://www.smes.tyc.edu.tw/modules/tadnews/page.php?ncsn=11&nsn=16#a5"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                >
                    🍕 🍔 Made by 阿凱老師 🍜 🍣
                </a>
            </motion.footer>
        </div>
    )
}

export default LandingPage
