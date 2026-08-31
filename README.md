# Shrimp Intelligence — 全球情報雷達

Static-first global intelligence dashboard. 每日情報由 Publisher 產生 JSON，前端負責 Today / Radar / Signal Detail / Emerging Signals / Business Transformation / My Radar / Archive。

## MVP 功能
- 柔和插畫風 Light UI + Night mode
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

## GitHub Pages
Repository: `sidphoto/shrimp-intelligence`

Pages 建議使用 **GitHub Actions** 作為 Source；`.github/workflows/pages.yml` 會在 push `main` 後部署。

## Data contract
- `data/latest.json`: 最新晨報
- `data/YYYY-MM-DD.json`: 每日 immutable snapshot（MVP 目前為示意）
- `data/index.json`: 歷史索引

後續 Publisher 只要更新資料檔，不需要重寫前端。
