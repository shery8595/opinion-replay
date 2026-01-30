/**
 * Quick test script to check Opinion API responses
 * Run with: node test-api.js
 */

const fs = require('fs');
const path = require('path');

// Read API key from .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/VITE_OPINION_API_KEY\s*=\s*(.+)/);
const API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : '';

console.log(`🔑 API Key loaded: ${API_KEY.substring(0, 10)}...`);

const BASE_URL = 'https://openapi.opinion.trade/openapi';

async function fetchAPI(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\n🔍 Fetching: ${endpoint}`);

    const response = await fetch(url, {
        headers: {
            'apikey': API_KEY.trim(),
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json();
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));

    return data;
}

async function testAPI() {
    console.log('🚀 Testing Opinion API Integration\n');
    console.log('='.repeat(60));

    try {
        // 1. Get activated markets
        console.log('\n📊 TEST 1: Fetch Activated Markets');
        console.log('='.repeat(60));
        const marketsData = await fetchAPI('/market?status=activated&limit=3&sortBy=5&marketType=0');

        if (!marketsData.result?.list?.[0]) {
            console.error('❌ No markets found!');
            return;
        }

        const firstMarket = marketsData.result.list[0];
        console.log(`\n✅ Found market: ${firstMarket.marketTitle}`);
        console.log(`   Token ID: ${firstMarket.yesTokenId}`);
        console.log(`   Volume: ${firstMarket.volume}`);

        // 2. Get price history
        if (firstMarket.yesTokenId) {
            console.log('\n\n📈 TEST 2: Fetch Price History (1h interval)');
            console.log('='.repeat(60));
            const priceHistory = await fetchAPI(`/token/price-history?token_id=${firstMarket.yesTokenId}&interval=1h`);

            if (priceHistory.result?.history?.length > 0) {
                console.log(`\n✅ Got ${priceHistory.result.history.length} price points`);
                console.log(`   First point: ${JSON.stringify(priceHistory.result.history[0])}`);
                console.log(`   Last point: ${JSON.stringify(priceHistory.result.history[priceHistory.result.history.length - 1])}`);
            }

            // 3. Get latest price
            console.log('\n\n💰 TEST 3: Fetch Latest Price');
            console.log('='.repeat(60));
            const latestPrice = await fetchAPI(`/token/latest-price?token_id=${firstMarket.yesTokenId}`);

            if (latestPrice.result?.price) {
                console.log(`\n✅ Latest price: ${latestPrice.result.price}`);
            }

            // 4. Get orderbook
            console.log('\n\n📖 TEST 4: Fetch Orderbook');
            console.log('='.repeat(60));
            const orderbook = await fetchAPI(`/token/orderbook?token_id=${firstMarket.yesTokenId}`);

            if (orderbook.result?.bids && orderbook.result?.asks) {
                console.log(`\n✅ Bids: ${orderbook.result.bids.length}, Asks: ${orderbook.result.asks.length}`);
            }
        }

        console.log('\n\n' + '='.repeat(60));
        console.log('✅ API Test Complete!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testAPI();
