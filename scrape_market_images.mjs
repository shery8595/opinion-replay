import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// ===== CONFIG =====
const TOPIC_IDS = [
    // Original Batch
    3365, 3359, 1721, 3132, 2368, 2178, 1546, 3257, 3975, 3256,
    111, 2668, 2670, 3360, 1856, 3367, 279, 3369, 3861, 3361,
    // Analytics Batch (Top Volume)
    4892, 4932, 4003, 3356, 3055, 3072, 3364, 4145, 4965, 4891, 4620, 3357, 5024,
    // Analytics Batch (Newest/Closing)
    210, 693, 342, 209, 374, 565, 563, 212, 564, 5026, 5025, 4144, 414, 3062
];

const BASE_URL = "https://app.opinion.trade/detail?topicId=";
const OUTPUT_FILE = "market_images.json";
const DELAY_MS = 2000; // wait for page to load

// ==================

function loadCache() {
    try {
        if (existsSync(OUTPUT_FILE)) {
            return JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('No cache found, starting fresh');
    }
    return {};
}

function saveCache(data) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeImage(page, topicId) {
    const url = `${BASE_URL}${topicId}`;
    console.log(`🔍 Scraping ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for the thumbnail image to load
        await sleep(DELAY_MS);

        // Look for the specific thumbnail image with the opinion.trade image URL
        const imageUrl = await page.evaluate(() => {
            // Find the thumbnail image with the specific class pattern
            const img = document.querySelector('img[alt="thumbnail"]');
            if (img && img.src && img.src.includes('images.opinion.trade')) {
                return img.src;
            }

            // Fallback: look for any image with opinion.trade domain
            const allImages = document.querySelectorAll('img');
            for (const image of allImages) {
                if (image.src && image.src.includes('images.opinion.trade')) {
                    return image.src;
                }
            }

            // Last fallback: og:image
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) {
                return ogImage.content;
            }

            return null;
        });

        if (imageUrl) {
            console.log(`   Found: ${imageUrl.substring(0, 80)}...`);
            return imageUrl;
        }

        console.log("⚠ No image found");
        return null;
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const cache = loadCache();
    let scraped = 0;

    try {
        for (const topicId of TOPIC_IDS) {
            const key = String(topicId);

            if (cache[key]) {
                console.log(`✔ Cached: ${topicId}`);
                continue;
            }

            const imageUrl = await scrapeImage(page, topicId);
            if (imageUrl) {
                cache[key] = imageUrl;
                saveCache(cache);
                console.log(`✅ Saved image for ${topicId}`);
                scraped++;
            }

            await sleep(1000); // Small delay between requests
        }
    } finally {
        await browser.close();
    }

    console.log(`\n🎉 Done. Scraped ${scraped} new images. Total saved to ${OUTPUT_FILE}`);
}

main();
