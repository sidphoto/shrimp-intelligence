# SharBo Globo Data and Source Intelligence Policy

This repository distributes a **source-available software framework and synthetic demo data**. It does not distribute the SharBo production intelligence corpus.

## 1. Public repository data

Data committed to this public repository must be synthetic and intended only for development, contract testing and UI demonstration.

Public fixture URLs must use reserved demo destinations such as `example.invalid`. Public fixtures must not reproduce production article titles, article excerpts, source URLs, source registries, source weights, discovery queries or evidence bundles.

## 2. Production source intelligence is not distributed

The following are proprietary production assets and are intentionally excluded from this repository:

- production source registry and source graph;
- source allowlists, trust weights and priority configuration;
- verification-domain configuration;
- discovery and verification query strategy;
- raw retrieval results and candidate pools;
- evidence bundles and rejected-source records;
- production daily intelligence reports and historical corpus;
- production localized intelligence content;
- production market-source configuration and snapshots where retained as production data;
- credentials, tokens and deployment configuration.

Access to the public source code does not grant access or rights to these assets.

## 3. Third-party material

News articles, publisher content, market data, research, trademarks, websites and other third-party material remain subject to the rights and terms of their respective owners and providers.

Nothing in the software license purports to grant a license to third-party content or third-party databases.

## 4. SharBo-created software and metadata

Subject to the repository software license, the public edition may include SharBo-created software structures such as:

- schemas and public data contracts;
- generic source-class concepts;
- deterministic scoring, filtering, trend and impact-chain frameworks;
- localization framework;
- validators and tests;
- synthetic demonstration data.

The existence of a public schema does not imply disclosure of the production values used with that schema.

## 5. Contribution rule

Contributors must not submit real production source data or inferred copies of private SharBo source intelligence. Pull requests containing non-demo source URLs, article excerpts, credentials or production configuration may be rejected or removed.

## 6. Public website versus production service

The GitHub Pages build from this repository is a synthetic public demo. A SharBo production service may use a separate private data plane and deployment environment.

## 7. Historical disclosure note

Older repository history may have contained production-like source metadata before the current public/private boundary was established. The project is undertaking repository-history sanitization separately. Current policy prohibits new production source intelligence from being committed to the public tree.
