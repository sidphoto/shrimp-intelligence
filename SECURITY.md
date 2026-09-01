# Security Policy

## Supported version

Security fixes are applied to the current `main` branch of the public source-available repository unless otherwise announced.

## Please do not disclose sensitive issues publicly

Do not open a public issue containing:

- credentials, tokens or secrets;
- a reproducible path to secret extraction;
- private production source intelligence;
- production source registry or verification configuration;
- customer or private deployment information;
- source-data leakage that is not already public.

Use GitHub's private vulnerability reporting / Security Advisory mechanism when available. If that mechanism is unavailable, contact the repository owner privately through the contact method published on the owner's GitHub profile before publishing details.

## Security areas of interest

Relevant reports include:

- API key or GitHub Actions secret exposure;
- workflow injection or privilege escalation;
- malicious or untrusted JSON/URL handling;
- cross-site scripting or unsafe HTML rendering;
- dependency or supply-chain compromise;
- public-repository leak-gate bypass;
- accidental inclusion of private production source intelligence;
- unsafe deployment configuration.

## Source-data leakage is treated as a security issue

The public repository is intentionally demo-only. A change that causes real production source metadata, article content, production URLs, source registries, evidence bundles or credentials to enter the public repository should be treated as a security regression.

## Response expectations

The maintainer will attempt to acknowledge a valid private report, assess severity and coordinate remediation. Exact response times are not guaranteed by this community/public repository unless a separate commercial support agreement says otherwise.

## Scope distinction

This policy covers the public repository. Security terms for a commercial or privately hosted SharBo deployment may be governed by separate agreements.
