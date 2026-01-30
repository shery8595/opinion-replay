# 📈 Opinion Market Intelligence
### Institutional-Grade Prediction Market Backtesting & Replay Suite
</div>

---

## 🚀 Overview
**Opinion Market Intelligence** is a professional-grade analysis platform designed for prediction market traders. It transforms passive market data from `app.opinion.trade` into an interactive research environment, enabling users to backtest strategies, simulate trades, and monitor live market sentiment with institutional precision.

---

## 🛠 Core Modules

### 1. 🕰 Market Time Machine (Replay Engine)
A high-fidelity market replay system that allows you to step through historical price action candle-by-candle.
- **Interactive Replay**: Variable speed controls (0.1x to 5x) for granular or macro analysis.
- **Virtual Paper Trading**: Execute YES/NO trades in a simulated environment with real-time P&L tracking based on historical candles.
- **Key Moment Detection**: Automated identification of price spikes, volume surges, and market-shaping events.
- **Trade Annotations**: Mark specific timestamps with notes for strategy refinement.

### 2. 📊 Market Intelligence (Analytics)
A premium dashboard for identifying alpha across the ecosystem.
- **Category Navigation**: filter across Macro, Crypto, Business, Politics, and more.
- **Dynamic Leaderboards**: Track Top Volume, Newest Markets, and Closing Soon opportunities.
- **Visual Sentience**: Real-time integration of market images (PFPs) for instant recognition.

### 3. 🔔 Market Reminders (Persistence Engine)
A sophisticated 3-column monitoring interface for deployed alerts.
- **Protocol-Specific Alerts**: Set price targets, resolution warnings, or time-based notifications.
- **Market Library**: Integrated image-rich library for quick alert deployment.
- **System Monitoring**: Live health checks for browser notifications and data streams.

---

## ✨ Key Features
- **Visual Excellence**: Premium dark UI with glassmorphism, fluid Framer Motion animations, and a cohesive design system.
- **Image Integration**: Custom Node.js/Puppeteer scraper for extracting market PFPs, cached in `market_images.json`.
- **Keyboard Shortcuts**: Professional hotkeys (`Space` to pause, `Arrows` to step, `1-5` for speed, `M` to mark).
- **Responsive Architecture**: Built with React 19, Vite, and TypeScript for maximum performance and type safety.

---

## ⚙️ Tech Stack
| Category | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | Vanilla CSS, Framer Motion (Animations), Lucide React (Icons) |
| **Charts** | Lightweight Charts (TradingView style), Recharts |
| **Automation** | Puppeteer (Scraping), Node-Fetch |
| **AI Integration** | Google Gemini API (Strategic Insights) |

---

## 🏁 Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **Opinion API Key**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/opinion-intelligence.git

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env.local` file in the root directory:
```env
VITE_OPINION_API_KEY=your_opinion_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Development Server
```bash
npm run dev
```

---

## 📸 Image Scraper Utility
To keep market images up to date, use our custom scraper tool:
- **Topic Configuration**: Edit `TOPIC_IDS` in `scrape_market_images.mjs`.
- **Execution**: `node scrape_market_images.mjs`
- **Result**: New images are auto-cached and integrated into the UI.

---

## 📂 Project Structure
```text
├── components/          # UI Components (Analytics, Time Machine, etc.)
├── services/            # API Clients & Data Transformers
├── utils/               # Image Utility & Market Mappings
├── market_images.json   # Scraped image cache
├── scrape_market_images.mjs # Puppeteer automation tool
├── types.ts             # Global interface definitions
└── App.tsx              # Main dashboard routing
```

---

<div align="center">
Built for professional traders in the Opinion ecosystem.
</div>
