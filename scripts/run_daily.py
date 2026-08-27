#!/usr/bin/env python3
"""Low-cost target-company news radar for the AI Hot Tracker MVP."""

from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import time
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
SOURCE_SNAPSHOTS_PATH = DATA_DIR / "source_snapshots.json"
API_DIR = ROOT / "api" / "public"
PRIORITY_ACCOUNT_MONITORING_PATH = CONFIG_DIR / "priority_account_monitoring.json"


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "AIHotTrackerMVP/0.2 (+https://github.com/tenltrist/acro-ai-hot-tracker)"
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
    category_hint: str = ""
    signal_type: str = "news"
    reasons: list[str] = field(default_factory=list)
    source_ids: list[str] = field(default_factory=list)
    source_labels: list[str] = field(default_factory=list)
    related_urls: list[str] = field(default_factory=list)
    matched_company_ids: list[str] = field(default_factory=list)
    intelligence: dict[str, list[str]] = field(default_factory=dict)
    acro_relevance: dict[str, Any] = field(default_factory=dict)
    recommended_action: dict[str, str] = field(default_factory=dict)
    business_event_type: str = "corporate_strategy"
    selection_reason: str = ""

    def __post_init__(self) -> None:
        if not self.source_ids:
            self.source_ids = [self.source_id]
        if not self.source_labels:
            self.source_labels = [self.source_label]
        if not self.related_urls:
            self.related_urls = [self.url]

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
        self._active_heading: list[str] = []
        self._active_time: list[str] = []
        self._active_image_alt: list[str] = []
        self._active_title_attr = ""
        self._inside_heading = False
        self._inside_time = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        lowered = tag.lower()
        attr_map = {k.lower(): v or "" for k, v in attrs}
        if lowered == "a":
            href = attr_map.get("href")
            if href:
                self._active_href = href
                self._active_text = []
                self._active_heading = []
                self._active_time = []
                self._active_image_alt = []
                self._active_title_attr = attr_map.get("title", "")
                self._inside_heading = False
                self._inside_time = False
            return
        if not self._active_href:
            return
        if lowered in {"h1", "h2", "h3", "h4"}:
            self._inside_heading = True
        elif lowered == "time":
            self._inside_time = True
            datetime_value = attr_map.get("datetime", "")
            if datetime_value:
                self._active_time.append(datetime_value)
        elif lowered == "img":
            alt = attr_map.get("alt", "")
            if alt:
                self._active_image_alt.append(alt)

    def handle_data(self, data: str) -> None:
        if self._active_href:
            self._active_text.append(data)
            if self._inside_heading:
                self._active_heading.append(data)
            if self._inside_time:
                self._active_time.append(data)

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in {"h1", "h2", "h3", "h4"}:
            self._inside_heading = False
        elif lowered == "time":
            self._inside_time = False
        elif lowered == "a" and self._active_href:
            text = clean_text(" ".join(self._active_text))
            self.links.append(
                {
                    "href": self._active_href,
                    "text": text,
                    "heading": clean_text(" ".join(self._active_heading)),
                    "time": clean_text(" ".join(self._active_time)),
                    "image_alt": clean_text(" ".join(self._active_image_alt)),
                    "title_attr": clean_text(self._active_title_attr),
                }
            )
            self._active_href = None
            self._active_text = []
            self._active_heading = []
            self._active_time = []
            self._active_image_alt = []
            self._active_title_attr = ""


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


def upsert_records(
    base: list[dict[str, Any]],
    additions: list[dict[str, Any]],
    key: str,
) -> list[dict[str, Any]]:
    """Merge configuration rows while preserving the base file's display order."""
    merged = [dict(row) for row in base]
    positions = {row.get(key): index for index, row in enumerate(merged)}
    for addition in additions:
        record_id = addition.get(key)
        if not record_id:
            raise ValueError(f"configuration row is missing {key}")
        if record_id in positions:
            merged[positions[record_id]] = dict(addition)
        else:
            positions[record_id] = len(merged)
            merged.append(dict(addition))
    return merged


def normalize_priority_source(source: dict[str, Any]) -> dict[str, Any]:
    """Turn a readable priority-account source spec into a runtime source row."""
    normalized = {
        key: value
        for key, value in source.items()
        if not key.startswith("coverage_")
    }
    if normalized.get("type") != "google_news":
        return normalized

    query = str(normalized.pop("query", "")).strip()
    if not query:
        raise ValueError(f"{normalized.get('id', 'unknown')}: Google News query is empty")
    language = normalized.pop("language", "ja")
    region = normalized.pop("region", "JP")
    edition = normalized.pop("edition", f"{region}:{language}")
    normalized["type"] = "rss"
    normalized["url"] = (
        "https://news.google.com/rss/search?q="
        f"{urllib.parse.quote(query, safe='')}&hl={language}&gl={region}"
        f"&ceid={urllib.parse.quote(edition, safe=':')}"
    )
    return normalized


def build_priority_account_extension(
    config: dict[str, Any],
    slot_definitions: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Expand one account record into company, source and coverage runtime rows."""
    companies: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []
    profiles: list[dict[str, Any]] = []
    slot_ids = [slot["id"] for slot in slot_definitions]

    for account in config.get("accounts", []):
        company = dict(account.get("company", {}))
        company_id = company.get("id")
        if not company_id:
            raise ValueError("priority account is missing company.id")
        company["account_origin_id"] = account.get("account_id", "")
        company.setdefault("account_monitoring_stage", "priority_market_account")
        company.setdefault("relationship_status", "unverified")
        companies.append(company)

        slots = {
            slot_id: {
                "status": "pending",
                "mode": "none",
                "source_ids": [],
                "note": "该类来源尚未加入本轮重点账户测试。",
            }
            for slot_id in slot_ids
        }
        for raw_source in account.get("sources", []):
            normalized = normalize_priority_source(raw_source)
            if normalized.get("company_id") not in {None, "", company_id}:
                raise ValueError(
                    f"{normalized.get('id')}: source company does not match {company_id}"
                )
            normalized["company_id"] = company_id
            sources.append(normalized)
            for slot_id in raw_source.get("coverage_slots", []):
                if slot_id not in slots:
                    raise ValueError(
                        f"{raw_source.get('id')}: unknown coverage slot {slot_id}"
                    )
                slot = slots[slot_id]
                slot["source_ids"].append(normalized["id"])
                incoming_status = raw_source.get("coverage_status", "active")
                if slot["status"] == "pending" or incoming_status == "active":
                    slot["status"] = incoming_status
                incoming_mode = raw_source.get("coverage_mode", "dedicated")
                if slot["mode"] == "none":
                    slot["mode"] = incoming_mode
                elif slot["mode"] != incoming_mode:
                    slot["mode"] = "mixed"
                slot["note"] = raw_source.get(
                    "coverage_note",
                    normalized.get("health_note", "重点账户专属公开来源。"),
                )

        for slot_id, shared in account.get("shared_coverage", {}).items():
            if slot_id not in slots:
                raise ValueError(f"{company_id}: unknown shared coverage slot {slot_id}")
            slots[slot_id] = {
                "status": shared.get("status", "covered"),
                "mode": shared.get("mode", "shared"),
                "source_ids": list(shared.get("source_ids", [])),
                "note": shared.get("note", "由跨公司公开来源共享覆盖。"),
            }

        profiles.append({"company_id": company_id, "slots": slots})

    return companies, sources, profiles


def load_runtime_configuration() -> tuple[
    dict[str, Any],
    dict[str, Any],
    list[dict[str, Any]],
]:
    """Load the dashboard configuration, including generated account extensions."""
    company_config = load_json(CONFIG_DIR / "companies.json")
    coverage = load_json(CONFIG_DIR / "company_source_coverage.json")
    sources = load_json(CONFIG_DIR / "sources.json")["sources"]
    if not PRIORITY_ACCOUNT_MONITORING_PATH.exists():
        return company_config, coverage, sources

    extension_config = load_json(PRIORITY_ACCOUNT_MONITORING_PATH)
    extension_companies, extension_sources, extension_profiles = (
        build_priority_account_extension(
            extension_config,
            coverage.get("slot_definitions", []),
        )
    )
    company_config["companies"] = upsert_records(
        company_config.get("companies", []), extension_companies, "id"
    )
    sources = upsert_records(sources, extension_sources, "id")
    coverage["profiles"] = upsert_records(
        coverage.get("profiles", []), extension_profiles, "company_id"
    )
    coverage["priority_account_extension"] = {
        "version": extension_config.get("version", ""),
        "account_count": len(extension_companies),
        "source_count": len(extension_sources),
        "principle": extension_config.get("principle", ""),
    }
    return company_config, coverage, sources


def fetch_text(url: str, retry_http_codes: set[int] | None = None) -> str:
    retryable_codes = {429, 500, 502, 503, 504} | (retry_http_codes or set())
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code in retryable_codes and attempt < 2:
                retry_after = exc.headers.get("Retry-After", "")
                try:
                    delay = max(float(retry_after), attempt + 2)
                except ValueError:
                    delay = attempt + 2
                time.sleep(delay)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionResetError, OSError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise RuntimeError(f"unreachable retry state for {url}")


def resolve_ai_summary_config() -> tuple[dict[str, str], str]:
    """Resolve an explicitly enabled model provider without making a request."""
    provider = os.environ.get("AI_SUMMARY_PROVIDER", "").strip().lower()
    if not provider:
        if os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
    if provider not in {"openai", "anthropic"}:
        return {}, "Set AI_SUMMARY_PROVIDER to openai or anthropic."

    api_key_name = "OPENAI_API_KEY" if provider == "openai" else "ANTHROPIC_API_KEY"
    api_key = os.environ.get(api_key_name, "").strip()
    if not api_key:
        return {}, f"{api_key_name} is not set."

    model = os.environ.get("AI_SUMMARY_MODEL", "").strip()
    if not model:
        return {}, "AI_SUMMARY_MODEL is not set; choose a model explicitly to control cost."

    return {
        "provider": provider,
        "api_key": api_key,
        "model": model,
    }, ""


def response_error_message(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        detail = ""
        try:
            payload = json.loads(exc.read().decode("utf-8", errors="replace"))
            detail = clean_text(
                payload.get("error", {}).get("message", "")
                if isinstance(payload.get("error"), dict)
                else payload.get("error", "")
            )
        except (json.JSONDecodeError, AttributeError, OSError):
            detail = ""
        return f"HTTP {exc.code}{f': {detail[:180]}' if detail else ''}"
    return clean_text(str(exc))[:200] or exc.__class__.__name__


def extract_openai_response_text(result: dict[str, Any]) -> str:
    parts: list[str] = []
    for output in result.get("output", []):
        if output.get("type") != "message":
            continue
        for content in output.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                parts.append(content["text"])
    return clean_text(" ".join(parts))


def generate_ai_summary(
    item: Candidate,
    company_name: str,
    config: dict[str, str],
) -> tuple[str, str]:
    """Generate one business summary and return (text, error)."""

    prompt = (
        f"你是企业市场部的竞争情报分析助手。请用2-3句简洁的中文总结以下新闻，"
        f"并指出它对公司市场部的业务意义（产品宣传/竞品观察/日本市场/BD线索/内容选题）。"
        f"不需要重复标题。\n\n"
        f"公司：{company_name}\n"
        f"标题：{item.title}\n"
        f"来源：{item.source_label}\n"
        f"发布日期：{item.published or '未知'}\n"
        f"原文摘要：{item.summary[:500] if item.summary else '无'}\n"
        f"分类：{item.category}\n"
        f"分数：{item.score}\n"
    )

    try:
        if config["provider"] == "openai":
            endpoint = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
            body = {
                "model": config["model"],
                "input": prompt,
                "max_output_tokens": 320,
                "store": False,
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config['api_key']}",
            }
            url = f"{endpoint}/responses"
        else:
            endpoint = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
            body = {
                "model": config["model"],
                "max_tokens": 320,
                "messages": [{"role": "user", "content": prompt}],
            }
            headers = {
                "Content-Type": "application/json",
                "x-api-key": config["api_key"],
                "anthropic-version": os.environ.get("ANTHROPIC_VERSION", "2023-06-01"),
            }
            url = f"{endpoint}/v1/messages"
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        if config["provider"] == "openai":
            text = extract_openai_response_text(result)
        else:
            text = clean_text(" ".join(
                block.get("text", "")
                for block in result.get("content", [])
                if block.get("type") == "text"
            ))
        return (text, "") if text else ("", "Model response contained no text.")
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, KeyError) as exc:
        return "", response_error_message(exc)


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
        parsed = None
        cleaned = clean_text(value)
        for date_format in ("%b %d, %Y %I:%M%p", "%b %d, %Y %I:%M %p"):
            try:
                parsed = dt.datetime.strptime(cleaned, date_format)
                break
            except ValueError:
                continue
        if parsed is None:
            return cleaned
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone().date().isoformat()


def normalize_source_date(value: str) -> str:
    """Normalize ISO, YYYYMMDD, and API date variants to YYYY-MM-DD."""
    cleaned = clean_text(value)
    if not cleaned:
        return ""
    if re.fullmatch(r"\d{8}", cleaned):
        return f"{cleaned[:4]}-{cleaned[4:6]}-{cleaned[6:8]}"
    match = re.match(r"(\d{4})[/-](\d{2})[/-](\d{2})", cleaned)
    if match:
        return "-".join(match.groups())
    return parse_date(cleaned)


def parse_relative_date(value: str) -> str:
    cleaned = clean_text(value).lower()
    match = re.search(
        r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago",
        cleaned,
    )
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        days = {
            "second": 0,
            "minute": 0,
            "hour": 0,
            "day": amount,
            "week": amount * 7,
            "month": amount * 30,
            "year": amount * 365,
        }[unit]
    else:
        jp_match = re.search(
            r"(\d+)\s*(秒|分|時間|日|週間|か月|ヶ月|月|年)前",
            cleaned,
        )
        if not jp_match:
            return ""
        amount = int(jp_match.group(1))
        unit = jp_match.group(2)
        days = {
            "秒": 0,
            "分": 0,
            "時間": 0,
            "日": amount,
            "週間": amount * 7,
            "か月": amount * 30,
            "ヶ月": amount * 30,
            "月": amount * 30,
            "年": amount * 365,
        }[unit]
    return (dt.date.today() - dt.timedelta(days=days)).isoformat()


def extract_calendar_date(value: str) -> str:
    cleaned = clean_text(value)
    match = re.search(
        r"(?P<year>20\d{2})[./年-](?P<month>\d{1,2})[./月-](?P<day>\d{1,2})日?",
        cleaned,
    )
    if not match:
        return ""
    try:
        return dt.date(
            int(match.group("year")),
            int(match.group("month")),
            int(match.group("day")),
        ).isoformat()
    except ValueError:
        return ""


def parse_calendar_date(value: str) -> dt.date | None:
    if not value:
        return None
    match = re.match(r"^(20\d{2})-(\d{1,2})-(\d{1,2})", clean_text(value))
    if not match:
        return None
    try:
        return dt.date(*(int(part) for part in match.groups()))
    except ValueError:
        return None


def age_days(value: str) -> int | None:
    published = parse_calendar_date(value)
    return (dt.date.today() - published).days if published else None


def days_until(value: str) -> int | None:
    event_date = parse_calendar_date(value)
    return (event_date - dt.date.today()).days if event_date else None


def latest_calendar_value(values: list[str]) -> str:
    dated = [(parse_calendar_date(value), value) for value in values]
    valid = [(date, value) for date, value in dated if date]
    return max(valid, key=lambda row: row[0])[1] if valid else ""


HTML_NOISE_TITLES = {
    "skip to main content",
    "skip to content",
    "press releases",
    "news releases",
    "press release",
    "newsroom",
    "home",
    "back to top",
    "subscribe",
    "rss feed",
    "contact us",
    "about us",
    "news",
    "events",
    "webinars",
    "resources",
    "blog",
    "search",
    "menu",
    "close",
    "next",
    "previous",
    "load more",
    "view all",
    "read more",
    "learn more",
}


def is_html_noise(title: str) -> bool:
    cleaned = title.strip().lower()
    if cleaned in HTML_NOISE_TITLES:
        return True
    if len(cleaned) < 15:
        return True
    if re.fullmatch(r"20\d{2}[./-]\d{1,2}[./-]\d{1,2}(?:\s*\([^)]{1,3}\))?", cleaned):
        return True
    if cleaned.startswith(("share on", "follow us on", "cookie", "accept cookies")):
        return True
    return False


def extract_document_title(text: str) -> str:
    for tag in ("h1", "title"):
        match = re.search(
            rf"<{tag}\b[^>]*>(.*?)</{tag}>",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match:
            continue
        title = clean_text(match.group(1))
        if tag == "title":
            title = re.split(r"\s+[|｜]\s+", title, maxsplit=1)[0].strip()
        if title and not is_html_noise(title):
            return title
    return ""


def extract_meaningful_summary(raw_description: str, title: str) -> str:
    """Clean RSS description: strip HTML, remove title duplication, return first 2-3 sentences."""
    text = clean_text(raw_description)
    if not text:
        return ""

    # Remove common prefixes that just repeat the title
    title_clean = clean_text(title)
    if text.startswith(title_clean):
        text = text[len(title_clean):].strip()

    # Remove leading separators
    text = re.sub(r"^[\s\-\|\.]+", "", text).strip()

    # Truncate to reasonable length
    if len(text) > 300:
        # Try to break at sentence boundary
        truncated = text[:300]
        last_period = max(truncated.rfind("。"), truncated.rfind(". "), truncated.rfind("！"))
        if last_period > 100:
            text = text[: last_period + 1]
        else:
            text = truncated + "..."

    return text


def xml_node_text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return clean_text(" ".join(node.itertext()))


def parse_rss(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    root = ET.fromstring(text.lstrip())
    items: list[Candidate] = []
    for item in root.findall(".//item"):
        title = xml_node_text(item.find("title"))
        link = xml_node_text(item.find("link"))
        if not title or not link or is_html_noise(title):
            continue
        raw_desc = item.findtext("description", "")
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "unknown"),
            title=title,
            url=link,
            published=parse_date(item.findtext("pubDate", "")),
            summary=extract_meaningful_summary(raw_desc, title),
            category_hint=source.get("category_hint", ""),
            signal_type=source.get("signal_type", "news"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_atom(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    root = ET.fromstring(text.lstrip())
    atom = "{http://www.w3.org/2005/Atom}"
    media = "{http://search.yahoo.com/mrss/}"
    items: list[Candidate] = []
    for entry in root.findall(f"{atom}entry"):
        title = clean_text(entry.findtext(f"{atom}title", ""))
        link_node = entry.find(f"{atom}link")
        link = link_node.get("href", "") if link_node is not None else ""
        description = clean_text(entry.findtext(f"{media}group/{media}description", ""))
        if not title or not link or is_html_noise(title):
            continue
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "unknown"),
            title=title,
            url=link,
            published=normalize_source_date(entry.findtext(f"{atom}published", "")),
            summary=description[:300].rstrip(),
            category_hint=source.get("category_hint", ""),
            signal_type=source.get("signal_type", "video"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_youtube_channel(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    marker = "var ytInitialData = "
    marker_pos = text.find(marker)
    if marker_pos < 0:
        raise ValueError("YouTube channel payload not found")
    payload, _ = json.JSONDecoder().raw_decode(text[marker_pos + len(marker):])
    videos: list[dict[str, Any]] = []

    def collect_nodes(node: Any) -> None:
        if isinstance(node, dict):
            lockup = node.get("lockupViewModel")
            if (
                isinstance(lockup, dict)
                and lockup.get("contentType") == "LOCKUP_CONTENT_TYPE_VIDEO"
            ):
                videos.append(lockup)
            for value in node.values():
                collect_nodes(value)
        elif isinstance(node, list):
            for value in node:
                collect_nodes(value)

    collect_nodes(payload)
    items: list[Candidate] = []
    seen_video_ids: set[str] = set()
    for video in videos:
        video_id = clean_text(video.get("contentId", ""))
        metadata = video.get("metadata", {}).get("lockupMetadataViewModel", {})
        title = clean_text(metadata.get("title", {}).get("content", ""))
        if not video_id or video_id in seen_video_ids or not title or is_html_noise(title):
            continue
        seen_video_ids.add(video_id)
        metadata_rows = (
            metadata.get("metadata", {})
            .get("contentMetadataViewModel", {})
            .get("metadataRows", [])
        )
        metadata_parts = metadata_rows[0].get("metadataParts", []) if metadata_rows else []
        metadata_text = [
            clean_text(part.get("text", {}).get("content", ""))
            for part in metadata_parts
        ]
        relative_date = next(
            (
                value
                for value in metadata_text
                if re.search(r"\bago\b", value.lower()) or value.endswith("前")
            ),
            "",
        )
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "owned"),
            title=title,
            url=f"https://www.youtube.com/watch?v={video_id}",
            published=parse_relative_date(relative_date),
            summary="Official YouTube channel video. " + " · ".join(metadata_text),
            category_hint=source.get("category_hint", "video"),
            signal_type=source.get("signal_type", "video"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def sitemap_title(url: str) -> str:
    path = urllib.parse.urlsplit(url).path.rstrip("/")
    slug = path.rsplit("/", 1)[-1]
    title = re.sub(r"[-_]+", " ", urllib.parse.unquote(slug)).strip()
    return title or path


def parse_sitemap_urls(
    source: dict[str, Any],
    previous_snapshot: dict[str, Any],
) -> tuple[list[Candidate], dict[str, Any], dict[str, Any]]:
    text = fetch_text(source["url"])
    root = ET.fromstring(text.lstrip())
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    include_terms = [term.lower() for term in source.get("include_url_terms", [])]
    exclude_terms = [term.lower() for term in source.get("exclude_url_terms", [])]
    current_rows: list[tuple[str, str, str]] = []

    for url_node in root.findall("s:url", namespace):
        url = clean_text(url_node.findtext("s:loc", "", namespace))
        if not url:
            continue
        normalized = normalize_url(url)
        lowered = normalized.lower()
        if include_terms and not any(term in lowered for term in include_terms):
            continue
        if exclude_terms and any(term in lowered for term in exclude_terms):
            continue
        key = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
        last_modified = normalize_source_date(
            url_node.findtext("s:lastmod", "", namespace)
        )
        current_rows.append((key, normalized, last_modified))

    current_keys = {row[0] for row in current_rows}
    previous_keys = set(previous_snapshot.get("keys", []))
    initial_snapshot = not previous_keys
    added_keys = set() if initial_snapshot else current_keys - previous_keys
    items: list[Candidate] = []
    for key, url, last_modified in current_rows:
        if key not in added_keys:
            continue
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "owned"),
            title=f"{source.get('title_prefix', 'New official page')}: {sitemap_title(url)}",
            url=url,
            published=last_modified or dt.date.today().isoformat(),
            summary="New URL detected in the official sitemap.",
            category_hint=source.get("category_hint", "product"),
            signal_type=source.get("signal_type", "news"),
        )
        if source_allows_candidate(source, candidate):
            items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break

    captured_at = dt.datetime.now().isoformat(timespec="seconds")
    next_snapshot = {
        "captured_at": captured_at,
        "keys": sorted(current_keys),
    }
    runtime = {
        "snapshot_count": len(current_keys),
        "new_urls": len(added_keys),
        "initial_snapshot": initial_snapshot,
        "last_checked": captured_at,
    }
    return items, next_snapshot, runtime


def parse_sec_submissions(source: dict[str, Any]) -> list[Candidate]:
    data = json.loads(fetch_text(source["url"]))
    recent = data["filings"]["recent"]
    include_forms = set(source.get("include_forms", []))
    cik = str(data.get("cik", "")).lstrip("0")
    items: list[Candidate] = []
    for idx, form in enumerate(recent.get("form", [])):
        if include_forms and form not in include_forms:
            continue
        accession = recent["accessionNumber"][idx]
        primary_document = recent["primaryDocument"][idx]
        description = clean_text(recent.get("primaryDocDescription", [""] * len(recent["form"]))[idx])
        published = normalize_source_date(recent["filingDate"][idx])
        url = (
            f"https://www.sec.gov/Archives/edgar/data/{cik}/"
            f"{accession.replace('-', '')}/{primary_document}"
        )
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "regulator"),
            title=f"Thermo Fisher SEC filing: {form} - {published}",
            url=url,
            published=published,
            summary=f"SEC {form} filing. {description or primary_document}",
            category_hint=source.get("category_hint", "finance"),
            signal_type=source.get("signal_type", "filing"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_openfda(source: dict[str, Any]) -> list[Candidate]:
    # openFDA can return a transient 403 to shared CI runners. Retry this source
    # specifically without teaching every blocked website to retry forbidden pages.
    data = json.loads(fetch_text(source["url"], retry_http_codes={403}))
    items: list[Candidate] = []
    for result in data.get("results", []):
        firm = clean_text(result.get("recalling_firm", ""))
        product = clean_text(result.get("product_description", ""))
        recall_number = clean_text(result.get("recall_number", ""))
        published = normalize_source_date(
            result.get("report_date", "") or result.get("event_date_posted", "")
        )
        if not product or not recall_number:
            continue
        recall_query = urllib.parse.quote(f'recall_number:"{recall_number}"')
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "regulator"),
            title=f"FDA recall {recall_number}: {product[:150]}",
            url=f"https://api.fda.gov/device/enforcement.json?search={recall_query}",
            published=published,
            summary=(
                f"Recalling firm: {firm}. Status: {result.get('status', '')}. "
                f"Reason: {clean_text(result.get('reason_for_recall', ''))}"
            )[:300],
            category_hint=source.get("category_hint", "regulatory"),
            signal_type=source.get("signal_type", "regulatory"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_pubmed(source: dict[str, Any]) -> list[Candidate]:
    search_data = json.loads(fetch_text(source["url"]))
    ids = search_data.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []
    summary_url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
        f"?db=pubmed&id={','.join(ids)}&retmode=json"
    )
    summary_data = json.loads(fetch_text(summary_url)).get("result", {})
    items: list[Candidate] = []
    for uid in ids:
        record = summary_data.get(uid, {})
        title = clean_text(record.get("title", ""))
        if not title:
            continue
        published = normalize_source_date(
            record.get("sortpubdate", "") or record.get("epubdate", "") or record.get("pubdate", "")
        )
        journal = clean_text(record.get("fulljournalname", ""))
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "research"),
            title=title,
            url=f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
            published=published,
            summary=f"PubMed record associated with ACROBiosystems. Journal: {journal}",
            category_hint=source.get("category_hint", "research"),
            signal_type=source.get("signal_type", "research"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_crossref(source: dict[str, Any]) -> list[Candidate]:
    data = json.loads(fetch_text(source["url"]))
    items: list[Candidate] = []
    for record in data.get("message", {}).get("items", []):
        titles = record.get("title", [])
        title = clean_text(titles[0] if titles else "")
        doi = clean_text(record.get("DOI", ""))
        if not title or not doi:
            continue
        date_parts = record.get("published", {}).get("date-parts", [[]])
        parts = date_parts[0] if date_parts else []
        published = "-".join(str(value) for value in parts[:3])
        affiliations = sorted(
            {
                clean_text(affiliation.get("name", ""))
                for author in record.get("author", [])
                for affiliation in author.get("affiliation", [])
                if clean_text(affiliation.get("name", ""))
            }
        )
        container_titles = record.get("container-title", [])
        container = clean_text(container_titles[0] if container_titles else "")
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "research"),
            title=title,
            url=record.get("URL") or f"https://doi.org/{doi}",
            published=normalize_source_date(published),
            summary=(
                f"Crossref publication metadata. Affiliations: {'; '.join(affiliations)}. "
                f"Venue: {container or 'not supplied'}. DOI: {doi}"
            )[:600],
            category_hint=source.get("category_hint", "research"),
            signal_type=source.get("signal_type", "research"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_clinical_trials(source: dict[str, Any]) -> list[Candidate]:
    data = json.loads(fetch_text(source["url"]))
    items: list[Candidate] = []
    for study in data.get("studies", []):
        protocol = study.get("protocolSection", {})
        identification = protocol.get("identificationModule", {})
        sponsors = protocol.get("sponsorCollaboratorsModule", {})
        status = protocol.get("statusModule", {})
        conditions = protocol.get("conditionsModule", {})
        arms = protocol.get("armsInterventionsModule", {})
        nct_id = clean_text(identification.get("nctId", ""))
        title = clean_text(
            identification.get("briefTitle", "")
            or identification.get("officialTitle", "")
        )
        if not nct_id or not title:
            continue
        lead = clean_text(sponsors.get("leadSponsor", {}).get("name", ""))
        collaborators = [
            clean_text(row.get("name", ""))
            for row in sponsors.get("collaborators", [])
            if clean_text(row.get("name", ""))
        ]
        updated = (
            status.get("lastUpdatePostDateStruct", {}).get("date", "")
            or status.get("studyFirstPostDateStruct", {}).get("date", "")
        )
        condition_names = [clean_text(value) for value in conditions.get("conditions", [])]
        intervention_names = [
            clean_text(row.get("name", ""))
            for row in arms.get("interventions", [])
            if clean_text(row.get("name", ""))
        ]
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "regulator"),
            title=f"Clinical trial update {nct_id}: {title}",
            url=f"https://clinicaltrials.gov/study/{nct_id}",
            published=normalize_source_date(updated),
            summary=(
                f"Lead sponsor: {lead or 'not supplied'}. "
                f"Collaborators: {'; '.join(collaborators) or 'none supplied'}. "
                f"Status: {clean_text(status.get('overallStatus', ''))}. "
                f"Conditions: {'; '.join(condition_names[:5])}. "
                f"Interventions: {'; '.join(intervention_names[:5])}."
            )[:700],
            category_hint=source.get("category_hint", "regulatory"),
            signal_type=source.get("signal_type", "clinical_trial"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def source_allows_candidate(source: dict[str, Any], item: Candidate) -> bool:
    """Apply source-specific quality gates before global scoring."""
    blob = f"{item.title} {item.summary} {item.url}".lower()
    title = item.title.lower()
    include_terms = [term.lower() for term in source.get("include_text_terms", [])]
    exclude_terms = [term.lower() for term in source.get("exclude_text_terms", [])]
    include_title_terms = [term.lower() for term in source.get("include_title_terms", [])]
    exclude_title_terms = [term.lower() for term in source.get("exclude_title_terms", [])]

    if include_terms and not any(term in blob for term in include_terms):
        return False
    if exclude_terms and any(term in blob for term in exclude_terms):
        return False
    if include_title_terms and not any(term in title for term in include_title_terms):
        return False
    if exclude_title_terms and any(term in title for term in exclude_title_terms):
        return False
    if source.get("require_published") and not item.published:
        return False

    source_age_limit = source.get("max_age_days")
    item_age = age_days(item.published)
    if source_age_limit is not None and item_age is not None and item_age > source_age_limit:
        return False
    return True


def parse_html_links(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    parser = LinkExtractor()
    parser.feed(text)
    base_url = source["url"]
    include_terms = [term.lower() for term in source.get("include_url_terms", [])]
    exclude_terms = [term.lower() for term in source.get("exclude_url_terms", [])]
    rows_by_url: dict[str, dict[str, Any]] = {}
    detail_cache: dict[str, tuple[str, str]] = {}
    for link in parser.links:
        absolute = urllib.parse.urljoin(base_url, link["href"])
        lowered_url = absolute.lower()
        if include_terms and not any(term in lowered_url for term in include_terms):
            continue
        if exclude_terms and any(term in lowered_url for term in exclude_terms):
            continue
        title_candidates = [
            (4, link.get("heading", "")),
            (3, link.get("title_attr", "")),
            (2, link.get("image_alt", "")),
            (1, link.get("text", "")),
        ]
        quality, title = next(
            (
                (rank, value)
                for rank, value in title_candidates
                if value and not is_html_noise(value)
            ),
            (0, ""),
        )
        title = re.sub(r"^(?:icon\s+)+", "", title, flags=re.IGNORECASE)
        normalized = normalize_url(absolute)
        published = extract_calendar_date(link.get("time") or link.get("text", ""))
        if not title and source.get("follow_detail_titles"):
            if normalized not in detail_cache:
                if len(detail_cache) >= source.get("max_items", 1000):
                    continue
                detail_text = fetch_text(absolute)
                detail_cache[normalized] = (
                    extract_document_title(detail_text),
                    extract_calendar_date(clean_text(detail_text)),
                )
            title, detail_date = detail_cache[normalized]
            published = published or detail_date
            quality = 5
        if not title or is_html_noise(title):
            continue
        existing = rows_by_url.get(normalized)
        if (
            not existing
            or quality > existing["quality"]
            or (quality == existing["quality"] and len(title) > len(existing["title"]))
        ):
            rows_by_url[normalized] = {
                "title": title,
                "published": published or (existing or {}).get("published", ""),
                "quality": quality,
            }
        elif published and not existing.get("published"):
            existing["published"] = published

    items: list[Candidate] = []
    for absolute, row in rows_by_url.items():
        candidate = Candidate(
            company_id=source.get("company_id", ""),
            source_id=source["id"],
            source_label=source["label"],
            source_trust=source.get("trust", "unknown"),
            title=row["title"],
            url=absolute,
            published=row["published"],
            summary=source.get("item_summary", ""),
            category_hint=source.get("category_hint", ""),
            signal_type=source.get("signal_type", "news"),
        )
        if not source_allows_candidate(source, candidate):
            continue
        items.append(candidate)
        if len(items) >= source.get("max_items", 1000):
            break
    return items


def parse_json_announcements(source: dict[str, Any]) -> list[Candidate]:
    """Parse public announcement APIs whose rows contain an HTML link snippet."""
    payload = json.loads(fetch_text(source["url"]))
    rows = payload.get(source.get("items_key", "item"), [])
    if not isinstance(rows, list):
        raise ValueError("announcement payload items must be a list")

    base_url = source.get("base_url", source["url"])
    items: list[Candidate] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        parser = LinkExtractor()
        parser.feed(str(row.get(source.get("html_field", "contents"), "")))
        published = normalize_source_date(
            str(row.get(source.get("date_field", "anndate"), ""))
        )
        for link in parser.links:
            href = link.get("href", "")
            title = clean_text(
                link.get("heading")
                or link.get("title_attr")
                or link.get("text")
            )
            title = re.sub(
                r"\s*\(\d+(?:\.\d+)?\s*(?:KB|MB)\)\s*$",
                "",
                title,
                flags=re.IGNORECASE,
            )
            if not href or not title or is_html_noise(title):
                continue
            candidate = Candidate(
                company_id=source.get("company_id", ""),
                source_id=source["id"],
                source_label=source["label"],
                source_trust=source.get("trust", "unknown"),
                title=title,
                url=urllib.parse.urljoin(base_url, href),
                published=published,
                summary=source.get("item_summary", ""),
                category_hint=source.get("category_hint", ""),
                signal_type=source.get("signal_type", "news"),
            )
            if not source_allows_candidate(source, candidate):
                continue
            items.append(candidate)
            if len(items) >= source.get("max_items", 1000):
                return items
    return items


def collect_candidates(
    sources: list[dict[str, Any]],
    source_snapshots: dict[str, Any],
) -> tuple[list[Candidate], list[str], dict[str, Any], dict[str, Any]]:
    candidates: list[Candidate] = []
    errors: list[str] = []
    snapshot_updates: dict[str, Any] = {}
    source_runtime: dict[str, Any] = {}
    for source in sources:
        if source.get("enabled", True) is False:
            continue
        source_id = source["id"]
        runtime: dict[str, Any] = {
            "last_checked": dt.datetime.now().isoformat(timespec="seconds"),
        }
        source_runtime[source_id] = runtime
        candidate_count_before = len(candidates)
        try:
            if source["type"] == "rss":
                candidates.extend(parse_rss(source))
            elif source["type"] == "atom":
                candidates.extend(parse_atom(source))
            elif source["type"] == "youtube_channel":
                candidates.extend(parse_youtube_channel(source))
            elif source["type"] == "sitemap_urls":
                items, snapshot, runtime = parse_sitemap_urls(
                    source,
                    source_snapshots.get(source["id"], {}),
                )
                candidates.extend(items)
                snapshot_updates[source["id"]] = snapshot
                source_runtime[source_id].update(runtime)
            elif source["type"] == "sec_submissions":
                candidates.extend(parse_sec_submissions(source))
            elif source["type"] == "openfda":
                candidates.extend(parse_openfda(source))
            elif source["type"] == "pubmed":
                candidates.extend(parse_pubmed(source))
            elif source["type"] == "crossref":
                candidates.extend(parse_crossref(source))
            elif source["type"] == "clinical_trials":
                candidates.extend(parse_clinical_trials(source))
            elif source["type"] == "html_links":
                candidates.extend(parse_html_links(source))
            elif source["type"] == "json_announcements":
                candidates.extend(parse_json_announcements(source))
            else:
                errors.append(f"{source['id']}: unsupported source type {source['type']}")
        except (
            urllib.error.URLError,
            TimeoutError,
            ET.ParseError,
            OSError,
            json.JSONDecodeError,
            KeyError,
            ValueError,
        ) as exc:
            message = str(exc)
            errors.append(f"{source_id}: {message}")
            source_runtime[source_id]["error"] = message
        finally:
            source_runtime[source_id]["raw_candidate_count"] = (
                len(candidates) - candidate_count_before
            )
    return candidates, errors, snapshot_updates, source_runtime


def dedupe(candidates: list[Candidate]) -> list[Candidate]:
    unique: list[Candidate] = []
    url_index: dict[str, int] = {}
    title_index: dict[str, int] = {}
    for item in candidates:
        url_key = normalize_url(item.url)
        title_key = normalize_title(item.title)
        duplicate_index = url_index.get(url_key)
        if duplicate_index is None and len(title_key) >= 30:
            duplicate_index = title_index.get(title_key)
        if duplicate_index is not None:
            existing = unique[duplicate_index]
            if (
                item.company_id
                and item.company_id != existing.company_id
                and item.company_id not in existing.matched_company_ids
            ):
                existing.matched_company_ids.append(item.company_id)
            for source_id in item.source_ids:
                if source_id not in existing.source_ids:
                    existing.source_ids.append(source_id)
            for source_label in item.source_labels:
                if source_label not in existing.source_labels:
                    existing.source_labels.append(source_label)
            for related_url in item.related_urls:
                normalized_related = normalize_url(related_url)
                if all(normalize_url(value) != normalized_related for value in existing.related_urls):
                    existing.related_urls.append(related_url)
            if len(item.summary) > len(existing.summary):
                existing.summary = item.summary
            if not existing.published and item.published:
                existing.published = item.published
            continue
        index = len(unique)
        url_index[url_key] = index
        if len(title_key) >= 30:
            title_index[title_key] = index
        unique.append(item)
    return unique


def apply_source_tier_policy(
    item: Candidate,
    source_lookup: dict[str, dict[str, Any]],
) -> Candidate:
    contributing_sources = [
        source_lookup[source_id]
        for source_id in item.source_ids
        if source_id in source_lookup
    ]
    if (
        contributing_sources
        and all(source.get("archive_only", False) for source in contributing_sources)
        and item.tier != "archive"
    ):
        item.tier = "archive"
        item.selection_reason = "来源处于观察期，仅归档"
        item.reasons.append("试接观察源：当前只归档，不进日报")
    return item


def normalize_title(value: str) -> str:
    # Google News appends the publisher after the final " - ".
    headline = re.sub(r"\s+-\s+[^-]{2,80}$", "", clean_text(value))
    return re.sub(r"[^\w]+", "", headline, flags=re.UNICODE).lower()


def normalize_summary_text(value: str) -> str:
    return re.sub(r"[^\w一-鿿ぁ-んァ-ン]+", "", clean_text(value).lower())


def is_low_information_summary(summary: str, title: str) -> bool:
    summary_norm = normalize_summary_text(summary)
    title_norm = normalize_summary_text(re.sub(r"\s+-\s+[^-]{2,80}$", "", title))
    if not summary_norm:
        return True
    if summary_norm == title_norm:
        return True
    if title_norm and (summary_norm.startswith(title_norm) or title_norm.startswith(summary_norm)):
        return True
    return len(summary_norm) < 28


def first_sentence(value: str, max_chars: int = 120) -> str:
    text = clean_text(value)
    if not text:
        return ""
    text = re.sub(r"\s+-\s+[^-]{2,80}$", "", text).strip()
    parts = re.split(r"(?<=[。.!！？])\s+", text, maxsplit=1)
    text = parts[0].strip()
    if len(text) > max_chars:
        text = text[:max_chars].rstrip("，,、；;:： ") + "..."
    return text


def join_labels(values: list[str], limit: int = 3) -> str:
    labels = list(dict.fromkeys(value for value in values if value).keys())[:limit]
    return "、".join(labels)[:120] if labels else ""


def build_rule_summary(item: Candidate, matched_companies: list[dict[str, Any]]) -> str:
    """Create a low-cost business summary when no LLM summary is available."""
    roles = {company.get("business_role", "unclassified") for company in matched_companies}
    company_names = [company.get("display_name", "") for company in matched_companies if company.get("display_name")]
    subject = " / ".join(company_names[:2]) or "行业公开信号"
    intelligence = item.intelligence or {}
    focus = join_labels(
        [
            *(intelligence.get("targets") or []),
            *(intelligence.get("modalities") or []),
            *(intelligence.get("product_needs") or []),
        ],
        4,
    )
    action_label = item.recommended_action.get("label", "") if item.recommended_action else ""
    event_hint = {
        "product": "产品与平台动态",
        "event": "市场活动信息",
        "video": "视频或 Webinar 内容",
        "research": "技术与研究内容",
        "regulatory": "临床监管信号",
        "partnership": "合作或交易信号",
        "market": "市场与区域动态",
        "finance": "资本或业绩信号",
        "company": "公司战略与组织动态",
    }.get(item.category, "公开信息")

    if "self" in roles:
        opening = f"{subject}更新了{event_hint}"
    elif "competitor" in roles:
        opening = f"竞品 {subject} 出现{event_hint}"
    elif "customer" in roles:
        opening = f"客户池公司 {subject} 出现{event_hint}"
    elif item.signal_type == "event":
        opening = f"该来源捕捉到一条市场活动信号"
    else:
        opening = f"该来源捕捉到一条{event_hint}"

    if focus:
        opening += f"，重点涉及{focus}"
    opening += "。"

    raw_point = ""
    if item.summary and not is_low_information_summary(item.summary, item.title):
        raw_point = first_sentence(item.summary, 110)
        if raw_point:
            raw_point = f"原始摘要要点：{raw_point}。"

    relevance = item.acro_relevance.get("explanation", "") if item.acro_relevance else ""
    action = ""
    if item.recommended_action:
        action = f"建议按“{action_label or '归档观察'}”处理：{item.recommended_action.get('text', '')}"

    summary = clean_text(" ".join(part for part in [opening, raw_point, relevance, action] if part))
    if len(summary) > 280:
        summary = summary[:280].rstrip("，,、；;:： ") + "..."
    return summary


def match_candidate_companies(
    item: Candidate,
    company_lookup: dict[str, dict[str, Any]],
) -> Candidate:
    blob = f"{item.title} {item.summary}".lower()
    matches = [
        company_id
        for company_id in [item.company_id, *item.matched_company_ids]
        if company_id in company_lookup
    ]
    for company_id, company in company_lookup.items():
        if company_id not in matches and any(
            term_matches(blob, alias) for alias in company.get("aliases", [])
        ):
            matches.append(company_id)
    item.matched_company_ids = matches
    item.company_id = matches[0] if matches else ""
    return item


def merge_scoring_profiles(profiles: list[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "strategic_topics": [],
        "business_actions": [],
        "noise_terms": [],
    }
    for field_name in merged:
        for profile in profiles:
            for value in profile.get(field_name, []):
                if value not in merged[field_name]:
                    merged[field_name].append(value)
    return merged


def term_matches(text: str, alias: str) -> bool:
    term = clean_text(alias).lower()
    if not term:
        return False
    if re.fullmatch(r"[a-z0-9][a-z0-9 .+/-]*", term):
        return bool(re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text))
    return term in text


def extract_intelligence(
    item: Candidate,
    intelligence_rules: dict[str, Any],
) -> dict[str, list[str]]:
    blob = clean_text(f"{item.title} {item.summary}").lower()
    extracted: dict[str, list[str]] = {}
    for group_id, group in intelligence_rules.get("groups", {}).items():
        if group_id == "event_signals" and item.category != "event" and item.signal_type != "event":
            extracted[group_id] = []
            continue
        hits: list[str] = []
        for rule in group.get("items", []):
            if any(term_matches(blob, alias) for alias in rule.get("aliases", [])):
                hits.append(rule["label"])
        extracted[group_id] = hits
    return extracted


def build_acro_relevance(
    item: Candidate,
    matched_companies: list[dict[str, Any]],
) -> dict[str, Any]:
    roles = {company.get("business_role", "unclassified") for company in matched_companies}
    signals = item.intelligence
    score = 0
    reasons: list[str] = []

    if "self" in roles:
        score += 25
        reasons.append("ACRO 自身动态")
    if "customer" in roles:
        score += 30
        reasons.append("客户池公司动态")
    if "competitor" in roles:
        score += 18
        reasons.append("竞品公司动态")
    if signals.get("targets"):
        score += 12
        reasons.append("出现明确靶点")
    if signals.get("modalities"):
        score += 12
        reasons.append("命中重点疗法或技术")
    if signals.get("product_needs"):
        score += 22
        reasons.append("可映射到 ACRO 产品或服务需求")
    if signals.get("development_stages"):
        score += 10
        reasons.append("研发阶段可识别")
    if signals.get("business_actions"):
        score += 10
        reasons.append("出现明确业务动作")
    if signals.get("event_signals"):
        score += 6
        reasons.append("可转化为活动运营线索")
    if item.source_trust == "regulator" or item.category == "regulatory":
        score += 8
        reasons.append("包含监管或注册信号")

    score = min(score, 100)
    level = "high" if score >= 50 else "medium" if score >= 24 else "low"
    target_text = "、".join(signals.get("targets", [])[:2])
    modality_text = "、".join(signals.get("modalities", [])[:2])
    need_text = "、".join(signals.get("product_needs", [])[:2])
    stage_text = "、".join(signals.get("development_stages", [])[:1])

    if "self" in roles:
        explanation = "ACRO 自身公开动态，应核对对外口径并判断是否需要二次传播或内部同步。"
    elif "customer" in roles:
        explanation = f"客户池公司出现{stage_text or '新的研发'}信号，可评估{need_text or '相关试剂与服务'}需求。"
    elif "competitor" in roles:
        focus = "、".join(value for value in [modality_text, need_text] if value) or item.category
        explanation = f"竞品正在推进{focus}相关动作，值得对比产品定位、市场话术和区域覆盖。"
    elif need_text and (stage_text or signals.get("business_actions")):
        explanation = f"该信号涉及{stage_text or '业务推进'}，可能产生{need_text}需求，适合纳入潜在客户筛选。"
    elif signals.get("event_signals"):
        topic = "、".join(value for value in [target_text, modality_text] if value) or "生命科学"
        explanation = f"该活动聚焦{topic}，可评估参会、登台、赞助或合作伙伴接触价值。"
    elif target_text or modality_text:
        explanation = f"该信号命中{target_text or modality_text}，对技术趋势有参考价值，但尚未出现明确商业需求。"
    else:
        explanation = "当前未识别到明确的 ACRO 产品需求、客户动作或重点技术信号，建议保持归档。"

    return {
        "level": level,
        "score": score,
        "label": {"high": "高相关", "medium": "中相关", "low": "低相关"}[level],
        "explanation": explanation,
        "reasons": reasons[:4],
    }


def build_recommended_action(
    item: Candidate,
    matched_companies: list[dict[str, Any]],
) -> dict[str, str]:
    roles = {company.get("business_role", "unclassified") for company in matched_companies}
    signals = item.intelligence
    relevance = item.acro_relevance.get("level", "low")
    if "self" in roles:
        return {"type": "content", "label": "口径与传播跟进", "owner": "市场运营", "priority": "high", "text": "核对官网口径，判断是否转化为 LinkedIn、Newsletter 或销售内部素材。"}
    if "customer" in roles:
        return {"type": "customer", "label": "客户需求跟进", "owner": "BD / 销售", "priority": "high", "text": "调取客户档案和既有沟通记录，核对产品需求与跟进时机。"}
    if "competitor" in roles and relevance in {"high", "medium"}:
        return {"type": "competitor", "label": "竞品对比", "owner": "产品市场", "priority": relevance, "text": "对比竞品的产品、技术、合作和区域动作，评估是否需要调整话术或销售材料。"}
    if signals.get("product_needs") and (signals.get("development_stages") or signals.get("business_actions")):
        return {"type": "lead", "label": "潜客识别", "owner": "BD / 区域市场", "priority": relevance, "text": "确认公司主体、管线阶段与地区，匹配 ACRO 产品后决定是否纳入潜在客户池。"}
    if signals.get("event_signals"):
        return {"type": "event", "label": "活动价值评估", "owner": "区域市场", "priority": relevance, "text": "核对日期、参会公司和议题，评估报名、登台、赞助或 Partnering 价值。"}
    if item.source_trust == "regulator" or item.category == "regulatory":
        return {"type": "regulatory", "label": "法规影响核对", "owner": "产品 / 法规", "priority": relevance, "text": "核对原始监管文件、生效范围和相关产品，必要时同步产品与销售团队。"}
    if signals.get("targets") or signals.get("modalities"):
        return {"type": "trend", "label": "技术趋势观察", "owner": "产品市场", "priority": relevance, "text": "并入靶点与技术趋势统计，等待出现管线、合作或产品需求信号。"}
    return {"type": "archive", "label": "归档观察", "owner": "系统", "priority": "low", "text": "暂不发起业务动作，保留为后续趋势和公司档案证据。"}


def classify_business_event_type(
    item: Candidate,
    matched_companies: list[dict[str, Any]],
) -> str:
    intelligence = item.intelligence or {}
    actions = intelligence.get("business_actions") or []
    text = clean_text(f"{item.title} {item.summary}")
    roles = {company.get("business_role", "unclassified") for company in matched_companies}
    if re.search(r"\b(?:GMP|quality|supply chain|ISO 13485|ISO 17025|material suitability|raw material)\b|质量|供应链|原料合规", text, re.I):
        return "quality_supply"
    if item.recommended_action.get("type") == "lead":
        return "customer_demand"
    if item.category == "partnership" or any(
        action in {"合作 / 共同开发", "授权 / 引进", "并购 / 交易"}
        for action in actions
    ):
        return "partnership_deal"
    if (
        item.category == "regulatory"
        or intelligence.get("development_stages")
        or "临床里程碑" in actions
        or "注册 / 监管动作" in actions
    ):
        return "clinical_regulatory"
    if (
        item.signal_type == "event"
        or item.category in {"event", "video"}
        or intelligence.get("event_signals")
    ):
        return "market_activity"
    if item.category == "market" or "市场进入" in actions or "扩产 / 新设施" in actions:
        return "regional_expansion"
    if item.category == "product" or "产品发布" in actions:
        return "product_platform"
    if intelligence.get("targets") or intelligence.get("modalities") or item.category == "research":
        return "target_therapy"
    if intelligence.get("product_needs") and not roles:
        return "customer_demand"
    return "corporate_strategy"


def enrich_candidate_intelligence(
    item: Candidate,
    intelligence_rules: dict[str, Any],
    matched_companies: list[dict[str, Any]],
) -> Candidate:
    item.intelligence = extract_intelligence(item, intelligence_rules)
    item.acro_relevance = build_acro_relevance(item, matched_companies)
    item.recommended_action = build_recommended_action(item, matched_companies)
    item.business_event_type = classify_business_event_type(item, matched_companies)
    return item


def apply_daily_admission_policy(item: Candidate) -> Candidate:
    """Keep the daily feed decision-grade while retaining rejected items in archive."""
    if item.tier == "archive":
        item.selection_reason = "未达到日报基础分数"
        return item

    relevance = item.acro_relevance.get("level", "low")
    action_type = item.recommended_action.get("type", "archive")
    if relevance == "low":
        item.tier = "archive"
        item.selection_reason = "ACRO 相关性较低，仅归档"
        item.reasons.append("日报准入：低相关信号降为归档")
        return item

    if not item.matched_company_ids and relevance == "medium" and action_type in {"archive", "trend"}:
        item.tier = "archive"
        item.selection_reason = "未命中公司且暂无明确业务动作，仅归档"
        item.reasons.append("日报准入：未命中公司且缺少明确业务动作")
        return item

    if item.tier == "immediate" and relevance != "high":
        item.tier = "daily"
    item.selection_reason = "命中公司或中高相关业务信号"
    return item


def score_candidate(
    item: Candidate,
    profile: dict[str, Any],
    matched_companies: list[dict[str, Any]],
    max_age_days: int,
) -> Candidate:
    blob = f"{item.title} {item.summary} {item.url}".lower()
    score = 0
    reasons: list[str] = []

    alias_hits = [
        alias
        for company in matched_companies
        for alias in company.get("aliases", [])
        if alias.lower() in blob
    ]
    if alias_hits:
        alias_score = 15 if item.source_trust == "owned" else 30
        score += alias_score
        reasons.append(f"公司池命中 +{alias_score}: " + ", ".join(alias_hits[:3]))
    elif item.company_id and any(
        company.get("id") == item.company_id for company in matched_companies
    ):
        # A dedicated company feed already establishes the entity even when the
        # article title does not repeat the publisher's company name.
        score += 15
        reasons.append("专属来源公司归属 +15")

    if item.source_trust == "owned":
        score += 15
        reasons.append("公司自有来源")
    elif item.source_trust == "ecosystem":
        score += 12
        reasons.append("行业生态平台公开来源")
    elif item.source_trust == "regulator":
        score += 20
        reasons.append("监管机构结构化来源")
    elif item.source_trust == "research":
        score += 10
        reasons.append("科研数据库结构化来源")
    elif item.source_trust == "wire":
        score += 8
        reasons.append("新闻稿分发平台")
    elif item.source_trust == "media":
        score += 10
        reasons.append("行业编辑媒体")

    topic_hits = [term for term in profile.get("strategic_topics", []) if term.lower() in blob]
    if topic_hits:
        score += min(30, 6 * len(topic_hits))
        reasons.append("战略主题命中: " + ", ".join(topic_hits[:5]))

    action_hits = [term for term in profile.get("business_actions", []) if term.lower() in blob]
    if action_hits:
        score += min(25, 8 * len(action_hits))
        reasons.append("业务动作命中: " + ", ".join(action_hits[:4]))

    noise_hits = [term for term in profile.get("noise_terms", []) if term.lower() in blob]
    if noise_hits:
        score -= 35
        reasons.append("噪音词命中: " + ", ".join(noise_hits[:3]))

    item.category = item.category_hint or classify_item(item.title.lower())

    # Category bonus: high-value signal types get extra points
    category_bonus = {
        "partnership": 10,
        "product": 10,
        "regulatory": 8,
        "market": 8,
        "event": 10,
        "video": 5,
        "research": 5,
    }
    bonus = category_bonus.get(item.category, 0)
    if bonus:
        score += bonus
        reasons.append(f"高价值分类加成 +{bonus}: {item.category}")

    item_age = age_days(item.published)
    has_action = bool(action_hits)
    if item_age is not None and item_age > max_age_days:
        if item_age > max_age_days * 2:
            score = min(score, 25)
            reasons.append(f"超过硬性时效上限: {item_age} 天前")
        elif has_action and score >= 40:
            # Business-action items with solid base score survive age degradation
            score = max(score - 10, 40)
            reasons.append(f"超过时效窗口 {item_age}天，因业务动作匹配保留")
        else:
            score = min(score, 25)
            reasons.append(f"超过默认时效窗口: {item_age} 天前")

    item.score = max(0, score)
    item.reasons = reasons or ["未命中强规则，默认归档"]
    item.tier = classify_tier(item.score, item.source_trust, has_action)
    if item.signal_type in {"video", "research", "funding", "clinical_trial"}:
        item.tier = "archive"
        item.reasons.append("专题信号：不进入默认新闻日报")
    return item


def classify_item(blob: str) -> str:
    category_terms = [
        ("partnership", ["collaboration", "partner", "mou", "agreement", "提携", "共同", "協業", "合作", "联合", "签约"]),
        ("product", ["launch", "release", "unveil", "introduce", "platform", "technology", "analyzer", "spectrometer", "bioreactor", "centrifuge", "gmp-grade", "kit", "protein", "antibody", "発売", "製品", "新薬", "治療薬", "产品", "新药", "试剂"]),
        ("event", ["webinar", "conference", "exhibition", "summit", "event", "meeting", "セミナー", "学会", "展示会", "会议", "峰会", "研讨会"]),
        ("regulatory", ["fda", "ema", "pmda", "regulatory", "clinical", "承認", "申請", "治験", "臨床", "規制", "获批", "申报", "临床", "审批", "nmpa"]),
        ("finance", ["ipo", "buyback", "dividend", "investor day", "quarter results", "price target", "forecast", "tradingview", "決算", "株価", "财报", "股价"]),
        ("award", ["award", "recognition"]),
        ("market", ["japan", "日本", "china", "中国", "global", "expansion", "海外"])
    ]
    for category, terms in category_terms:
        if any(term in blob for term in terms):
            return category
    return "company"


def classify_tier(score: int, trust: str, has_action: bool = False) -> str:
    if score >= 80:
        return "immediate"
    if score >= 50:
        return "daily"
    if trust == "owned" and score >= 40:
        return "daily"
    if trust == "ecosystem" and score >= 40:
        return "daily"
    if trust == "media" and score >= 40:
        return "daily"
    if has_action and score >= 45:
        return "daily"
    return "archive"


def build_evidence_record(
    item: Candidate,
    source_lookup: dict[str, dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    """Describe what supports the signal without overstating rule inference."""
    source_rows = [
        source_lookup[source_id]
        for source_id in item.source_ids
        if source_id in source_lookup
    ]
    source_types = list(dict.fromkeys(row.get("type", "unknown") for row in source_rows))
    trust = item.source_trust or "unknown"
    evidence_kind = (
        "primary"
        if trust in {"owned", "regulator", "research"}
        else "secondary"
        if trust in {"wire", "media", "ecosystem"}
        else "index"
    )
    has_excerpt = bool(item.summary and not is_low_information_summary(item.summary, item.title))
    return {
        "kind": evidence_kind,
        "kind_label": {
            "primary": "一手或官方证据",
            "secondary": "公开二手证据",
            "index": "聚合索引线索",
        }[evidence_kind],
        "verification_status": "source_backed" if has_excerpt else "needs_original_check",
        "verification_label": "有原始摘要支持" if has_excerpt else "需打开原文核验",
        "summary_basis": "source_excerpt" if has_excerpt else "title_and_structured_rules",
        "source_excerpt": first_sentence(item.summary, 220) if has_excerpt else "",
        "primary_url": item.url,
        "related_urls": item.related_urls,
        "source_ids": item.source_ids,
        "source_labels": item.source_labels,
        "source_types": source_types,
        "source_trust": trust,
        "published_at": item.published,
        "checked_at": generated_at,
    }


def build_company_timelines(
    candidates: list[Candidate],
    company_lookup: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    timelines: list[dict[str, Any]] = []
    for company_id, company in company_lookup.items():
        company_items = [
            item for item in candidates if company_id in item.matched_company_ids
        ]
        company_items.sort(
            key=lambda item: (item.published or "", item.score),
            reverse=True,
        )
        event_mix: dict[str, int] = {}
        topic_mix: dict[str, int] = {}
        action_mix: dict[str, int] = {}
        source_ids: set[str] = set()
        for item in company_items:
            event_mix[item.business_event_type] = event_mix.get(item.business_event_type, 0) + 1
            source_ids.update(item.source_ids)
            for group_name in ("targets", "modalities", "product_needs"):
                for value in item.intelligence.get(group_name, []):
                    topic_mix[value] = topic_mix.get(value, 0) + 1
            action_label = item.recommended_action.get("label", "")
            if action_label:
                action_mix[action_label] = action_mix.get(action_label, 0) + 1

        timelines.append(
            {
                "company_id": company_id,
                "company": company.get("display_name", company_id),
                "item_count": len(company_items),
                "selected_count": sum(
                    item.tier in {"immediate", "daily"} for item in company_items
                ),
                "high_relevance_count": sum(
                    item.acro_relevance.get("level") == "high" for item in company_items
                ),
                "source_count": len(source_ids),
                "latest_activity": latest_calendar_value(
                    [item.published for item in company_items if item.published]
                ),
                "event_mix": event_mix,
                "top_topics": [
                    {"label": label, "count": count}
                    for label, count in sorted(
                        topic_mix.items(), key=lambda pair: (-pair[1], pair[0])
                    )[:8]
                ],
                "top_actions": [
                    {"label": label, "count": count}
                    for label, count in sorted(
                        action_mix.items(), key=lambda pair: (-pair[1], pair[0])
                    )[:5]
                ],
                "item_ids": [item.key for item in company_items],
            }
        )
    return timelines


def build_report(
    candidates: list[Candidate],
    errors: list[str],
    seen: dict[str, Any],
    company_lookup: dict[str, dict[str, Any]],
    max_age_days: int,
    ai_summaries: dict[str, str] | None = None,
    summary_methods: dict[str, str] | None = None,
) -> str:
    ai_summaries = ai_summaries or {}
    summary_methods = summary_methods or {}
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
        f"机制说明：默认不实时推送，默认时效窗口为 {max_age_days} 天。只有 `immediate` 才适合接微信、邮件或 Slack 这类即时提醒；`daily` 进入每日简报；`archive` 只保留，不打扰。高价值分类（合作、产品、监管、市场）和业务动作匹配内容在时效上给予一定宽容度。",
        "",
    ]

    lines.extend(render_section("即时提醒候选", immediate, company_lookup, ai_summaries, summary_methods))
    lines.extend(render_section("今日简报", daily, company_lookup, ai_summaries, summary_methods))
    lines.extend(render_section("归档 / 暂不推送", archive[:15], company_lookup, ai_summaries, summary_methods))

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
    source_config: list[dict[str, Any]],
    source_runtime: dict[str, Any],
    company_source_coverage: dict[str, Any],
    source_experiments: dict[str, Any],
    max_age_days: int,
    ai_summaries: dict[str, str] | None = None,
    summary_methods: dict[str, str] | None = None,
    summary_providers: dict[str, str] | None = None,
    summary_models: dict[str, str] | None = None,
    summary_pipeline: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ai_summaries = ai_summaries or {}
    summary_methods = summary_methods or {}
    summary_providers = summary_providers or {}
    summary_models = summary_models or {}
    summary_pipeline = summary_pipeline or {"status": "rules_only", "requested": False}
    generated_at = dt.datetime.now().isoformat(timespec="seconds")
    source_lookup = {source["id"]: source for source in source_config}
    new_items = [item for item in candidates if item.key not in seen]
    tiers = {
        "immediate": [item for item in candidates if item.tier == "immediate"],
        "daily": [item for item in candidates if item.tier == "daily"],
        "archive": [item for item in candidates if item.tier == "archive"],
    }
    categories: dict[str, int] = {}
    sources: dict[str, int] = {}
    signal_types: dict[str, int] = {}
    for item in candidates:
        categories[item.category] = categories.get(item.category, 0) + 1
        for source_label in item.source_labels:
            sources[source_label] = sources.get(source_label, 0) + 1
        signal_types[item.signal_type] = signal_types.get(item.signal_type, 0) + 1

    errors_by_source: dict[str, str] = {}
    for error in errors:
        source_id, _, message = error.partition(": ")
        errors_by_source[source_id] = message or error

    source_health: list[dict[str, Any]] = []
    for source in source_config:
        source_items = [item for item in candidates if source["id"] in item.source_ids]
        runtime = source_runtime.get(source["id"], {})
        tier_counts = {
            tier: sum(1 for item in source_items if item.tier == tier)
            for tier in ("immediate", "daily", "archive")
        }
        enabled = source.get("enabled", True) is not False
        if not enabled:
            status = "pending"
        elif source["id"] in errors_by_source:
            status = "error"
        elif source_items:
            status = "productive" if tier_counts["immediate"] + tier_counts["daily"] else "archive_only"
        else:
            status = "quiet"
        operational_status = (
            "not_running"
            if not enabled
            else "error"
            if source["id"] in errors_by_source
            else "reachable"
        )
        dated_items = [item.published for item in source_items if item.published]
        source_company_id = source.get("company_id", "")
        scope_label = (
            company_lookup.get(source_company_id, {}).get("display_name")
            if source_company_id
            else source.get("scope_label", "跨公司监测源")
        )
        source_health.append(
            {
                "source_id": source["id"],
                "source_label": source["label"],
                "company_id": source_company_id,
                "company": scope_label,
                "scope": scope_label,
                "source_type": source["type"],
                "signal_type": source.get("signal_type", "news"),
                "enabled": enabled,
                "status": status,
                "operational_status": operational_status,
                "output_status": status if status not in {"error", "pending"} else "none",
                "total": len(source_items),
                "immediate": tier_counts["immediate"],
                "daily": tier_counts["daily"],
                "archive": tier_counts["archive"],
                "selected_rate": round(
                    ((tier_counts["immediate"] + tier_counts["daily"]) / len(source_items)) * 100
                ) if source_items else 0,
                "last_published": latest_calendar_value(dated_items),
                "error": errors_by_source.get(source["id"], ""),
                "note": source.get("disabled_reason", "") or source.get("health_note", ""),
                "snapshot_count": runtime.get("snapshot_count", 0),
                "new_urls": runtime.get("new_urls", 0),
                "initial_snapshot": runtime.get("initial_snapshot", False),
                "last_checked": runtime.get("last_checked", ""),
                "raw_candidate_count": runtime.get("raw_candidate_count", 0),
            }
        )

    return {
        "generated_at": generated_at,
        "window_days": max_age_days,
        "summary": {
            "new_candidates": len(new_items),
            "immediate": len(tiers["immediate"]),
            "daily": len(tiers["daily"]),
            "archive": len(tiers["archive"]),
            "errors": len(errors),
            "companies": len(
                {
                    company_id
                    for item in candidates
                    for company_id in item.matched_company_ids
                }
            ),
            "sources": len({item.source_id for item in candidates}),
        },
        "summary_pipeline": summary_pipeline,
        "source_mix": sources,
        "category_mix": categories,
        "signal_type_mix": signal_types,
        "source_health": source_health,
        "source_experiments": source_experiments,
        "company_source_coverage": company_source_coverage,
        "company_timelines": build_company_timelines(candidates, company_lookup),
        "companies": [
            {
                "id": company["id"],
                "display_name": company["display_name"],
                "business_role": company.get("business_role", "unclassified"),
                "role_label": company.get("role_label", "待分类"),
                "role_reason": company.get("role_reason", ""),
                "monitoring_focus": company.get("monitoring_focus", ""),
                "competitive_relevance_rank": company.get("competitive_relevance_rank"),
                "competitive_relevance_scope": company.get("competitive_relevance_scope", ""),
                "parent_company_id": company.get("parent_company_id", ""),
                "account_origin_id": company.get("account_origin_id", ""),
                "account_monitoring_stage": company.get("account_monitoring_stage", ""),
                "relationship_status": company.get("relationship_status", ""),
                "markets": company.get("markets", []),
                "strategic_topics": company.get("strategic_topics", []),
            }
            for company in company_lookup.values()
        ],
        "items": [
            {
                "id": item.key,
                "company_id": item.company_id,
                "company": (
                    " / ".join(
                        company_lookup[company_id]["display_name"]
                        for company_id in item.matched_company_ids
                        if company_id in company_lookup
                    )
                    or "行业观察（未命中公司池）"
                ),
                "matched_company_ids": item.matched_company_ids,
                "matched_companies": [
                    company_lookup[company_id]["display_name"]
                    for company_id in item.matched_company_ids
                    if company_id in company_lookup
                ],
                "source_id": item.source_id,
                "source_label": item.source_label,
                "source_ids": item.source_ids,
                "source_labels": item.source_labels,
                "related_urls": item.related_urls,
                "source_trust": item.source_trust,
                "title": item.title,
                "url": item.url,
                "published": item.published,
                "summary": item.summary,
                "ai_summary": ai_summaries.get(item.key, ""),
                "summary_method": summary_methods.get(item.key, "rule"),
                "summary_provider": summary_providers.get(item.key, "rules"),
                "summary_model": summary_models.get(item.key, ""),
                "summary_quality": (
                    "source_backed"
                    if item.summary and not is_low_information_summary(item.summary, item.title)
                    else "structured_inference"
                ),
                "evidence": build_evidence_record(item, source_lookup, generated_at),
                "workflow_status": "new",
                "score": item.score,
                "tier": item.tier,
                "category": item.category,
                "business_event_type": item.business_event_type,
                "signal_type": item.signal_type,
                "is_new": item.key not in seen,
                "reasons": item.reasons,
                "intelligence": item.intelligence,
                "acro_relevance": item.acro_relevance,
                "recommended_action": item.recommended_action,
                "selection_reason": item.selection_reason,
                "published_at": "" if item.signal_type == "event" else item.published,
                "event_start_at": item.published if item.signal_type == "event" else "",
                "age_days": None if item.signal_type == "event" else age_days(item.published),
                "days_until_event": days_until(item.published) if item.signal_type == "event" else None,
            }
            for item in sorted(candidates, key=lambda x: (x.tier != "immediate", -x.score))
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
        "summary_pipeline": payload.get("summary_pipeline", {}),
        "selected": [item for item in payload["items"] if item["tier"] in {"immediate", "daily"}],
    })
    save_json(API_DIR / "topics.json", {
        "generated_at": payload["generated_at"],
        "category_mix": payload["category_mix"],
        "source_mix": payload["source_mix"],
        "signal_type_mix": payload["signal_type_mix"],
        "companies": payload["companies"],
        "company_timelines": payload.get("company_timelines", []),
        "source_experiments": payload.get("source_experiments", {}),
    })


def render_section(
    title: str,
    items: list[Candidate],
    company_lookup: dict[str, dict[str, Any]],
    ai_summaries: dict[str, str] | None = None,
    summary_methods: dict[str, str] | None = None,
) -> list[str]:
    ai_summaries = ai_summaries or {}
    summary_methods = summary_methods or {}
    lines = ["", f"## {title}", ""]
    if not items:
        lines.append("暂无。")
        return lines

    for idx, item in enumerate(sorted(items, key=lambda x: x.score, reverse=True), start=1):
        company = (
            " / ".join(
                company_lookup[company_id]["display_name"]
                for company_id in item.matched_company_ids
                if company_id in company_lookup
            )
            or "行业观察（未命中公司池）"
        )
        date_suffix = f" | {item.published}" if item.published else ""
        lines.extend(
            [
                f"{idx}. [{item.title}]({item.url})",
                f"   - 公司命中：{company}",
                f"   - 来源：{item.source_label}{date_suffix}",
                f"   - 分数 / 分层：{item.score} / `{item.tier}`",
                f"   - 分类：`{item.category}`",
                f"   - 情报类型：`{item.signal_type}`",
                f"   - 理由：{'; '.join(item.reasons)}",
            ]
        )
        if item.summary:
            lines.append(f"   - 摘要：{clean_text(item.summary)[:220]}")
        ai_text = ai_summaries.get(item.key, "")
        if ai_text:
            summary_label = "AI 摘要" if summary_methods.get(item.key) == "llm" else "规则提要"
            lines.append(f"   - {summary_label}：{ai_text}")
        if item.acro_relevance:
            lines.append(
                f"   - ACRO 相关性：{item.acro_relevance.get('label', '')} · "
                f"{item.acro_relevance.get('explanation', '')}"
            )
        if item.recommended_action:
            lines.append(
                f"   - 建议动作：{item.recommended_action.get('label', '')} "
                f"— {item.recommended_action.get('text', '')}"
            )
        lines.append("")
    return lines


def main() -> int:
    try:
        default_ai_summary_limit = max(1, int(os.environ.get("AI_SUMMARY_LIMIT", "10")))
    except ValueError:
        default_ai_summary_limit = 10
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Do not update seen state.")
    parser.add_argument("--days", type=int, default=90, help="Recency window for daily push candidates.")
    parser.add_argument("--strict-errors", action="store_true", help="Exit non-zero when any source fails.")
    parser.add_argument(
        "--ai-summary",
        action="store_true",
        help="Generate model summaries only when provider, key, and model are explicitly configured.",
    )
    parser.add_argument(
        "--ai-summary-limit",
        type=int,
        default=default_ai_summary_limit,
        help="Maximum new model summaries per run (default: 10).",
    )
    args = parser.parse_args()

    company_config, company_source_coverage, sources = load_runtime_configuration()
    companies = company_config["companies"]
    source_profiles = {
        profile["id"]: profile
        for profile in company_config.get("source_profiles", [])
    }
    intelligence_rules = load_json(CONFIG_DIR / "intelligence_rules.json")
    source_experiments_path = CONFIG_DIR / "source_experiments.json"
    source_experiments = (
        load_json(source_experiments_path)
        if source_experiments_path.exists()
        else {"updated_at": "", "principle": "", "experiments": []}
    )
    company_lookup = {company["id"]: company for company in companies}
    source_lookup = {source["id"]: source for source in sources}
    seen = load_json(SEEN_PATH) if SEEN_PATH.exists() else {}
    previous_payload = load_json(LATEST_RUN_PATH) if LATEST_RUN_PATH.exists() else {}
    previous_items = {
        item.get("id"): item
        for item in previous_payload.get("items", [])
        if item.get("id")
    }
    source_snapshots = (
        load_json(SOURCE_SNAPSHOTS_PATH)
        if SOURCE_SNAPSHOTS_PATH.exists()
        else {}
    )

    candidates, errors, snapshot_updates, source_runtime = collect_candidates(
        sources,
        source_snapshots,
    )
    candidates = dedupe(candidates)
    scored: list[Candidate] = []
    for item in candidates:
        match_candidate_companies(item, company_lookup)
        matched_companies = [
            company_lookup[company_id]
            for company_id in item.matched_company_ids
            if company_id in company_lookup
        ]
        profiles = list(matched_companies)
        for source_id in item.source_ids:
            profile_id = source_lookup.get(source_id, {}).get("profile_id", "")
            if profile_id in source_profiles:
                profiles.append(source_profiles[profile_id])
        profile = merge_scoring_profiles(profiles)
        scored_item = score_candidate(item, profile, matched_companies, args.days)
        enrich_candidate_intelligence(scored_item, intelligence_rules, matched_companies)
        apply_daily_admission_policy(scored_item)
        apply_source_tier_policy(scored_item, source_lookup)
        scored.append(scored_item)

    # Business summary for dashboard cards. The rule-based pass is always on so
    # the UI never falls back to title-like RSS descriptions; optional LLM output
    # can overwrite it for daily/immediate items.
    ai_summaries: dict[str, str] = {
        item.key: build_rule_summary(
            item,
            [
                company_lookup[company_id]
                for company_id in item.matched_company_ids
                if company_id in company_lookup
            ],
        )
        for item in scored
    }
    summary_methods = {item.key: "rule" for item in scored}
    summary_providers = {item.key: "rules" for item in scored}
    summary_models = {item.key: "" for item in scored}
    reused_count = 0
    for item in scored:
        previous = previous_items.get(item.key, {})
        if previous.get("summary_method") != "llm" or not previous.get("ai_summary"):
            continue
        ai_summaries[item.key] = previous["ai_summary"]
        summary_methods[item.key] = "llm"
        summary_providers[item.key] = previous.get("summary_provider", "model")
        summary_models[item.key] = previous.get("summary_model", "")
        reused_count += 1

    summary_pipeline: dict[str, Any] = {
        "requested": args.ai_summary,
        "status": "rules_only",
        "provider": "",
        "model": "",
        "limit": max(1, args.ai_summary_limit),
        "eligible": 0,
        "generated": 0,
        "reused": reused_count,
        "failed": 0,
        "error": "",
    }
    if args.ai_summary:
        config, config_error = resolve_ai_summary_config()
        summary_candidates = sorted(
            [
                item
                for item in scored
                if item.tier in {"immediate", "daily"}
                and summary_methods.get(item.key) != "llm"
            ],
            key=lambda item: (item.tier != "immediate", -item.score),
        )
        summary_pipeline["eligible"] = len(summary_candidates)
        if config_error:
            summary_pipeline["status"] = "configuration_error"
            summary_pipeline["error"] = config_error
            print(f"AI summary disabled for this run: {config_error}", file=sys.stderr)
        else:
            summary_pipeline["provider"] = config["provider"]
            summary_pipeline["model"] = config["model"]
        for item in summary_candidates[:summary_pipeline["limit"]] if config else []:
            company_name = (
                " / ".join(
                    company_lookup[company_id]["display_name"]
                    for company_id in item.matched_company_ids
                    if company_id in company_lookup
                )
                or "行业观察"
            )
            ai_text, ai_error = generate_ai_summary(item, company_name, config)
            if ai_text:
                ai_summaries[item.key] = ai_text
                summary_methods[item.key] = "llm"
                summary_providers[item.key] = config["provider"]
                summary_models[item.key] = config["model"]
                summary_pipeline["generated"] += 1
                continue
            summary_pipeline["failed"] += 1
            summary_pipeline["error"] = ai_error
            summary_pipeline["status"] = "request_error"
            print(f"AI summary request failed: {ai_error}", file=sys.stderr)
            break
        if config and summary_pipeline["status"] != "request_error":
            summary_pipeline["status"] = (
                "limit_reached"
                if len(summary_candidates) > summary_pipeline["limit"]
                else "complete"
            )

    report = build_report(
        scored,
        errors,
        seen,
        company_lookup,
        args.days,
        ai_summaries,
        summary_methods,
    )
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORT_DIR / f"daily-{dt.date.today().isoformat()}.md"
    out_path.write_text(report, encoding="utf-8")
    payload = build_dashboard_payload(
        scored,
        errors,
        seen,
        company_lookup,
        sources,
        source_runtime,
        company_source_coverage,
        source_experiments,
        args.days,
        ai_summaries,
        summary_methods,
        summary_providers,
        summary_models,
        summary_pipeline,
    )
    save_json(LATEST_RUN_PATH, payload)
    write_static_api(payload)

    # Save history snapshot for trend tracking
    history_dir = DATA_DIR / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    save_json(history_dir / f"{dt.date.today().isoformat()}.json", {
        "date": dt.date.today().isoformat(),
        "summary": payload["summary"],
        "category_mix": payload["category_mix"],
        "source_mix": payload["source_mix"],
    })

    # Keep only last 90 days of history
    all_history = sorted(history_dir.glob("*.json"))
    for old_file in all_history[:-90]:
        old_file.unlink()

    if not args.dry_run:
        source_snapshots.update(snapshot_updates)
        save_json(SOURCE_SNAPSHOTS_PATH, source_snapshots)
        for item in scored:
            seen.setdefault(
                item.key,
                {
                    "first_seen": dt.datetime.now().isoformat(timespec="seconds"),
                    "title": item.title,
                    "url": normalize_url(item.url),
                    "company_id": item.company_id,
                    "matched_company_ids": item.matched_company_ids,
                    "tier": item.tier,
                    "score": item.score,
                    "signal_type": item.signal_type,
                },
            )
        save_json(SEEN_PATH, seen)

    print(out_path)
    print(f"candidates={len(candidates)} errors={len(errors)} dry_run={args.dry_run}")
    return 2 if args.strict_errors and errors else 0


if __name__ == "__main__":
    sys.exit(main())
