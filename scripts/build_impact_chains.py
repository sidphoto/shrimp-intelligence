from __future__ import annotations

import json
from pathlib import Path

from intelligence_rules import authoritative, label_for, matches_spec

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "impact_rules.json"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _confidence(anchor: dict, evidence_count: int) -> float:
    score = float(anchor.get("score") or 0)
    value = 0.45 + min(0.30, score / 300.0) + min(0.15, max(0, evidence_count - 1) * 0.05)
    if authoritative(anchor):
        value += 0.08
    return round(min(0.95, value), 2)


def _edge(from_id: str, to_id: str, relation: str, evidence_ids: list[str]) -> dict:
    edge = {"from": from_id, "to": to_id, "relation": relation}
    if evidence_ids:
        edge["evidence_signal_ids"] = evidence_ids
    return edge


def build_impact_chains(report: dict, config_path: Path = DEFAULT_CONFIG) -> dict:
    config = _load_json(config_path)
    max_chains = int(config.get("max_chains", 3))
    signals = report.get("signals") or []
    chains: list[dict] = []

    for rule in sorted(config.get("rules", []), key=lambda item: item.get("priority", 0), reverse=True):
        matched = [signal for signal in signals if matches_spec(signal, rule.get("trigger") or {})]
        if not matched:
            continue
        matched.sort(key=lambda signal: (signal.get("score", 0), authoritative(signal)), reverse=True)
        anchor = matched[0]
        evidence_ids = [signal.get("id") for signal in matched if signal.get("id")][:6]
        nodes = []
        for node in rule.get("nodes", []):
            nodes.append({
                "id": node["id"],
                "icon": node.get("icon", "•"),
                "type": node.get("type", "impact"),
                "label": label_for(node.get("labels", {}), "zh-TW"),
                "labels": node.get("labels", {}),
            })
        if len(nodes) < 2:
            continue

        edges = []
        for index in range(len(nodes) - 1):
            relation = "SUPPORTED" if index == 0 else "POTENTIAL"
            edges.append(_edge(nodes[index]["id"], nodes[index + 1]["id"], relation, evidence_ids if index == 0 else []))

        chains.append({
            "id": rule["id"],
            "title": label_for(rule.get("title", {}), "zh-TW"),
            "titles": rule.get("title", {}),
            "anchor_signal_id": anchor.get("id"),
            "anchor_score": anchor.get("score"),
            "confidence": _confidence(anchor, len(matched)),
            "evidence_signal_ids": evidence_ids,
            "nodes": nodes,
            "edges": edges,
            "policy": "Only the first edge is evidence-supported by matched signals; downstream edges are deterministic potential-transmission rules, not claims of observed causality.",
        })

    chains.sort(key=lambda item: (item["confidence"], item["anchor_score"] or 0), reverse=True)
    chains = chains[:max_chains]
    report["impact_chains"] = chains
    report["impact_meta"] = {
        "version": "m4.4-impact-v1",
        "chain_count": len(chains),
        "causality_policy": "SUPPORTED edges require matched evidence; POTENTIAL edges are explicitly scenario transmission rules.",
    }

    if chains:
        featured = chains[0]
        report["featured_impact_chain_id"] = featured["id"]
        report["impact_chain"] = [
            {
                "id": node["id"],
                "icon": node["icon"],
                "label": node["label"],
                "labels": node.get("labels", {}),
                "type": node.get("type"),
            }
            for node in featured["nodes"]
        ]
    else:
        report["featured_impact_chain_id"] = None
        report["impact_chain"] = []
    return report
