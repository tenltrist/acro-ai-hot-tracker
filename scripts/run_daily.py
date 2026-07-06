#!/usr/bin/env python3
"""Low-cost target-company news radar for the AI Hot Tracker MVP."""

from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"
REPORT_DIR = ROOT / "reports"
SEEN_PATH = DATA_DIR / "seen_urls.json"
LATEST_RUN_PATH = DATA_DIR / "latest_run.json"
API_DIR = ROOT / "api" / "public"


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "AIHotTrackerMVP/0.1"
)


@dataclass
class Candidate:
    company_id: str
    source_id: str
    source_label: str
    source_trust: str
    title: str
    url: str
    published: str = ""
    summary: str = ""
    score: int = 0
    tier: str = "archive"
    category: str = "uncategorized"
    reasons: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        normalized = normalize_url(self.url)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


class LinkExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self._active_href: str | None = None
        self._active_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attr_map = {k.lower(): v or "" for k, v in attrs}
        href = attr_map.get("href")
        if href:
            self._active_href = href
            self._active_text = []

    def handle_data(self, data: str) -> None:
        if self._active_href:
            self._active_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._active_href:
            text = clean_text(" ".join(self._active_text))
            self.links.append({"href": self._active_href, "text": text})
            self._active_href = None
            self._active_text = []


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    if "<" in value and ">" in value:
        parser = TextExtractor()
        parser.feed(value)
        value = " ".join(parser.parts)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    filtered = [
        (k, v)
        for k, v in query
        if not k.lower().startswith(("utm_", "srsltid", "fbclid", "gclid"))
    ]
    return urllib.parse.urlunsplit(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/"),
            urllib.parse.urlencode(filtered),
            "",
        )
    )


def parse_date(value: str) -> str:
    if not value:
        return ""
    try:
        parsed = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return clean_text(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone().date().isoformat()


def age_days(value: str) -> int | None:
    if not value:
        return None
    try:
        published = dt.date.fromisoformat(value[:10])
    except ValueError:
        return None
    return (dt.date.today() - published).days


def parse_rss(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    root = ET.fromstring(text)
    items: list[Candidate] = []
    for item in root.findall(".//item"):
        title = clean_text(item.findtext("title", ""))
        link = clean_text(item.findtext("link", ""))
        if not title or not link:
            continue
        items.append(
            Candidate(
                company_id=source["company_id"],
                source_id=source["id"],
                source_label=source["label"],
                source_trust=source.get("trust", "unknown"),
                title=title,
                url=link,
                published=parse_date(item.findtext("pubDate", "")),
                summary=clean_text(item.findtext("description", "")),
            )
        )
    return items


def parse_html_links(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    parser = LinkExtractor()
    parser.feed(text)
    base_url = source["url"]
    include_terms = [term.lower() for term in source.get("include_url_terms", [])]
    items: list[Candidate] = []
    for link in parser.links:
        absolute = urllib.parse.urljoin(base_url, link["href"])
        if include_terms and not any(term in absolute.lower() for term in include_terms):
            continue
        title = link["text"] or absolute
        if len(title) < 4:
            continue
        items.append(
            Candidate(
                company_id=source["company_id"],
                source_id=source["id"],
                source_label=source["label"],
                source_trust=source.get("trust", "unknown"),
                title=title,
                url=absolute,
            )
        )
    return items


def collect_candidates(sources: list[dict[str, Any]]) -> tuple[list[Candidate], list[str]]:
    candidates: list[Candidate] = []
    errors: list[str] = []
    for source in sources:
        try:
            if source["type"] == "rss":
                candidates.extend(parse_rss(source))
            elif source["type"] == "html_links":
                candidates.extend(parse_html_links(source))
            else:
                errors.append(f"{source['id']}: unsupported source type {source['type']}")
        except (urllib.error.URLError, TimeoutError, ET.ParseError, OSError) as exc:
            errors.append(f"{source['id']}: {exc}")
    return candidates, errors


def dedupe(candidates: list[Candidate]) -> list[Candidate]:
    seen: set[str] = set()
    unique: list[Candidate] = []
    for item in candidates:
        key = normalize_url(item.url)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def score_candidate(item: Candidate, company: dict[str, Any], max_age_days: int) -> Candidate:
    blob = f"{item.title} {item.summary} {item.url}".lower()
    score = 0
    reasons: list[str] = []

    alias_hits = [alias for alias in company["aliases"] if alias.lower() in blob]
    if alias_hits:
        score += 30
        reasons.append("公司别名命中: " + ", ".join(alias_hits[:3]))

    if item.source_trust == "owned":
        score += 10
        reasons.append("公司自有来源")

    topic_hits = [term for term in company["strategic_topics"] if term.lower() in blob]
    if topic_hits:
        score += min(30, 6 * len(topic_hits))
        reasons.append("战略主题命中: " + ", ".join(topic_hits[:5]))

    action_hits = [term for term in company["business_actions"] if term.lower() in blob]
    if action_hits:
        score += min(25, 8 * len(action_hits))
        reasons.append("业务动作命中: " + ", ".join(action_hits[:4]))

    noise_hits = [term for term in company["noise_terms"] if term.lower() in blob]
    if noise_hits:
        score -= 35
        reasons.append("噪音词命中: " + ", ".join(noise_hits[:3]))

    item_age = age_days(item.published)
    if item_age is not None and item_age > max_age_days:
        score = min(score, 25)
        reasons.append(f"超过默认时效窗口: {item_age} 天前")

    item.score = max(0, score)
    item.reasons = reasons or ["未命中强规则，默认归档"]
    item.category = classify_item(blob)
    item.tier = classify_tier(item.score, item.source_trust)
    return item


def classify_item(blob: str) -> str:
    category_terms = [
        ("partnership", ["collaboration", "partner", "mou", "agreement"]),
        ("product", ["launch", "release", "gmp-grade", "kit", "protein", "antibody"]),
        ("event", ["webinar", "conference", "exhibition", "summit", "event"]),
        ("regulatory", ["fda", "ema", "pmda", "regulatory", "clinical"]),
        ("finance", ["ipo", "buyback", "price target", "forecast", "tradingview"]),
        ("award", ["award", "recognition"]),
        ("market", ["japan", "日本", "global", "expansion"])
    ]
    for category, terms in category_terms:
        if any(term in blob for term in terms):
            return category
    return "company"


def classify_tier(score: int, trust: str) -> str:
    if score >= 80:
        return "immediate"
    if score >= 50:
        return "daily"
    if trust == "owned" and score >= 45:
        return "daily"
    return "archive"


def build_report(
    candidates: list[Candidate],
    errors: list[str],
    seen: dict[str, Any],
    company_lookup: dict[str, dict[str, Any]],
    max_age_days: int,
) -> str:
    today = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    new_items = [item for item in candidates if item.key not in seen]
    immediate = [item for item in new_items if item.tier == "immediate"]
    daily = [item for item in new_items if item.tier == "daily"]
    archive = [item for item in new_items if item.tier == "archive"]

    lines: list[str] = [
        f"# AI Hot Tracker 日报 - {today}",
        "",
        "## 本次结论",
        "",
        f"- 新候选：{len(new_items)} 条",
        f"- 即时提醒候选：{len(immediate)} 条",
        f"- 进入日报：{len(daily)} 条",
        f"- 归档不推送：{len(archive)} 条",
        "",
        f"机制说明：默认不实时推送，默认时效窗口为 {max_age_days} 天。只有 `immediate` 才适合接微信、邮件或 Slack 这类即时提醒；`daily` 进入每日简报；`archive` 只保留，不打扰。",
        "",
    ]

    lines.extend(render_section("即时提醒候选", immediate, company_lookup))
    lines.extend(render_section("今日简报", daily, company_lookup))
    lines.extend(render_section("归档 / 暂不推送", archive[:15], company_lookup))

    if errors:
        lines.extend(["", "## 抓取错误", ""])
        lines.extend(f"- {err}" for err in errors)

    lines.extend(
        [
            "",
            "## 下一步可确认",
            "",
            "1. 哪些分类需要即时推送，而不是只进日报？",
            "2. 休假前公司名单里，哪些公司是高优先级？",
            "3. 输出给谁看：自己、市场部、BD，还是老板看 dashboard？",
        ]
    )
    return "\n".join(lines) + "\n"


def build_dashboard_payload(
    candidates: list[Candidate],
    errors: list[str],
    seen: dict[str, Any],
    company_lookup: dict[str, dict[str, Any]],
    max_age_days: int,
) -> dict[str, Any]:
    new_items = [item for item in candidates if item.key not in seen]
    tiers = {
        "immediate": [item for item in new_items if item.tier == "immediate"],
        "daily": [item for item in new_items if item.tier == "daily"],
        "archive": [item for item in new_items if item.tier == "archive"],
    }
    categories: dict[str, int] = {}
    sources: dict[str, int] = {}
    for item in new_items:
        categories[item.category] = categories.get(item.category, 0) + 1
        sources[item.source_label] = sources.get(item.source_label, 0) + 1

    return {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "window_days": max_age_days,
        "summary": {
            "new_candidates": len(new_items),
            "immediate": len(tiers["immediate"]),
            "daily": len(tiers["daily"]),
            "archive": len(tiers["archive"]),
            "errors": len(errors),
            "companies": len({item.company_id for item in new_items}),
            "sources": len({item.source_id for item in new_items}),
        },
        "source_mix": sources,
        "category_mix": categories,
        "companies": [
            {
                "id": company["id"],
                "display_name": company["display_name"],
                "markets": company.get("markets", []),
                "strategic_topics": company.get("strategic_topics", []),
            }
            for company in company_lookup.values()
        ],
        "items": [
            {
                "id": item.key,
                "company_id": item.company_id,
                "company": company_lookup[item.company_id]["display_name"],
                "source_id": item.source_id,
                "source_label": item.source_label,
                "source_trust": item.source_trust,
                "title": item.title,
                "url": item.url,
                "published": item.published,
                "summary": item.summary,
                "score": item.score,
                "tier": item.tier,
                "category": item.category,
                "reasons": item.reasons,
                "age_days": age_days(item.published),
            }
            for item in sorted(new_items, key=lambda x: (x.tier != "immediate", -x.score))
        ],
        "errors": errors,
        "market_brief": {
            "audience": "ACRO marketing team and leadership dashboard",
            "scope": "Target-company, competitor, and field-level signals",
            "recommended_next_actions": [
                "把目标公司名单导入 companies.json，并为每家公司配置官网和 Google News RSS。",
                "把竞品和产品线关键词拆成独立主题，例如 ADC、CGT、GMP、organoid、HEK293。",
                "先用日报验证噪音过滤，再决定哪些类别需要即时提醒。",
            ],
        },
    }


def write_static_api(payload: dict[str, Any]) -> None:
    API_DIR.mkdir(parents=True, exist_ok=True)
    save_json(API_DIR / "items.json", payload["items"])
    save_json(API_DIR / "daily.json", {
        "generated_at": payload["generated_at"],
        "window_days": payload["window_days"],
        "summary": payload["summary"],
        "selected": [item for item in payload["items"] if item["tier"] in {"immediate", "daily"}],
    })
    save_json(API_DIR / "topics.json", {
        "generated_at": payload["generated_at"],
        "category_mix": payload["category_mix"],
        "source_mix": payload["source_mix"],
        "companies": payload["companies"],
    })


def render_section(
    title: str,
    items: list[Candidate],
    company_lookup: dict[str, dict[str, Any]],
) -> list[str]:
    lines = ["", f"## {title}", ""]
    if not items:
        lines.append("暂无。")
        return lines

    for idx, item in enumerate(sorted(items, key=lambda x: x.score, reverse=True), start=1):
        company = company_lookup[item.company_id]["display_name"]
        date_suffix = f" | {item.published}" if item.published else ""
        lines.extend(
            [
                f"{idx}. [{item.title}]({item.url})",
                f"   - 公司：{company}",
                f"   - 来源：{item.source_label}{date_suffix}",
                f"   - 分数 / 分层：{item.score} / `{item.tier}`",
                f"   - 分类：`{item.category}`",
                f"   - 理由：{'; '.join(item.reasons)}",
            ]
        )
        if item.summary:
            lines.append(f"   - 摘要：{clean_text(item.summary)[:220]}")
        lines.append("")
    return lines


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Do not update seen state.")
    parser.add_argument("--days", type=int, default=45, help="Recency window for daily push candidates.")
    parser.add_argument("--strict-errors", action="store_true", help="Exit non-zero when any source fails.")
    args = parser.parse_args()

    companies = load_json(CONFIG_DIR / "companies.json")["companies"]
    sources = load_json(CONFIG_DIR / "sources.json")["sources"]
    company_lookup = {company["id"]: company for company in companies}
    seen = load_json(SEEN_PATH) if SEEN_PATH.exists() else {}

    candidates, errors = collect_candidates(sources)
    candidates = dedupe(candidates)
    scored = [
        score_candidate(item, company_lookup[item.company_id], args.days)
        for item in candidates
        if item.company_id in company_lookup
    ]

    report = build_report(scored, errors, seen, company_lookup, args.days)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORT_DIR / f"daily-{dt.date.today().isoformat()}.md"
    out_path.write_text(report, encoding="utf-8")
    payload = build_dashboard_payload(scored, errors, seen, company_lookup, args.days)
    save_json(LATEST_RUN_PATH, payload)
    write_static_api(payload)

    if not args.dry_run:
        for item in scored:
            seen.setdefault(
                item.key,
                {
                    "first_seen": dt.datetime.now().isoformat(timespec="seconds"),
                    "title": item.title,
                    "url": normalize_url(item.url),
                    "company_id": item.company_id,
                    "tier": item.tier,
                    "score": item.score,
                },
            )
        save_json(SEEN_PATH, seen)

    print(out_path)
    print(f"candidates={len(candidates)} errors={len(errors)} dry_run={args.dry_run}")
    return 2 if args.strict_errors and errors else 0


if __name__ == "__main__":
    sys.exit(main())
