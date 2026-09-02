> [!NOTE]
> **Legacy repository:** active public development has moved to [sidphoto/sharbo-globo](https://github.com/sidphoto/sharbo-globo), the canonical public source-available repository.
>
> This repository is retained for historical reference. New issues, pull requests, and documentation should target the canonical repository.

# SharBo Globo｜蝦報全球

**Source Available · Free for Non-Commercial Use · Commercial License Available**

SharBo Globo 是一套來源優先、可解釋、具嚴格時間截止規則的全球情報雷達。本 repository 是 **Public Source-Available Edition**，用於展示前端、資料契約、deterministic intelligence framework、驗證器與合成 Demo。

> 本 repository **不包含** SharBo production source registry、真實來源清單、來源 URL corpus、驗證權重、discovery queries、production archive、market-provider configuration、credentials 或私有 deployment configuration。

## 版本分工

- **Public Demo / Source-Available Edition**：GitHub Pages，僅使用 synthetic data。
- **SharBo Globo Production**：正式情報服務，production data 與 source intelligence 在公開 GitHub 之外運作。

## 核心能力

- Today Dashboard / Global Top 5
- Global Radar 搜尋與篩選
- Signal Detail 與來源等級模型
- Emerging Signals 趨勢框架
- Deterministic Impact Chain
- Topic Drilldown / Global Focus
- My Radar 個人化篩選
- Quick Filter
- zh-TW / en / vi-VN UI
- Light / Night mode
- Responsive mobile navigation

## Source-first contract

公開版保留方法與 contract，而不公開 production source intelligence：

- `PRIMARY`
- `CONFIRMED`
- `ANALYSIS`
- `COMMUNITY`
- `UNVERIFIED`
- cutoff-safe timestamp validation
- Top 5 authority gate
- trend / impact-chain contract
- public repository leak gate

Public fixture URLs 必須使用 `https://example.invalid/...`。

## 本機預覽

```bash
python3 -m http.server 8080
```

開啟：

```text
http://localhost:8080/?lang=zh-TW#/today
```

公開 Demo 不需要 API Key。

## 驗證

```bash
python -m unittest discover -s tests -v
python scripts/validate_public_repo.py
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
node --check app.js
node --check i18n.js
```

任何 PR 若帶入 production source data、真實 production corpus 或 credentials，CI 應直接失敗。

## Licensing

本專案不是 OSI Open Source license。

Public source code 採 **PolyForm Noncommercial License 1.0.0**。個人、研究及其他授權允許的非商業使用依 `LICENSE` 辦理。

以下用途需要另行取得商業授權，包括但不限於：

- 商業 SaaS 或 hosted service
- 企業 production deployment
- 收費產品或付費會員服務
- 顧問代建或為客戶部署
- OEM / White-label
- 商業 API / data product
- 其他營利性整合或使用

詳見 `COMMERCIAL_LICENSE.md`。

## Brand & data rights

`SharBo Globo`、`蝦報全球`、相關 Logo 與品牌識別不隨 software license 授權，詳見 `TRADEMARKS.md`。

第三方新聞、媒體、market data 與其商標不因出現在 SharBo 產品中而成為本專案可再授權資產。詳見 `DATA_POLICY.md`。

## Contributing

請先閱讀：

- `CONTRIBUTING.md`
- `CLA.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`

Contribution 不得包含 production source names、source URLs、article excerpts、private registries、credentials 或其他 production intelligence material。

## Governance

目前採 maintainer-led governance。Roadmap 與 release policy 見 `GOVERNANCE.md`、`ROADMAP.md`。

## Public repository

GitHub：`sidphoto/shrimp-intelligence`

GitHub Pages 僅部署 synthetic public demo，不是 SharBo production data store。
