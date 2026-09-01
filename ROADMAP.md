# SharBo Globo Public Roadmap

This roadmap covers the source-available public edition and the separation of proprietary production intelligence.

## OS-0 — Current-tree data isolation ✅

- synthetic public demo data only;
- production daily workflow removed from public repository;
- production source registry content removed from current tree;
- production collector/provider implementations removed from current tree;
- public leak gate added;
- GitHub Pages converted to demo-only deployment.

## OS-1 — Repository history sanitization

- rewrite Git history to remove previously committed production report/source material;
- review branches and tags;
- review Releases and Actions artifacts;
- invalidate or remove cached sensitive artifacts where possible;
- verify a fresh clone contains no reachable production source corpus.

This step requires repository-history rewrite/admin operations and is tracked separately from current-tree cleanup.

## OS-2 — Source-available licensing and governance

- PolyForm Noncommercial 1.0.0 public license;
- separate commercial licensing policy;
- trademark policy;
- data/source-intelligence policy;
- contributor license agreement;
- contribution, security and governance documentation.

## OS-3 — Public developer experience

- polished synthetic demo dataset;
- documented public data contracts;
- generic extension interfaces without production source configuration;
- improved accessibility and localization contribution guides;
- deterministic demo generation and regression fixtures.

## OS-4 — Public CI hardening

- source-data leak gate;
- secret scanning integration;
- dependency review;
- minimal GitHub Actions permissions;
- pinned third-party Actions where practical;
- branch protection / rulesets.

## OS-5 — Private production separation

- private production source registry;
- private retrieval/verification implementation and configuration;
- private production corpus and archives;
- separate production hosting/data plane;
- presentation-data sanitizer between internal evidence and browser output.

## OS-6 — Source-available preview release

Target: `v0.5.0-source-available-preview`

Release only after OS-1 through OS-5 release gates are satisfied.

## Later

Potential public framework work includes additional locales, stronger accessibility, generic provider interfaces, deterministic explainability tooling and improved plugin boundaries. Inclusion in this roadmap does not commit the proprietary production source intelligence to public release.
