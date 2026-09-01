# SharBo Globo｜蝦報全球 — Claude 多語系與在地化交接文件

Status: implementation handoff
Owner intent: Claude Code 接手 UI 多語系與內容在地化設計
Phase: M2.6

---

## 1. 產品定位

**SharBo Globo｜蝦報全球** 是 static-first 全球情報雷達，不是一般新聞聚合器。

核心資料流：

`Tavily discovery → trusted-source verification → Source Registry → exact 06:00 cutoff → event clustering → ranking → reader-facing enrichment → validator → GitHub Pages`

市場資料與新聞資料分離：

- 新聞/情報視窗：前一日 00:00 → 當日 06:00，`Asia/Taipei`
- 市場快覽可以使用獨立 snapshot，但必須顯示/保留自己的 `captured_at` / `as_of`，不得拿市場快照時間反向污染新聞事件視窗。

任何多語系改造都不可破壞 `AGENTS.md` 的 cutoff、Top 5、source class、fail-closed、excluded topic 規則。

---

## 2. Phase 1 語系

必做：

| Locale | 顯示名稱 | 角色 |
|---|---|---|
| `zh-TW` | 繁體中文 | canonical/default；台灣使用者 |
| `en` | English | 國際版 |
| `vi-VN` | Tiếng Việt | 越南文在地化；台灣/越南讀者 |

未來可擴充 `ja-JP`, `ko-KR`, `th-TH`, `id-ID`，但 Phase 1 不做。

Locale fallback：

`requested locale → language family fallback → zh-TW`

例如 `vi` → `vi-VN`，未知語系 → `zh-TW`。

---

## 3. 最高原則：i18n 與 localization 分層

### A. UI i18n

導航、按鈕、標籤、說明、錯誤、日期格式、數字格式、source class 顯示文字。

這些是 deterministic 靜態字串，可完整翻譯。

### B. Intelligence content localization

`world_summary`, signal title, `what_happened`, `why_now`, `why_important`, `winners_losers`, `taiwan_impact`, `what_next`, emerging signal explanation, business case narrative。

這些不能只用 UI dictionary 硬翻。應保留 canonical content，再用 locale overlay / localized payload 呈現。

**禁止**直接覆寫 canonical factual data。

---

## 4. 建議目錄結構

```text
locales/
├── zh-TW.json
├── en.json
└── vi-VN.json

data/
├── latest.json                  # canonical report
├── YYYY-MM-DD.json              # canonical archive
├── market-live.json             # current market snapshot if available
└── localized/
    ├── en/
    │   ├── latest.json
    │   └── YYYY-MM-DD.json
    └── vi-VN/
        ├── latest.json
        └── YYYY-MM-DD.json
```

Phase 1 可以先完成 UI i18n + localization contract；若沒有可靠 content translator，localized payload 不得用假的或規則式拼湊內容填滿。

---

## 5. Canonical data 不得翻譯/改寫的欄位

以下 machine/data contract 必須跨語言完全一致：

- `id`
- `date`
- `generated_at`
- `engine_version`
- `window.start/end/timezone`
- `score`
- `source_class`
- `categories[]` machine slugs
- `regions[]` machine slugs
- `sources[].class`
- `sources[].url`
- `sources[].published_at`
- `sources[].cutoff_status`
- `observed_at`
- `window_verified`
- `top5_ids`
- market numeric `value` 原值（顯示格式可 locale format）
- market/source URLs

不要翻譯 domain、公司正式名稱、股票代碼、API enum、UUID/ID。

---

## 6. 可在地化欄位

可提供 localized presentation：

```json
{
  "locale": "vi-VN",
  "world_summary": "...",
  "signals": {
    "20260901-xxxx": {
      "title": "...",
      "what_happened": "...",
      "why_now": "...",
      "why_important": "...",
      "winners_losers": "...",
      "taiwan_impact": "...",
      "what_next": "..."
    }
  }
}
```

推薦 overlay，不複製 scores/sources 等 immutable contract。

前端組合：

`canonical report + locale overlay + UI dictionary → rendered page`

如果 localized content 缺欄：fallback 至 canonical `zh-TW`，不要顯示空白。

---

## 7. 前端 Locale State

建議：

```js
state.locale = resolveLocale(
  new URLSearchParams(location.search).get('lang'),
  localStorage.getItem('sharbo:locale'),
  navigator.language,
  'zh-TW'
)
```

優先序：

1. URL `?lang=`
2. LocalStorage
3. Browser locale
4. `zh-TW`

分享網址應保留 locale，例如：

`?lang=vi-VN#/today`

切換語言時：

- 更新 `localStorage['sharbo:locale']`
- 更新 URL query
- 保留目前 hash route
- 不清除 bookmarks / filters / theme
- 更新 `<html lang>`
- 更新 `<title>` / meta description

---

## 8. UI Dictionary 規則

不要在 `app.js` 繼續硬編大量中英文字串。

建立：

```js
t('nav.today')
t('market.title')
t('source.primary')
t('quality.windowVerified')
```

`locales/*.json` key 必須相同；CI 應檢查缺 key。

建議 namespace：

```text
brand.*
nav.*
hero.*
filters.*
market.*
signal.*
source.*
quality.*
emerging.*
business.*
archive.*
settings.*
errors.*
common.*
```

---

## 9. Brand 規則

Canonical brand：

**SharBo Globo｜蝦報全球**

`SharBo Globo` 不翻譯。

建議 subtitle：

- zh-TW: `全球情報雷達`
- en: `Global Intelligence Radar`
- vi-VN: `Radar tình báo toàn cầu`

禁止重新使用舊正式品牌 `Shrimp Intelligence` 作主要產品名稱；若舊字串仍存在，這次 i18n refactor 一併清理。

---

## 10. 繁中（zh-TW）在地化語氣

風格：

- 台灣繁體中文
- 情報/商業媒體語氣，簡潔、專業
- 不使用中國大陸簡體慣用詞
- `資訊`、`軟體`、`資料`、`網路`、`半導體` 等用台灣詞彙
- 政府/機構名稱優先官方台灣常見譯名
- 金額、日期、百分比要容易閱讀

避免：

- 生硬逐字翻譯 Reuters 標題
- 工程術語直接露出（Tavily, deterministic, API mode）
- 把 source relevance 當可信度

---

## 11. 英文（en）在地化語氣

不是逐字把中文翻回英文。

要求：

- concise intelligence brief
- title 優先自然英文 headline style
- `Taiwan impact` 改成自然標題如 `Why it matters for Taiwan`
- 避免 Chinese sentence structure
- 專有名詞優先來源正式英文名稱
- 日期依英文 locale 格式顯示，但 canonical timestamp 不變

Source classes UI labels：

- PRIMARY → Primary source
- CONFIRMED → Confirmed
- ANALYSIS → Analysis
- COMMUNITY → Community discovery
- UNVERIFIED → Unverified

Machine value 不改。

---

## 12. 越南文（vi-VN）在地化原則

目標不是 Google Translate 風格，而是給越南讀者自然閱讀的「全球情報摘要」。

要求：

- 自然現代越南文
- 保留重要國際組織/公司正式名稱，第一次可加越文解釋
- 台灣特有機構名稱應以可理解的越文呈現，必要時保留中文/英文正式名
- `Taiwan impact` 建議：`Tác động đối với Đài Loan`
- `Why it matters`：`Vì sao điều này quan trọng`
- `What next`：`Cần theo dõi gì tiếp theo`
- 不把政治/軍事詞彙過度情緒化
- 金融用語使用越南商業媒體常用表達
- 半導體 / AI / supply-chain 專有詞可保留業界英文縮寫

例：

- 供應鏈 → `chuỗi cung ứng`
- 半導體 → `chất bán dẫn`
- 人工智慧 → `trí tuệ nhân tạo (AI)`，後續可直接 `AI`
- 中央銀行 → `ngân hàng trung ương`
- 地緣政治 → `địa chính trị`
- 灰色地帶 → 視上下文用 `vùng xám`，避免脫離安全語境硬翻

---

## 13. Proper Noun / Entity Policy

優先順序：

1. Source 官方名稱
2. 國際通用名稱
3. 目標 locale 常見譯名
4. 必要時 `localized name (official name)`

不要翻：

- URLs / domains
- GitHub repo names
- product/model names
- ticker symbols
- `SharBo Globo`

地名可 locale 化，但不要改變 source URL 或 region machine slug。

---

## 14. 日期、時間、數字

Canonical timezone 永遠保留 `Asia/Taipei`。

UI 可 locale formatting：

- zh-TW: `2026/9/1 05:55`
- en: `Sep 1, 2026, 5:55 AM`
- vi-VN: `05:55, 01/09/2026`

但是報告 cutoff 文義必須清楚：

- zh-TW: `資料截止：06:00（台北時間）`
- en: `Data cutoff: 06:00 Asia/Taipei`
- vi-VN: `Mốc chốt dữ liệu: 06:00 (giờ Đài Bắc)`

數字用 `Intl.NumberFormat(locale)`；不要把 canonical JSON numeric semantics 改掉。

---

## 15. 市場快覽 localization

市場卡是獨立 snapshot；UI 必須能顯示 as-of context。

建議 label：

- zh-TW: `市場快覽` / `市場快照：{time}`
- en: `Market Snapshot` / `As of {time}`
- vi-VN: `Tổng quan thị trường` / `Cập nhật lúc {time}`

Instrument localized display names：

| key | zh-TW | en | vi-VN |
|---|---|---|---|
| `sp500` | S&P 500 | S&P 500 | S&P 500 |
| `nasdaq` | NASDAQ | NASDAQ | NASDAQ |
| `usdtwd` | 美元 / 新台幣 | USD / TWD | USD / TWD |
| `brent` | 布蘭特原油 | Brent Oil | Dầu Brent |
| `gold` | 黃金 | Gold | Vàng |
| `us30y` | 美國 30 年期公債殖利率 | US 30Y Treasury Yield | Lợi suất TPCP Mỹ 30 năm |

`up/down/flat` machine enum 不變，顯示文字可 locale 化。

---

## 16. Source / verification localization

UI 可翻譯：

- `來源與驗證`
- `已驗證`
- `發布時間`
- `時間未確認`

不可翻/改：

- source URL
- publisher domain
- source class machine enum
- cutoff status machine enum

不要把 `PRIMARY` 顯示成「100% 真實」。它代表來源層級，不代表絕對真實性。

---

## 17. Accessibility / layout

Claude 實作時必須考慮字串膨脹：

- English / Vietnamese 可能比中文長 30–80%
- 不要用固定 width 讓 nav/卡片截字
- buttons 可 wrap
- mobile 375px 必測
- `lang` 正確設定有助 screen reader
- locale selector 可鍵盤操作

目前視覺方向：柔和、插畫感、pastel、水彩、rounded cards。多語系不可趁機大改 UI style。

---

## 18. SEO / static Pages

Phase 1 不要求三套獨立 HTML route。

可先使用 client-side locale + query param。

但應更新：

- document title
- meta description
- `<html lang>`

未來若 SEO 成為需求，再考慮 `/en/`, `/vi/` pre-render。

---

## 19. Translation quality / Safety Gate

內容翻譯不可改變：

- 主體是誰
- 數字
- 日期
- 否定詞
- source attribution
- uncertainty
- `confirmed` / `unverified` 的程度

尤其軍事、金融、政策事件，禁止為求流暢自行補充原文不存在的因果。

建議建立 glossary + regression fixture，測試：

- 數字 preservation
- proper noun preservation
- source class preservation
- no missing localization keys
- fallback works

---

## 20. 無 LLM API 情況

目前 default runtime 不需要 OpenAI API。

因此 Claude 不得假設每天一定能呼叫 LLM 產出 en / vi-VN intelligence content。

Phase 1 最低可接受交付：

1. UI i18n 完整。
2. localization schema/loader/fallback 完整。
3. canonical report 保持 zh-TW。
4. en/vi localized content 若不存在，安全 fallback zh-TW。
5. translator interface / build hook 可插拔，但 disabled by default。

未來可接：

```text
TranslatorProvider
├── manual/prebuilt
├── OpenAI optional
├── Anthropic optional
├── Gemini optional
└── other translation API
```

不要把某一家 LLM 寫死成 core dependency。

---

## 21. 建議實作順序

### Phase 1A — UI i18n

- 建 `locales/*.json`
- `t(key, params)`
- locale resolver
- language switcher
- URL/localStorage persistence
- date/number formatters
- remove hard-coded UI strings

### Phase 1B — Content localization contract

- canonical/localized overlay schema
- loader + fallback
- localized signal lookup by ID
- localized market labels

### Phase 1C — QA

- key parity test
- locale fallback test
- desktop/mobile visual check
- no machine contract mutations
- full Python validators unchanged/pass

### Phase 1D — Optional translator adapter

Only after A–C pass.

---

## 22. Do Not Change

除非另有明確需求，不要：

- 改 Tavily source strategy
- 改 06:00 cutoff
- 改 source authority policy
- 改 Top 5 validator
- 改 market provider
- 引入大型前端 framework
- 引入 server/backend 只為了 i18n
- 把 GitHub Pages static-first 改掉
- 大改現有 pastel/watercolor UI

---

## 23. Acceptance Criteria

完成時必須滿足：

- [ ] zh-TW / en / vi-VN 可切換
- [ ] locale 保存且可分享 URL
- [ ] current route 不因切換語言消失
- [ ] UI 無明顯 hard-coded 中文殘留（machine/brand/source exceptions 除外）
- [ ] `<html lang>` / title / meta description 更新
- [ ] source URL / ID / score / timestamp / enum 未被翻譯器改寫
- [ ] localized content 缺失時 fallback zh-TW，不白屏
- [ ] market snapshot 有 locale label 且 as-of 語意清楚
- [ ] desktop + mobile 無文字爆版
- [ ] Python regression tests PASS
- [ ] `scripts/validate_report.py data/latest.json` PASS
- [ ] 不新增必要 API key

---

## 24. Claude 完成後交付格式

回報：

1. 修改檔案清單
2. i18n 架構
3. locale fallback 行為
4. 三語 screenshots / visual verification 結果
5. automated tests 結果
6. 尚未做的 content translator 部分
7. 是否新增 dependency
8. residual risks

不要只回覆「完成翻譯」。
