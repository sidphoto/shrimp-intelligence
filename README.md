# SharBo Globo｜蝦報全球

Static-first global intelligence dashboard. 每日情報由 Publisher 產生 canonical JSON，前端負責 Today / Radar / Signal Detail / Emerging Signals / Business Transformation / My Radar / Archive。

## M3 多語系

前端目前支援：

- `zh-TW` — 繁體中文（預設）
- `en` — English
- `vi-VN` — Tiếng Việt

多語系不依賴 LLM 或翻譯 API。UI dictionary 位於 `locales/`，語言選擇依序使用 `?lang=`、LocalStorage、瀏覽器語言、`zh-TW` fallback。

每日情報仍只有一份 canonical data。未來若提供人工或其他流程準備的在地化內容，可放入 `data/localized/<locale>/`；缺少 localized overlay 時會安全回退 canonical 繁中，不修改 ID、score、來源、timestamp、cutoff 或其他 machine contract。

## MVP 功能

- 柔和插畫風 Light UI + Night mode
- zh-TW / en / vi-VN UI 切換
- Today Dashboard / Top Signals / Impact Chain
- Radar 搜尋與主題、地區、重要程度篩選
- Signal detail + PRIMARY / CONFIRMED / ANALYSIS 來源屬性
- Emerging Signals 趨勢
- Business Transformation 案例庫
- My Radar（LocalStorage）
- Bookmarks（LocalStorage）
- Archive
- Responsive mobile navigation
- GitHub Pages friendly hash routing

## 本機預覽

```bash
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080`。

可直接測試：

- `http://localhost:8080/?lang=zh-TW#/today`
- `http://localhost:8080/?lang=en#/today`
- `http://localhost:8080/?lang=vi-VN#/today`

## 驗證

```bash
python -m unittest discover -s tests -v
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
node --check app.js
node --check i18n.js
```

## GitHub Pages

Repository: `sidphoto/shrimp-intelligence`

Pages 使用 **GitHub Actions** 作為 Source；`.github/workflows/pages.yml` 會在 push `main` 後先執行 report + i18n validation 再部署。

## Data contract

- `data/latest.json`: 最新 canonical 晨報
- `data/YYYY-MM-DD.json`: 每日 canonical snapshot
- `data/index.json`: 歷史索引
- `data/market-live.json`: 獨立的同日市場快照
- `data/localized/<locale>/latest.json`: optional localized content overlay

Publisher 更新 canonical 資料檔時，不需要依語言複製 score、來源或驗證 metadata。
