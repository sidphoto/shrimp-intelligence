# SharBo Globo｜蝦報全球 — Claude 多語系交接文件

Status: **current implementation handoff**  
Project phase: **M3 / M3.1 multilingual localization**  
Repository: `sidphoto/shrimp-intelligence`

---

## 1. 交接目的

Claude 接手時，**不要重新設計多語系架構**。

M3 UI i18n 與 M3.1 `zh-TW` 內容 overlay 已經實作並部署。接下來應在現有架構上完成：

- 三語內容在地化品質
- locale coverage
- fallback / stale overlay 防護
- responsive QA
- hard-coded 字串清理
- localized content contract 與 validator 強化

本階段**不預設、不要求、不新增任何 LLM 或翻譯 API**。

---

## 2. 產品定位

**SharBo Globo｜蝦報全球** 是 static-first 全球情報雷達，不是一般新聞聚合器。

核心情報流程：

```text
Tavily discovery
→ trusted-source verification
→ Source Registry
→ exact 06:00 cutoff
→ event clustering
→ deterministic ranking
→ reader-facing enrichment
→ validator
→ GitHub Pages
```

市場與新聞是兩條資料流：

```text
新聞情報：前一日 00:00 → 當日 06:00 Asia/Taipei
市場快覽：獨立 snapshot，自帶 captured_at / as_of
```

Localization 不得讓市場資料時間反向污染新聞 cutoff。

---

## 3. 絕對不可破壞

請先讀 `AGENTS.md`。

不得改變：

- 06:00 Asia/Taipei cutoff
- Top 5 authority gate
- PRIMARY / CONFIRMED / ANALYSIS / COMMUNITY / UNVERIFIED machine semantics
- Tavily discovery / verification 策略
- fail-closed publication behavior
- excluded topic 規則
- market/news separation
- canonical report validator
- GitHub Pages static-first 架構

若 localization 與 data integrity 衝突：

> **Data integrity wins.**

---

## 4. 已完成的 M3 架構

### 支援語系

| Locale | 顯示名稱 | 狀態 |
|---|---|---|
| `zh-TW` | 繁體中文 | 已上線，default |
| `en` | English | UI 已上線 |
| `vi-VN` | Tiếng Việt | UI 已上線 |

### UI dictionary

```text
locales/
├── zh-TW.json
├── en.json
└── vi-VN.json
```

三個 locale 必須保持 key parity。

### 核心前端

```text
i18n.js
app.js
i18n.css
```

`i18n.js` 已負責：

- supported locale
- locale alias normalization
- locale resolution
- dictionary loading
- `t(key)`
- URL persistence
- `<html lang>`
- title / meta description
- `Intl.DateTimeFormat`
- `Intl.NumberFormat`
- source/category/region/market labels
- localized content overlay loading
- localized content overlay applying

不要換 framework，也不要為 i18n 新增 backend。

---

## 5. Locale resolution 現行規則

順序：

```text
1. URL ?lang=
2. localStorage['sharbo:locale']
3. navigator.language
4. zh-TW
```

Aliases：

```text
zh / zh-TW / zh-Hant → zh-TW
en-US / en-GB → en
vi / vi-VN → vi-VN
```

分享網址：

```text
?lang=zh-TW#/today
?lang=en#/radar
?lang=vi-VN#/signal/<id>
```

切換語言時必須保留：

- hash route
- bookmarks
- My Radar preferences
- filters
- theme

---

## 6. UI i18n 與 Content Localization 必須分層

### A. UI i18n

適用：

- navigation
- buttons
- labels
- filters
- market labels
- source-class presentation labels
- severity labels
- empty/error states
- settings/archive text
- metadata
- date/number presentation

來源：`locales/*.json`

### B. Intelligence content localization

適用：

- `world_summary`
- `signal.title`
- `what_happened`
- `why_now`
- `why_important`
- `winners_losers`
- `taiwan_impact`
- `what_next`
- `emerging_reason`
- `quality_note`
- `taiwan_radar`

來源：`data/localized/<locale>/...`

不要把 intelligence content 塞進 UI dictionary。

---

## 7. Canonical report 與 localized overlay

Canonical data：

```text
data/latest.json
data/YYYY-MM-DD.json
```

Localized overlay：

```text
data/localized/
├── zh-TW/
│   └── YYYY-MM-DD.json
├── en/
│   └── YYYY-MM-DD.json
└── vi-VN/
    └── YYYY-MM-DD.json
```

目前：

```text
data/localized/zh-TW/2026-09-01.json
```

已覆蓋當期 15 個 signals 的：

- `title`
- `what_happened`

Top 5、今日重點、Radar、Signal Detail 共用同一份 localized signal object，因此**禁止各頁各自獨立翻譯**。

---

## 8. `zh-TW` 不再是 skip-overlay 例外

M3.1 已修正這個問題。

錯誤舊行為：

```text
zh-TW = DEFAULT_LOCALE
→ skip overlay
→ Reuters/AP 英文 title / content 直接露出
```

目前行為：

```text
selected locale
→ data/localized/<locale>/<report-date>.json
→ 有 overlay 就套用
→ 無 overlay 才 fallback canonical
```

所以 `zh-TW`、`en`、`vi-VN` 在 content layer 都是平等 locale。

**不要恢復 default locale skip overlay 的邏輯。**

---

## 9. Stale overlay 防護

Localized payload 應包含：

```json
{
  "locale": "zh-TW",
  "date": "2026-09-01"
}
```

如果 overlay `date` 與 canonical report date 不一致：

```text
禁止套用
```

目的：避免昨天的翻譯套到今天的新報告。

---

## 10. Canonical data 絕對不能被 localization 修改

以下欄位跨 locale 必須一致：

```text
id
date
generated_at
engine_version
window.start
window.end
window.timezone
score
source_class
categories[] machine slugs
regions[] machine slugs
sources[].class
sources[].url
sources[].published_at
sources[].cutoff_status
observed_at
window_verified
top5_ids
market numeric semantics
market/source URLs
```

也不要翻譯／改寫：

- URL
- domain
- ticker
- UUID / signal id
- API enum
- GitHub repo name
- model/product official identifier

---

## 11. Localizable signal fields

現行 validator 允許：

```text
title
what_happened
why_now
why_important
winners_losers
taiwan_impact
what_next
emerging_reason
quality_note
```

新增 localizable field 時：

1. 確認不是 machine/factual contract
2. 更新 `i18n.js`
3. 更新 `scripts/validate_i18n.py`
4. 增加 regression test
5. 不可只在前端偷偷接受

---

## 12. Translation / localization quality rule

Localization 不是逐字翻譯。

必須保持原事件：

- 主體
- 動作
- 數字
- 日期
- 否定詞
- attribution
- uncertainty
- confirmed / unverified 程度

禁止：

- 新增 canonical source 沒有的因果關係
- 把分析寫成已確認事實
- 把「可能」翻成「將會」
- 把 source relevance 當 credibility
- 把頁面導覽、cookie、Reuters Browse text 當正文翻譯

如果原始擷取內容混入頁面雜訊，可做 concise localized summary，但只能保留來源可確認的事實。

---

## 13. `zh-TW` 語氣

使用：

- 台灣繁體中文
- 台灣商業／政策／科技媒體常見用語
- 精簡情報摘要
- 自然 headline，不做英語語序直譯

例：

```text
software → 軟體
data → 資料
information → 資訊
network → 網路
semiconductor → 半導體
```

標題不要保留 source-language 英文只是因為 Reuters/AP 原文是英文。

例如：

```text
At Jackson Hole, global central bankers glimpse dystopian AI future
```

應呈現為自然台灣繁中，例如：

```text
全球央行官員在 Jackson Hole 正視 AI 可能帶來的「反烏托邦式」風險
```

來源名稱由 source UI 顯示，不需要每個 translated title 都硬加「－路透」。

---

## 14. English 語氣

English content 應是：

- concise intelligence brief
- natural headline style
- source-grounded
- 不帶中文句型

如果 canonical 英文乾淨，可保留；若 canonical 含擷取雜訊，應提供乾淨的 English overlay。

`en` 不等於「永遠直接顯示 canonical」。

---

## 15. `vi-VN` 語氣

越文要做真正的 vi-VN localization。

要求：

- 自然現代越南文
- 國際新聞／商業媒體語氣
- 保留重要官方名稱／公司名稱
- 政治、軍事避免過度情緒化
- 金融／半導體使用業界常用詞

Glossary baseline：

```text
供應鏈 → chuỗi cung ứng
半導體 → chất bán dẫn
人工智慧 → trí tuệ nhân tạo (AI)
中央銀行 → ngân hàng trung ương
地緣政治 → địa chính trị
```

建議 UI：

```text
Taiwan impact → Tác động đối với Đài Loan
Why it matters → Vì sao điều này quan trọng
What next → Cần theo dõi gì tiếp theo
```

---

## 16. Brand

正式品牌：

```text
SharBo Globo｜蝦報全球
```

`SharBo Globo` 不翻譯。

Subtitle：

```text
zh-TW: 全球情報雷達
en: Global Intelligence Radar
vi-VN: Radar thông tin toàn cầu
```

不要恢復 `Shrimp Intelligence` 作為前台正式品牌。

---

## 17. 市場快覽 localization

市場數值不是翻譯內容。

只翻 presentation label，不改 value/change numeric semantics。

| instrument | zh-TW | en | vi-VN |
|---|---|---|---|
| S&P 500 | S&P 500 | S&P 500 | S&P 500 |
| NASDAQ | NASDAQ | NASDAQ | NASDAQ |
| USD / TWD | 美元 / 新台幣 | USD / TWD | USD / TWD |
| Brent Oil | 布蘭特原油 | Brent Oil | Dầu Brent |
| Gold | 黃金 | Gold | Vàng |
| US 30Y | 美國 30 年期公債殖利率 | US 30Y Treasury Yield | Lợi suất TPCP Mỹ 30 năm |

必須保留 `as_of` / captured context。

---

## 18. Source class presentation

Machine enum 不變：

```text
PRIMARY
CONFIRMED
ANALYSIS
COMMUNITY
UNVERIFIED
```

顯示文字可以 localize。

不要把 `PRIMARY` 翻成「100% 真實」。

---

## 19. 現在最重要的已知缺口

目前 UI 三語已完成，但**內容 overlay coverage 還不是每日自動產生**。

現況：

```text
2026-09-01
zh-TW content overlay：已建立

en / vi-VN
UI dictionaries：已建立
content overlays：仍需依實際內容補齊／校對
```

本階段禁止預設 LLM / translation API，因此不要偷偷加入 runtime translator。

下一步應先把：

```text
localized artifact 規格
coverage
QA
fallback
```

做好。

---

## 20. Claude 下一階段工作

### Priority A — Content coverage audit

檢查所有 reader-facing surfaces：

```text
Top 5
Today focus event
Radar cards
Signal Detail
Emerging Signals
Business Transformation
Taiwan Radar
Archive-loaded reports
```

確保 selected locale 的內容都由同一 localized report/signal object 取得。

禁止某個頁面直接回頭使用未 localized 的 `state.baseReport`。

### Priority B — English / Vietnamese overlays

針對目前 report 建立／校對：

```text
data/localized/en/2026-09-01.json
data/localized/vi-VN/2026-09-01.json
```

至少覆蓋：

```text
world_summary
所有 Top 5 title
所有 Top 5 what_happened
所有可進入 detail view 的 signal title
所有 detail view 中仍為錯誤語系或擷取雜訊的主要文字
```

若可一次完成全 15 signals，優先於只做 Top 5。

### Priority C — Localization coverage validator

擴充 `scripts/validate_i18n.py`，可輸出：

```text
zh-TW: 15/15 signal titles localized
en: 15/15
vi-VN: 15/15
```

可區分：

```text
required launch fields
optional fields
```

在沒有自動 localization 生產流程前，不要擅自讓 canonical daily report 因翻譯缺失完全停止發布，除非 spec 另行要求。

### Priority D — Fallback UX

Fallback 必須存在，不能白屏。

但若 selected locale 缺 content：

- 顯示低干擾 fallback indicator
- 不假裝已完成 localization
- 避免沒有提示的一半中文、一半越文

### Priority E — Responsive QA

英文／越文字串可能比中文長 30–80%。

至少測：

```text
1440px
1024px
768px
375px
```

重點：

- Top 5 title
- Today focus card
- Signal Detail
- language selector
- market cards
- source labels
- filter chips
- mobile nav

---

## 21. 不要做

```text
❌ OpenAI API
❌ Anthropic API
❌ Gemini API
❌ Google Translate / DeepL API
❌ 把某一家 LLM 寫成 i18n core dependency
❌ localization backend
❌ 修改 Tavily
❌ 修改 06:00 cutoff
❌ 修改 Top 5 gate
❌ 修改 source authority policy
❌ 修改 market provider
❌ Vietnam Edition / Taiwan Edition
❌ 大改 UI 視覺
```

---

## 22. Localization Validator

現有：

```text
scripts/validate_i18n.py
```

目前檢查：

- locale key parity
- empty/non-string dictionary leaves
- legacy brand exposure
- localized overlay schema
- locale declaration
- canonical signal ID existence
- forbidden machine-field mutation
- localized field string type
- world_summary type
- taiwan_radar type

保留所有現有 gate。

若新增規則，必須補 regression test。

---

## 23. Acceptance Criteria

### UI

- [ ] `zh-TW / en / vi-VN` 三語 UI 正常
- [ ] locale 可保存
- [ ] URL 可分享 locale
- [ ] route/bookmark/filter/theme 不丟失
- [ ] `<html lang>` 正確
- [ ] title/meta 正確

### Content

- [ ] Top 5 跟 selected locale 一致
- [ ] 今日重點事件跟 selected locale 一致
- [ ] Radar cards 跟 selected locale 一致
- [ ] Signal Detail 跟 selected locale 一致
- [ ] `zh-TW` 不再露出未處理的 Reuters/AP 英文正文
- [ ] English / Vietnamese overlay coverage 有明確結果
- [ ] stale overlay 不會套到新日期
- [ ] fallback 不白屏

### Data integrity

- [ ] IDs 不變
- [ ] scores 不變
- [ ] source class 不變
- [ ] source URL 不變
- [ ] timestamps 不變
- [ ] cutoff status 不變
- [ ] top5_ids 不變
- [ ] market numeric semantics 不變

### QA

- [ ] 375px mobile 不爆版
- [ ] desktop 不爆版
- [ ] locale key parity PASS
- [ ] overlay validator PASS
- [ ] report validator PASS
- [ ] regression tests PASS

---

## 24. 必跑測試

```bash
node --check i18n.js
node --check app.js
python -m unittest discover -s tests -v
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
```

修改 JSON 時另跑：

```bash
python -m json.tool <file>
```

---

## 25. 完成後回報格式

不要只回「多語系完成」。

請提供：

1. 修改檔案清單
2. 哪些 reader-facing surfaces 已 locale-aware
3. `zh-TW / en / vi-VN` content coverage
4. fallback 行為
5. stale-overlay 防護狀態
6. canonical machine field 是否完全未修改
7. desktop/mobile QA
8. automated tests
9. 尚未 localization 的內容
10. residual risks

---

## 26. 最重要原則

SharBo 多語系的目標不是：

```text
把按鈕翻成三種語言
```

而是：

```text
使用者選擇 locale
→ UI、Top 5、今日重點、Radar、Detail 都使用同一語言內容
→ source / score / timestamp / verification 仍是同一份 canonical fact
```

> **Presentation can localize. Facts cannot drift.**
