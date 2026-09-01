from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_HOSTS = {"example.invalid"}
PUBLIC_DATA = ROOT / "data"
PUBLIC_CONFIG = ROOT / "config" / "sources.json"
SENSITIVE_PATHS = [
    ROOT / "private",
    ROOT / "production",
    ROOT / "data" / "production",
    ROOT / "data" / "raw",
    ROOT / "data" / "candidates",
    ROOT / "data" / "evidence",
    ROOT / "config" / "sources.local.json",
    ROOT / "config" / "source-registry.local.json",
    ROOT / "config" / "verification-domains.local.json",
    ROOT / "config" / "source-weights.local.json",
    ROOT / "config" / "queries.local.json",
]
URL_RE = re.compile(r"https?://[^\s\"'<>]+")


def fail(message: str) -> None:
    raise SystemExit(f"PUBLIC REPO LEAK GATE FAILED: {message}")


def allowed_url(value: str, where: Path) -> None:
    host = (urlparse(value).hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        fail(f"non-demo URL in {where}: host={host or '<missing>'}")


def walk_json(value, where: Path, key: str = "") -> None:
    if isinstance(value, dict):
        for child_key, child in value.items():
            walk_json(child, where, child_key)
        return
    if isinstance(value, list):
        for child in value:
            walk_json(child, where, key)
        return
    if isinstance(value, str):
        if key in {"url", "source_url"} and value:
            allowed_url(value, where)
        if key in {"source_label", "source", "name"} and "source" in key.lower():
            lowered = value.lower()
            if not any(token in lowered for token in ("example", "synthetic", "demo")):
                fail(f"non-demo source label in {where}: {value!r}")


def validate_data() -> None:
    if not PUBLIC_DATA.exists():
        fail("data directory is missing")
    for path in sorted(PUBLIC_DATA.rglob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if path.name == "index.json":
            text = json.dumps(payload, ensure_ascii=False).lower()
            if "synthetic" not in text and "demo" not in text:
                fail("public archive index is not explicitly synthetic/demo")
        elif path.name == "market-live.json":
            if payload.get("kind") != "demo_market_snapshot":
                fail("market-live.json must be a demo fixture in the public repository")
        else:
            if not isinstance(payload, dict) or payload.get("demo") is not True:
                fail(f"public report must declare demo=true: {path}")
        walk_json(payload, path)
        for match in URL_RE.findall(path.read_text(encoding="utf-8")):
            allowed_url(match.rstrip(".,);]"), path)


def validate_source_schema() -> None:
    payload = json.loads(PUBLIC_CONFIG.read_text(encoding="utf-8"))
    if payload.get("mode") != "public-demo":
        fail("config/sources.json must be public-demo only")
    for sector in (payload.get("sectors") or {}).values():
        for domain in sector.get("allowed_domains") or []:
            if domain not in ALLOWED_HOSTS:
                fail(f"production-like source domain in public config: {domain}")


def validate_workflows() -> None:
    workflows = ROOT / ".github" / "workflows"
    forbidden = (
        "run_daily_radar.py",
        "TAVILY_API_KEY",
        "market_live.py",
        "market_snapshot.py",
        "git add data/",
    )
    for path in workflows.glob("*.yml"):
        text = path.read_text(encoding="utf-8")
        for token in forbidden:
            if token in text:
                fail(f"production workflow token {token!r} found in {path}")


def main() -> int:
    for path in SENSITIVE_PATHS:
        if path.exists():
            fail(f"production-only path exists in public tree: {path.relative_to(ROOT)}")
    validate_source_schema()
    validate_data()
    validate_workflows()
    print("public repository leak gate PASS: demo-only data and source metadata")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
