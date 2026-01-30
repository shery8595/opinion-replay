import json
import time
import requests
from bs4 import BeautifulSoup

# ===== CONFIG =====
TOPIC_IDS = [
    3365, 3359, 1721, 3132, 2368, 2178, 1546, 3257, 3975, 3256,
    111, 2668, 2670, 3360, 1856, 3367, 279, 3369, 3861, 3361
]

BASE_URL = "https://app.opinion.trade/detail?topicId="
OUTPUT_FILE = "market_images.json"
DELAY_SECONDS = 1.0  # be polite

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; OpinionImageScraper/1.0)"
}

# ==================

def load_cache():
    try:
        with open(OUTPUT_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_cache(data):
    with open(OUTPUT_FILE, "w") as f:
        json.dump(data, f, indent=2)

def scrape_image(topic_id):
    url = f"{BASE_URL}{topic_id}"
    print(f"🔍 Scraping {url}")

    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code != 200:
        print(f"❌ Failed ({r.status_code})")
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    # 1️⃣ Try thumbnail image
    img = soup.find("img", alt="thumbnail")
    if img and img.get("src"):
        return img["src"]

    # 2️⃣ Fallback: og:image
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]

    print("⚠ No image found")
    return None

def main():
    cache = load_cache()

    for topic_id in TOPIC_IDS:
        key = str(topic_id)

        if key in cache:
            print(f"✔ Cached: {topic_id}")
            continue

        image_url = scrape_image(topic_id)
        if image_url:
            cache[key] = image_url
            save_cache(cache)
            print(f"✅ Saved image for {topic_id}")

        time.sleep(DELAY_SECONDS)

    print("\n🎉 Done. Images saved to", OUTPUT_FILE)

if __name__ == "__main__":
    main()
