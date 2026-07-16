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
SOURCE_SNAPSHOTS_PATH = DATA_DIR / "source_snapshots.json"
API_DIR = ROOT / "api" / "public"


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


def generate_ai_summary(item: Candidate, company_name: str) -> str:
    """Generate a Chinese business-oriented summary for a candidate item.

    Requires ANTHROPIC_API_KEY env var. Returns empty string if unavailable or on error.
    """
    import os

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return ""

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

    body = json.dumps({
        "model": "claude-sonnet-5",
        "max_tokens": 200,
        "temperature": 0.3,
        "messages": [
            {"role": "user", "content": prompt}
        ],
    })

    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2025-01-01",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result.get("content", [])
            if content and isinstance(content, list):
                return content[0].get("text", "").strip()
    except Exception:
        pass

    return ""


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


def age_days(value: str) -> int | None:
    if not value:
        return None
    try:
        published = dt.date.fromisoformat(value[:10])
    except ValueError:
        return None
    return (dt.date.today() - published).days


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
    if cleaned.startswith(("share on", "follow us on", "cookie", "accept cookies")):
        return True
    return False


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


def parse_rss(source: dict[str, Any]) -> list[Candidate]:
    text = fetch_text(source["url"])
    root = ET.fromstring(text.lstrip())
    items: list[Candidate] = []
    for item in root.findall(".//item"):
        title = clean_text(item.findtext("title", ""))
        link = clean_text(item.findtext("link", ""))
        if not title or not link or is_html_noise(title):
            continue
        raw_desc = item.findtext("description", "")
        candidate = Candidate(
            company_id=source["company_id"],
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
            company_id=source["company_id"],
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
            company_id=source["company_id"],
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
            company_id=source["company_id"],
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
            company_id=source["company_id"],
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
    data = json.loads(fetch_text(source["url"]))
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
            company_id=source["company_id"],
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
            company_id=source["company_id"],
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


def source_allows_candidate(source: dict[str, Any], item: Candidate) -> bool:
    """Apply source-specific quality gates before global scoring."""
    blob = f"{item.title} {item.summary} {item.url}".lower()
    include_terms = [term.lower() for term in source.get("include_text_terms", [])]
    exclude_terms = [term.lower() for term in source.get("exclude_text_terms", [])]

    if include_terms and not any(term in blob for term in include_terms):
        return False
    if exclude_terms and any(term in blob for term in exclude_terms):
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
    items: list[Candidate] = []
    for link in parser.links:
        absolute = urllib.parse.urljoin(base_url, link["href"])
        if include_terms and not any(term in absolute.lower() for term in include_terms):
            continue
        title = link["text"] or absolute
        if len(title) < 4 or is_html_noise(title):
            continue
        items.append(
            Candidate(
                company_id=source["company_id"],
                source_id=source["id"],
                source_label=source["label"],
                source_trust=source.get("trust", "unknown"),
                title=title,
                url=absolute,
                category_hint=source.get("category_hint", ""),
                signal_type=source.get("signal_type", "news"),
            )
        )
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
                source_runtime[source["id"]] = runtime
            elif source["type"] == "sec_submissions":
                candidates.extend(parse_sec_submissions(source))
            elif source["type"] == "openfda":
                candidates.extend(parse_openfda(source))
            elif source["type"] == "pubmed":
                candidates.extend(parse_pubmed(source))
            elif source["type"] == "html_links":
                candidates.extend(parse_html_links(source))
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
            errors.append(f"{source['id']}: {exc}")
    return candidates, errors, snapshot_updates, source_runtime


def dedupe(candidates: list[Candidate]) -> list[Candidate]:
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[Candidate] = []
    for item in candidates:
        url_key = normalize_url(item.url)
        title_key = normalize_title(item.title)
        if url_key in seen_urls or (len(title_key) >= 30 and title_key in seen_titles):
            continue
        seen_urls.add(url_key)
        if len(title_key) >= 30:
            seen_titles.add(title_key)
        unique.append(item)
    return unique


def normalize_title(value: str) -> str:
    # Google News appends the publisher after the final " - ".
    headline = re.sub(r"\s+-\s+[^-]{2,80}$", "", clean_text(value))
    return re.sub(r"[^\w]+", "", headline, flags=re.UNICODE).lower()


def score_candidate(item: Candidate, company: dict[str, Any], max_age_days: int) -> Candidate:
    blob = f"{item.title} {item.summary} {item.url}".lower()
    score = 0
    reasons: list[str] = []

    alias_hits = [alias for alias in company["aliases"] if alias.lower() in blob]
    if alias_hits:
        alias_score = 15 if item.source_trust == "owned" else 30
        score += alias_score
        reasons.append(f"公司别名命中 +{alias_score}: " + ", ".join(alias_hits[:3]))

    if item.source_trust == "owned":
        score += 15
        reasons.append("公司自有来源")
    elif item.source_trust == "regulator":
        score += 20
        reasons.append("监管机构结构化来源")
    elif item.source_trust == "research":
        score += 10
        reasons.append("科研数据库结构化来源")

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
    if item.signal_type in {"video", "research"}:
        item.tier = "archive"
        item.reasons.append("专题信号：不进入默认新闻日报")
    return item


def classify_item(blob: str) -> str:
    category_terms = [
        ("partnership", ["collaboration", "partner", "mou", "agreement"]),
        ("product", ["launch", "release", "unveil", "introduce", "platform", "technology", "analyzer", "spectrometer", "bioreactor", "centrifuge", "gmp-grade", "kit", "protein", "antibody"]),
        ("event", ["webinar", "conference", "exhibition", "summit", "event", "meeting"]),
        ("regulatory", ["fda", "ema", "pmda", "regulatory", "clinical"]),
        ("finance", ["ipo", "buyback", "dividend", "investor day", "quarter results", "price target", "forecast", "tradingview"]),
        ("award", ["award", "recognition"]),
        ("market", ["japan", "日本", "global", "expansion"])
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
    if has_action and score >= 45:
        return "daily"
    return "archive"


def build_report(
    candidates: list[Candidate],
    errors: list[str],
    seen: dict[str, Any],
    company_lookup: dict[str, dict[str, Any]],
    max_age_days: int,
    ai_summaries: dict[str, str] | None = None,
) -> str:
    ai_summaries = ai_summaries or {}
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

    lines.extend(render_section("即时提醒候选", immediate, company_lookup, ai_summaries))
    lines.extend(render_section("今日简报", daily, company_lookup, ai_summaries))
    lines.extend(render_section("归档 / 暂不推送", archive[:15], company_lookup, ai_summaries))

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
    max_age_days: int,
    ai_summaries: dict[str, str] | None = None,
) -> dict[str, Any]:
    ai_summaries = ai_summaries or {}
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
        sources[item.source_label] = sources.get(item.source_label, 0) + 1
        signal_types[item.signal_type] = signal_types.get(item.signal_type, 0) + 1

    errors_by_source: dict[str, str] = {}
    for error in errors:
        source_id, _, message = error.partition(": ")
        errors_by_source[source_id] = message or error

    source_health: list[dict[str, Any]] = []
    for source in source_config:
        source_items = [item for item in candidates if item.source_id == source["id"]]
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
        dated_items = [item.published for item in source_items if item.published]
        source_health.append(
            {
                "source_id": source["id"],
                "source_label": source["label"],
                "company_id": source["company_id"],
                "company": company_lookup.get(source["company_id"], {}).get("display_name", source["company_id"]),
                "source_type": source["type"],
                "signal_type": source.get("signal_type", "news"),
                "enabled": enabled,
                "status": status,
                "total": len(source_items),
                "immediate": tier_counts["immediate"],
                "daily": tier_counts["daily"],
                "archive": tier_counts["archive"],
                "selected_rate": round(
                    ((tier_counts["immediate"] + tier_counts["daily"]) / len(source_items)) * 100
                ) if source_items else 0,
                "last_published": max(dated_items) if dated_items else "",
                "error": errors_by_source.get(source["id"], ""),
                "note": source.get("disabled_reason", "") or source.get("health_note", ""),
                "snapshot_count": runtime.get("snapshot_count", 0),
                "new_urls": runtime.get("new_urls", 0),
                "initial_snapshot": runtime.get("initial_snapshot", False),
                "last_checked": runtime.get("last_checked", ""),
            }
        )

    return {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "window_days": max_age_days,
        "summary": {
            "new_candidates": len(new_items),
            "immediate": len(tiers["immediate"]),
            "daily": len(tiers["daily"]),
            "archive": len(tiers["archive"]),
            "errors": len(errors),
            "companies": len({item.company_id for item in candidates}),
            "sources": len({item.source_id for item in candidates}),
        },
        "source_mix": sources,
        "category_mix": categories,
        "signal_type_mix": signal_types,
        "source_health": source_health,
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
                "ai_summary": ai_summaries.get(item.key, ""),
                "score": item.score,
                "tier": item.tier,
                "category": item.category,
                "signal_type": item.signal_type,
                "is_new": item.key not in seen,
                "reasons": item.reasons,
                "age_days": age_days(item.published),
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
        "selected": [item for item in payload["items"] if item["tier"] in {"immediate", "daily"}],
    })
    save_json(API_DIR / "topics.json", {
        "generated_at": payload["generated_at"],
        "category_mix": payload["category_mix"],
        "source_mix": payload["source_mix"],
        "signal_type_mix": payload["signal_type_mix"],
        "companies": payload["companies"],
    })


def render_section(
    title: str,
    items: list[Candidate],
    company_lookup: dict[str, dict[str, Any]],
    ai_summaries: dict[str, str] | None = None,
) -> list[str]:
    ai_summaries = ai_summaries or {}
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
                f"   - 情报类型：`{item.signal_type}`",
                f"   - 理由：{'; '.join(item.reasons)}",
            ]
        )
        if item.summary:
            lines.append(f"   - 摘要：{clean_text(item.summary)[:220]}")
        ai_text = ai_summaries.get(item.key, "")
        if ai_text:
            lines.append(f"   - 🤖 AI 业务摘要：{ai_text}")
        lines.append("")
    return lines


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Do not update seen state.")
    parser.add_argument("--days", type=int, default=90, help="Recency window for daily push candidates.")
    parser.add_argument("--strict-errors", action="store_true", help="Exit non-zero when any source fails.")
    parser.add_argument("--ai-summary", action="store_true", help="Generate AI Chinese summaries for daily/immediate items (needs ANTHROPIC_API_KEY).")
    args = parser.parse_args()

    companies = load_json(CONFIG_DIR / "companies.json")["companies"]
    sources = load_json(CONFIG_DIR / "sources.json")["sources"]
    company_lookup = {company["id"]: company for company in companies}
    seen = load_json(SEEN_PATH) if SEEN_PATH.exists() else {}
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
    scored = [
        score_candidate(item, company_lookup[item.company_id], args.days)
        for item in candidates
        if item.company_id in company_lookup
    ]

    # AI summary for daily/immediate items
    ai_summaries: dict[str, str] = {}
    if args.ai_summary:
        summary_candidates = [item for item in scored if item.tier in {"immediate", "daily"}]
        for item in summary_candidates:
            company_name = company_lookup.get(item.company_id, {}).get("display_name", item.company_id)
            ai_text = generate_ai_summary(item, company_name)
            if ai_text:
                ai_summaries[item.key] = ai_text

    report = build_report(scored, errors, seen, company_lookup, args.days, ai_summaries)
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
        args.days,
        ai_summaries,
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
