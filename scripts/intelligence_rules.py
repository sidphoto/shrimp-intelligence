from __future__ import annotations

import re
from urllib.parse import urlparse


def text_blob(signal: dict) -> str:
    values = [
        signal.get("title", ""),
        signal.get("what_happened", ""),
        signal.get("why_now", ""),
        signal.get("why_important", ""),
        signal.get("source_label", ""),
        " ".join(signal.get("categories") or []),
        " ".join(signal.get("regions") or []),
    ]
    return " ".join(str(value) for value in values if value).lower()


def _contains(text: str, term: str) -> bool:
    term = str(term or "").strip().lower()
    if not term:
        return False
    if term.isascii() and len(term) <= 4 and " " not in term:
        return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text) is not None
    return term in text


def matches_spec(signal: dict, spec: dict) -> bool:
    text = text_blob(signal)
    if any(_contains(text, term) for term in (spec.get("any_phrases") or [])):
        return True
    groups = spec.get("all_groups") or []
    if groups:
        return all(any(_contains(text, term) for term in group) for group in groups)
    return False


def source_domain(source: dict) -> str:
    url = source.get("url") or ""
    try:
        return (urlparse(url).hostname or source.get("name") or "").lower()
    except Exception:
        return str(source.get("name") or "").lower()


def authoritative(signal: dict) -> bool:
    if signal.get("source_class") in {"PRIMARY", "CONFIRMED"}:
        return True
    return any(src.get("class") in {"PRIMARY", "CONFIRMED"} for src in signal.get("sources") or [])


def label_for(labels: dict, locale: str = "zh-TW") -> str:
    return labels.get(locale) or labels.get("zh-TW") or labels.get("en") or next(iter(labels.values()), "")
