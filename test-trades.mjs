
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/VITE_OPINION_API_KEY\s*=\s*(.+)/);
const API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const BASE_URL = 'https://openapi.opinion.trade/openapi';

async function fetchAPI(endpoint) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\n🔍 Fetching: ${endpoint}`);

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': API_KEY.trim(),
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log(`✅ Status: ${response.status}`);
        if (response.status === 200) {
            console.log(`📦 Sample:`, JSON.stringify(data).substring(0, 200));
        }
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
    }
}

async function test() {
    const tokenId = '0x15a31af7103aae0c679a9cd892ccbc1f8cbf57e3'; // From user log (Satoshi market)

    await fetchAPI(`/token/trades?token_id=${tokenId}&limit=5`);
    await fetchAPI(`/trade/history?token_id=${tokenId}&limit=5`);
    await fetchAPI(`/token/trade/history?token_id=${tokenId}&limit=5`);
    await fetchAPI(`/trade?token_id=${tokenId}&limit=5`);
}

test();
