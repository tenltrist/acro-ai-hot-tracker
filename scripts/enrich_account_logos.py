#!/usr/bin/env python3
"""Discover, verify and cache official visual identities for Japan accounts.

Search results are used only to discover candidate websites. A logo is accepted
only after the candidate page itself identifies the requested organization.
When an official page has no reusable logo image, its own site icon is retained
and labelled separately from an official logo.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, unquote, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageStat
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


ROOT = Path(__file__).resolve().parents[1]
ACCOUNTS_PATH = ROOT / "config" / "japan_accounts.json"
LOGOS_PATH = ROOT / "config" / "company_logos.json"
OVERRIDES_PATH = ROOT / "config" / "account_logo_overrides.json"
ASSET_DIR = ROOT / "web" / "assets" / "company-logos"
REPORT_PATH = ROOT / "data" / "account_logo_enrichment_report.json"

SEARCH_URL = "https://search.yahoo.co.jp/search"
WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36 "
    "ACROHotTrackerLogoVerifier/1.0"
)
MAX_HTML_BYTES = 4_000_000
MAX_IMAGE_BYTES = 2_500_000
MIN_IDENTITY_SCORE = 72

LEGAL_WORDS = {
    "a", "an", "and", "co", "company", "corp", "corporation", "godo",
    "holdings", "inc", "incorporated", "kk", "limited", "ltd", "of",
    "the", "group", "plc",
}
GENERIC_IDENTITY_WORDS = {
    "biopharma", "biopharmaceutical", "biopharmaceuticals", "biotech",
    "biotechnology", "clinic", "hospital", "institute", "laboratory",
    "medical", "medicine", "pharma", "pharmaceutical", "pharmaceuticals",
    "research", "science", "sciences", "school", "technologies",
    "technology", "therapeutics", "university",
}
BLOCKED_HOST_PARTS = {
    "amazon.", "b2match.", "biocentury.", "bloomberg.", "businesswire.",
    "crunchbase.", "facebook.", "fiercebiotech.", "fiercepharma.",
    "globaldata.", "google.", "instagram.", "ipojp.", "jglobal.",
    "linkedin.", "nikkei.", "nikkeibp.", "note.com", "pitchbook.",
    "prnewswire.", "prtimes.", "reuters.", "smp.ne.jp", "theorg.",
    "wantedly.", "wikipedia.", "x.com", "youtube.", "yahoo.",
}
BLOCKED_FILE_SUFFIXES = {".doc", ".docx", ".pdf", ".ppt", ".pptx", ".xls", ".xlsx", ".zip"}
LOGO_SIGNALS = ("logo", "brand", "site-id", "siteid", "identity", "symbol-mark", "symbolmark")
NEGATIVE_IMAGE_SIGNALS = (
    "banner", "campaign", "client", "customer", "hero", "member", "partner",
    "portfolio", "product", "sponsor", "supporter",
)
GENERIC_SITE_ICON_PARTS = (
    "s1.wp.com/i/favicon",
    "s2.wp.com/i/webclip",
    "static.parastorage.com/client/pfavico",
    "google.com/s2/favicons",
)


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


@dataclass
class OfficialPage:
    requested_url: str
    url: str
    title: str
    html: bytes
    soup: BeautifulSoup
    identity_score: int
    identity_reasons: list[str]


@dataclass
class ImageCandidate:
    url: str
    score: int
    reasons: list[str]
    kind: str


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=2,
        status=3,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en,ja;q=0.9"})
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def ascii_fold(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    return "".join(char for char in value if not unicodedata.combining(char)).lower()


def words(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", ascii_fold(value))


def normalized_name(value: str) -> str:
    return " ".join(token for token in words(value) if token not in LEGAL_WORDS)


def compact_name(value: str) -> str:
    return "".join(words(normalized_name(value)))


def distinctive_tokens(value: str) -> list[str]:
    tokens = [
        token for token in words(normalized_name(value))
        if len(token) >= 3 and token not in GENERIC_IDENTITY_WORDS
    ]
    return tokens or [token for token in words(normalized_name(value)) if len(token) >= 3]


def label_variants(value: str) -> list[str]:
    variants = [value.strip()]
    stripped = re.sub(
        r"(?:,?\s+(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Ltd\.?|Corp\.?|Corporation|Inc\.?|KK|Ltd\.?))+$",
        "",
        value.strip(),
        flags=re.I,
    ).strip()
    if stripped and stripped not in variants:
        variants.append(stripped)
    title = stripped.title()
    if title and title not in variants:
        variants.append(title)
    return variants


def sequence_score(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, compact_name(left), compact_name(right)).ratio()


def host_key(url: str) -> str:
    host = urlsplit(url).hostname or ""
    host = host.lower().removeprefix("www.")
    return re.sub(r"[^a-z0-9]", "", host.split(".")[0])


def domain_supports_identity(name: str, url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
    host_compact = re.sub(r"[^a-z0-9]", "", host)
    host_label = re.sub(r"[^a-z0-9]", "", host.split(".")[0])
    tokens = distinctive_tokens(name)
    if any(len(token) >= 3 and token in host_compact for token in tokens):
        return True
    name_compact = compact_name(name)
    if len(host_label) >= 3 and (host_label in name_compact or name_compact in host_label):
        return True
    identity_words = [
        token for token in words(name)
        if (token not in LEGAL_WORDS or token == "group") and token != "japan"
    ]
    initials = "".join(token if len(token) <= 3 else token[0] for token in identity_words)
    if len(initials) >= 3 and (initials in host_compact or initials[:-1] in host_compact):
        return True
    academic = any(marker in normalized_name(name) for marker in ("university", "school", "hospital"))
    government = any(marker in normalized_name(name) for marker in ("ministry", "national", "institute"))
    return (academic and host.endswith(".ac.jp")) or (government and host.endswith(".go.jp"))


def clean_candidate_url(raw_url: str) -> str:
    if raw_url.startswith("//"):
        raw_url = "https:" + raw_url
    parsed = urlsplit(raw_url)
    if "duckduckgo.com" in parsed.netloc:
        raw_url = unquote(parse_qs(parsed.query).get("uddg", [raw_url])[0])
        parsed = urlsplit(raw_url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, ""))


def is_blocked_url(url: str) -> bool:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    path = parsed.path.lower()
    if parsed.scheme not in {"http", "https"} or not host:
        return True
    def matches_blocked_host(pattern: str) -> bool:
        if pattern.endswith("."):
            return pattern[:-1] in host.split(".")
        return host == pattern or host.endswith(f".{pattern}")

    if any(matches_blocked_host(part) for part in BLOCKED_HOST_PARTS):
        return True
    return any(path.endswith(suffix) for suffix in BLOCKED_FILE_SUFFIXES)


def get_limited(session: requests.Session, url: str, *, timeout: int = 25, max_bytes: int) -> requests.Response:
    response = session.get(url, timeout=timeout, allow_redirects=True, stream=True)
    response.raise_for_status()
    chunks = []
    total = 0
    for chunk in response.iter_content(64 * 1024):
        total += len(chunk)
        if total > max_bytes:
            raise ValueError(f"response_too_large:{total}")
        chunks.append(chunk)
    response._content = b"".join(chunks)
    response._content_consumed = True
    return response


def search_official_sites(session: requests.Session, name: str) -> list[SearchResult]:
    queries = [f'"{name}" 公式', f'{normalized_name(name)} 公式サイト']
    seen = set()
    results = []
    for query in queries:
        # Yahoo Japan exposes a stable, server-rendered result list to its
        # lightweight client. The full desktop page is hydration-only HTML.
        response = session.get(
            SEARCH_URL,
            params={"p": query},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=25,
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        for row in soup.select("#web ol > li"):
            anchor = row.find("a", href=True)
            if not anchor:
                continue
            url = clean_candidate_url(anchor["href"])
            if url in seen or is_blocked_url(url):
                continue
            seen.add(url)
            description = row.find("div")
            results.append(SearchResult(
                title=anchor.get_text(" ", strip=True),
                url=url,
                snippet=description.get_text(" ", strip=True) if description else "",
            ))
        if results:
            break
        time.sleep(0.6)
    return results[:10]


def wikidata_official_sites(session: requests.Session, accounts: Iterable[dict]) -> dict[str, list[SearchResult]]:
    label_to_ids: dict[str, set[str]] = {}
    for account in accounts:
        for label in label_variants(account["name"]):
            label_to_ids.setdefault(label, set()).add(account["id"])
    values = " ".join(json.dumps(label, ensure_ascii=False) + "@en" for label in label_to_ids)
    query = f"""
SELECT DISTINCT ?queryLabel ?item ?website WHERE {{
  VALUES ?queryLabel {{ {values} }}
  ?item (rdfs:label|skos:altLabel) ?queryLabel;
        wdt:P856 ?website.
  {{ ?item wdt:P17 wd:Q17. }}
  UNION {{ ?item wdt:P495 wd:Q17. }}
  UNION {{ ?item wdt:P159/wdt:P17 wd:Q17. }}
}}
"""
    response = session.post(
        WIKIDATA_SPARQL_URL,
        data={"query": query, "format": "json"},
        headers={
            "User-Agent": "ACROHotTracker/1.0 github.com/tenltrist/acro-ai-hot-tracker",
            "Accept": "application/sparql-results+json",
        },
        timeout=90,
    )
    response.raise_for_status()
    result: dict[str, list[SearchResult]] = {}
    for binding in response.json().get("results", {}).get("bindings", []):
        label = binding.get("queryLabel", {}).get("value", "")
        website = binding.get("website", {}).get("value", "")
        if not website or is_blocked_url(website):
            continue
        for account_id in label_to_ids.get(label, set()):
            rows = result.setdefault(account_id, [])
            if website not in {row.url for row in rows}:
                rows.append(SearchResult(title=label, url=website, snippet="Wikidata P856 website candidate"))
    return result


def candidate_prefilter_score(name: str, result: SearchResult) -> int:
    title = normalized_name(result.title)
    snippet = normalized_name(result.snippet)
    stem = normalized_name(name)
    stem_compact = compact_name(stem)
    title_compact = compact_name(title)
    tokens = distinctive_tokens(name)
    host = host_key(result.url)
    score = 0
    if stem_compact and stem_compact in title_compact:
        score += 48
    else:
        score += round(sequence_score(stem, title) * 35)
    token_hits = sum(token in title.split() or token in snippet.split() for token in tokens)
    if tokens:
        score += round(22 * token_hits / len(tokens))
    host_hits = sum(token in host or host in token for token in tokens if len(token) >= 4)
    if host_hits:
        score += min(24, 12 + host_hits * 4)
    if any(marker in ascii_fold(result.title + " " + result.snippet) for marker in ("official", "公式", "corporate", "company")):
        score += 6
    return score


def decode_html(response: requests.Response) -> bytes:
    content_type = response.headers.get("content-type", "").lower()
    if "html" not in content_type and not response.content.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        raise ValueError(f"not_html:{content_type}")
    return response.content


def page_identity_score(name: str, result: SearchResult, page: OfficialPage | None, response_url: str, soup: BeautifulSoup) -> tuple[int, list[str]]:
    reasons = []
    score = candidate_prefilter_score(name, result)
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    meta_values = " ".join(
        node.get("content", "") for node in soup.select(
            'meta[name="description"], meta[property="og:site_name"], meta[property="og:title"]'
        )
    )
    headers = " ".join(node.get_text(" ", strip=True) for node in soup.select("h1, header")[:8])
    footer = " ".join(node.get_text(" ", strip=True) for node in soup.select("footer")[-2:])
    identity_text = " ".join((title, meta_values, headers, footer))
    name_compact = compact_name(name)
    identity_compact = compact_name(identity_text)
    body_compact = compact_name(soup.get_text(" ", strip=True)[:250_000])
    tokens = distinctive_tokens(name)
    if name_compact and name_compact in identity_compact:
        score += 42
        reasons.append("页面标题或页眉完整匹配账户名")
    elif name_compact and name_compact in body_compact:
        score += 26
        reasons.append("官网正文完整匹配账户名")
    else:
        similarity = max(sequence_score(name, title), sequence_score(name, identity_text[:1000]))
        score += round(similarity * 28)
        if similarity >= 0.62:
            reasons.append("页面身份名称与账户名高度相似")
    identity_words = set(words(identity_text))
    body_words = set(words(soup.get_text(" ", strip=True)[:120_000]))
    token_hits = sum(token in identity_words or token in body_words for token in tokens)
    if tokens and token_hits:
        score += round(18 * token_hits / len(tokens))
        reasons.append(f"页面命中 {token_hits}/{len(tokens)} 个身份词")
    host = host_key(response_url)
    host_hits = [token for token in tokens if len(token) >= 4 and (token in host or host in token)]
    if host_hits:
        score += min(18, 8 + len(host_hits) * 4)
        reasons.append("官方域名与账户身份词一致")
    if "ac.jp" in (urlsplit(response_url).hostname or "") and any(word in normalized_name(name) for word in ("university", "school", "institute")):
        score += 10
        reasons.append("日本高等教育机构域名")
    if "go.jp" in (urlsplit(response_url).hostname or "") and any(word in normalized_name(name) for word in ("ministry", "national", "institute")):
        score += 10
        reasons.append("日本政府机构域名")
    return score, reasons


def fetch_official_page(
    session: requests.Session,
    name: str,
    result: SearchResult,
    *,
    reviewed: bool = False,
) -> OfficialPage | None:
    if candidate_prefilter_score(name, result) < 28:
        return None
    try:
        response = get_limited(session, result.url, max_bytes=MAX_HTML_BYTES)
        content = decode_html(response)
    except (requests.RequestException, ValueError):
        return None
    soup = BeautifulSoup(content, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    # A profile page can repeat the queried company name while belonging to a
    # conference, investor or directory. Domain support is therefore a hard
    # boundary; unusual hosted sites are handled as explicit reviewed overrides.
    if not reviewed and not domain_supports_identity(name, response.url):
        return None
    score, reasons = page_identity_score(name, result, None, response.url, soup)
    if score < MIN_IDENTITY_SCORE and not reviewed:
        return None
    if reviewed:
        reasons.append("已由官网公司信息页直接核实身份")
    title = title or result.title
    return OfficialPage(
        requested_url=result.url,
        url=response.url,
        title=title,
        html=content,
        soup=soup,
        identity_score=score,
        identity_reasons=reasons,
    )


def element_context(node) -> str:
    values = []
    current = node
    for _ in range(4):
        if not current or not getattr(current, "attrs", None):
            break
        for key in ("id", "class", "role", "aria-label"):
            value = current.attrs.get(key, "")
            if isinstance(value, list):
                value = " ".join(value)
            values.append(str(value))
        values.append(getattr(current, "name", "") or "")
        current = current.parent
    return ascii_fold(" ".join(values))


def image_url_from_node(node) -> str:
    for key in ("src", "data-src", "data-lazy-src", "data-original", "href"):
        value = node.get(key)
        if value and not str(value).startswith("data:"):
            return str(value).strip()
    srcset = node.get("srcset") or node.get("data-srcset")
    if srcset:
        choices = [part.strip().split()[0] for part in str(srcset).split(",") if part.strip()]
        if choices:
            return choices[-1]
    return ""


def discover_logo_candidates(name: str, page: OfficialPage) -> list[ImageCandidate]:
    candidates: dict[str, ImageCandidate] = {}
    name_tokens = distinctive_tokens(name)
    for node in page.soup.select("img, source, object"):
        raw_url = image_url_from_node(node)
        if not raw_url:
            continue
        url = urljoin(page.url, raw_url)
        attrs = ascii_fold(" ".join(str(node.get(key, "")) for key in ("alt", "title", "id", "class", "src")))
        context = element_context(node)
        combined = f"{attrs} {context} {ascii_fold(url)}"
        site_chrome = any(signal in context for signal in ("header", "navbar", "global-nav", "footer"))
        image_path = ascii_fold(" ".join((urlsplit(url).path, urlsplit(url).query)))
        identity_match = any(token in attrs or token in image_path for token in name_tokens if len(token) >= 4)
        if not site_chrome and not identity_match:
            continue
        score = 0
        reasons = []
        if any(signal in ascii_fold(url) for signal in LOGO_SIGNALS):
            score += 38
            reasons.append("资源地址含 logo/brand 标识")
        if any(signal in attrs for signal in LOGO_SIGNALS):
            score += 42
            reasons.append("图片属性声明 logo/brand")
        if "header" in context or "navbar" in context or "global-nav" in context:
            score += 24
            reasons.append("位于官网页眉或主导航")
        if "footer" in context:
            score += 10
        token_hits = sum(token in combined for token in name_tokens if len(token) >= 4)
        if token_hits:
            score += min(28, 10 + token_hits * 6)
            reasons.append("图片属性匹配账户身份")
        if any(signal in combined for signal in NEGATIVE_IMAGE_SIGNALS) and not site_chrome:
            score -= 45
        if score < 42 or is_blocked_url(url):
            continue
        candidate = ImageCandidate(url=url, score=score, reasons=reasons, kind="official_website_logo")
        previous = candidates.get(url)
        if not previous or candidate.score > previous.score:
            candidates[url] = candidate

    for node in page.soup.select('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'):
        raw_url = node.get("href")
        if not raw_url:
            continue
        url = urljoin(page.url, raw_url)
        rel = " ".join(node.get("rel", [])) if isinstance(node.get("rel"), list) else str(node.get("rel", ""))
        score = 24 + (12 if "apple" in rel else 0) + (8 if "svg" in ascii_fold(url) else 0)
        candidates.setdefault(url, ImageCandidate(
            url=url,
            score=score,
            reasons=["官网页面声明的站点图标"],
            kind="official_site_icon",
        ))

    fallback_icon = urljoin(page.url, "/favicon.ico")
    candidates.setdefault(fallback_icon, ImageCandidate(
        url=fallback_icon,
        score=10,
        reasons=["官网根目录站点图标"],
        kind="official_site_icon",
    ))
    return sorted(candidates.values(), key=lambda item: (item.kind != "official_website_logo", -item.score))


def safe_svg(data: bytes) -> bool:
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return False
    if root.tag.split("}")[-1].lower() != "svg":
        return False
    for element in root.iter():
        if element.tag.split("}")[-1].lower() in {"script", "foreignobject"}:
            return False
        for key, value in element.attrib.items():
            if key.lower().startswith("on"):
                return False
            if key.split("}")[-1].lower() == "href" and value and not value.startswith("#"):
                embedded_raster = re.match(r"^data:image/(?:png|jpe?g|webp);base64,", value, re.I)
                if not embedded_raster:
                    return False
    return not bool(re.search(rb"@import|(?:url\(\s*['\"]?)(?:https?:|//)", data, re.I))


def raster_payload(data: bytes) -> tuple[bytes, str, str] | None:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception:
        return None
    if image.width < 16 or image.height < 16:
        return None
    image.thumbnail((360, 180), Image.Resampling.LANCZOS)
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getbbox() is None:
        return None
    visible = sum(1 for value in alpha.getdata() if value > 20)
    if visible < 20:
        return None
    visible_rgb = Image.new("RGB", rgba.size, "white")
    visible_rgb.paste(rgba, mask=alpha)
    extrema = ImageStat.Stat(visible_rgb).extrema
    if all(high - low < 4 for low, high in extrema):
        return None
    opaque_pixels = [pixel[:3] for pixel in rgba.getdata() if pixel[3] > 80]
    mean_luminance = 0
    if opaque_pixels:
        mean_luminance = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in opaque_pixels) / len(opaque_pixels)
    background = "dark" if mean_luminance > 238 else "light"
    output = io.BytesIO()
    rgba.save(output, format="PNG", optimize=True)
    return output.getvalue(), ".png", background


def validated_asset(response: requests.Response) -> tuple[bytes, str, str] | None:
    data = response.content
    content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    looks_svg = content_type == "image/svg+xml" or data.lstrip().startswith(b"<svg") or b"<svg" in data[:500]
    if looks_svg:
        start = data.find(b"<svg")
        svg = data[start:] if start >= 0 else data
        if len(svg) <= 500_000 and safe_svg(svg):
            lower = svg.lower()
            uses_white_ink = re.search(
                rb"(?:fill|stroke|color)\s*(?:=|:)\s*['\"]?(?:#fff(?:fff)?|white)\b",
                lower,
            )
            background = "dark" if uses_white_ink else "light"
            return svg, ".svg", background
        return None
    return raster_payload(data)


def fetch_best_asset(session: requests.Session, page: OfficialPage, name: str) -> tuple[ImageCandidate, requests.Response, bytes, str, str] | None:
    for candidate in discover_logo_candidates(name, page):
        if candidate.kind == "official_site_icon" and any(part in candidate.url for part in GENERIC_SITE_ICON_PARTS):
            continue
        try:
            response = get_limited(session, candidate.url, max_bytes=MAX_IMAGE_BYTES)
        except (requests.RequestException, ValueError):
            continue
        if candidate.kind == "official_site_icon" and any(part in response.url for part in GENERIC_SITE_ICON_PARTS):
            continue
        asset = validated_asset(response)
        if asset is None:
            continue
        data, suffix, background = asset
        return candidate, response, data, suffix, background
    return None


def fetch_reviewed_asset(
    session: requests.Session,
    page: OfficialPage,
    logo_url: str,
) -> tuple[ImageCandidate, requests.Response, bytes, str, str] | None:
    """Fetch a logo URL visually confirmed on the reviewed official page."""
    url = urljoin(page.url, logo_url)
    if is_blocked_url(url):
        return None
    try:
        response = get_limited(session, url, max_bytes=MAX_IMAGE_BYTES)
    except (requests.RequestException, ValueError):
        return None
    asset = validated_asset(response)
    if asset is None:
        return None
    data, suffix, background = asset
    candidate = ImageCandidate(
        url=url,
        score=200,
        reasons=["经浏览器渲染后在已核实官网页眉确认的 Logo"],
        kind="official_website_logo",
    )
    return candidate, response, data, suffix, background


def discover_account(
    session: requests.Session,
    account: dict,
    search_delay: float,
    seed_results: Iterable[SearchResult] = (),
    reviewed_override: dict | None = None,
) -> tuple[dict | None, dict]:
    name = account["name"]
    audit = {"id": account["id"], "name": name, "status": "unresolved", "reason": "official_site_not_found"}
    if reviewed_override and reviewed_override.get("unresolved_reason"):
        audit.update(
            reason=reviewed_override["unresolved_reason"],
            website=reviewed_override.get("website"),
            evidence_page=reviewed_override.get("evidence_page") or reviewed_override.get("website"),
            verification_note=reviewed_override.get("verification_note"),
        )
        return None, audit
    results = list(seed_results)
    if not results:
        try:
            results = search_official_sites(session, name)
        except requests.RequestException as error:
            audit.update(reason="search_unavailable", detail=str(error)[:240])
            return None, audit
    audit["search_result_count"] = len(results)
    if not results:
        return None, audit
    ranked = sorted(results, key=lambda result: candidate_prefilter_score(name, result), reverse=True)
    pages = []
    for result in ranked[:6]:
        page = fetch_official_page(session, name, result, reviewed=bool(reviewed_override))
        if page:
            pages.append(page)
        time.sleep(0.15)
    if not pages:
        audit.update(reason="official_site_identity_not_confirmed", candidates=[result.url for result in ranked[:4]])
        return None, audit
    page = max(pages, key=lambda item: item.identity_score)
    if reviewed_override and reviewed_override.get("no_graphic_logo"):
        audit.update(
            reason="official_site_text_only_identity",
            website=page.url,
            identity_score=page.identity_score,
            identity_reasons=page.identity_reasons,
        )
        return None, audit
    asset = None
    if reviewed_override and reviewed_override.get("logo_url"):
        asset = fetch_reviewed_asset(session, page, reviewed_override["logo_url"])
    if asset is None:
        asset = fetch_best_asset(session, page, name)
    if asset is None:
        audit.update(
            reason="official_site_no_usable_brand_asset",
            website=page.url,
            identity_score=page.identity_score,
            identity_reasons=page.identity_reasons,
        )
        return None, audit
    candidate, response, data, suffix, background = asset
    filename = f"{account['id']}{suffix}"
    record = {
        "account_name": name,
        "website": page.url,
        "source_url": candidate.url,
        "resolved_url": response.url,
        "asset": f"web/assets/company-logos/{filename}",
        "retrieved_at": date.today().isoformat(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "evidence_page": page.url,
        "source_kind": candidate.kind,
        "status": "available",
        "verification_method": "reviewed_official_page" if reviewed_override else "official_page_identity_match",
        "identity_score": page.identity_score,
        "identity_reasons": page.identity_reasons,
        "asset_reasons": candidate.reasons,
    }
    if reviewed_override and reviewed_override.get("verification_note"):
        record["verification_note"] = reviewed_override["verification_note"]
    if reviewed_override and reviewed_override.get("background") in {"light", "dark"}:
        record["background"] = reviewed_override["background"]
    if urlsplit(page.url).scheme == "http":
        record["transport_security"] = "http_only_official_site"
    if background == "dark" and "background" not in record:
        record["background"] = "dark"
    audit.update(
        status="available",
        source_kind=candidate.kind,
        website=page.url,
        source_url=candidate.url,
        identity_score=page.identity_score,
    )
    return {"record": record, "data": data, "filename": filename}, audit


def verified_logo_ids(manifest: dict) -> set[str]:
    values = {}
    values.update(manifest.get("companies", {}))
    values.update(manifest.get("accounts", {}))
    return {key for key, record in values.items() if record.get("status") == "available" and record.get("asset")}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write assets, manifest and account bindings")
    parser.add_argument("--limit", type=int, default=0, help="Maximum accounts to inspect; 0 means all")
    parser.add_argument("--offset", type=int, default=0, help="Skip this many eligible accounts")
    parser.add_argument("--delay", type=float, default=0.9, help="Delay between search requests")
    parser.add_argument("--refresh", action="store_true", help="Recheck accounts already backed by a verified asset")
    parser.add_argument(
        "--account-id",
        action="append",
        default=[],
        help="Inspect only this account id; may be supplied more than once",
    )
    parser.add_argument(
        "--only-unchecked",
        action="store_true",
        help="Inspect only accounts with no account-level audit record",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    accounts_config = json.loads(ACCOUNTS_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(LOGOS_PATH.read_text(encoding="utf-8"))
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8")) if OVERRIDES_PATH.exists() else {"accounts": {}}
    manifest.setdefault("accounts", {})
    known_logo_ids = verified_logo_ids(manifest)
    requested_ids = set(args.account_id)
    eligible = [
        account for account in accounts_config["accounts"]
        if (not requested_ids or account["id"] in requested_ids)
        and (args.refresh or account.get("logo_id") not in known_logo_ids)
        and (not args.only_unchecked or account["id"] not in manifest["accounts"])
    ]
    eligible = eligible[args.offset:]
    if args.limit:
        eligible = eligible[:args.limit]
    session = build_session()
    try:
        wikidata_candidates = wikidata_official_sites(session, eligible)
    except (requests.RequestException, ValueError, json.JSONDecodeError) as error:
        print(f"Wikidata discovery unavailable: {error}", flush=True)
        wikidata_candidates = {}
    for account in eligible:
        override = overrides.get("accounts", {}).get(account["id"])
        if override and override.get("website"):
            wikidata_candidates[account["id"]] = [SearchResult(
                title=account["name"],
                url=override["website"],
                snippet="Reviewed official website override",
            )]
    eligible.sort(key=lambda account: account["id"] not in wikidata_candidates)
    audits = []
    resolved = 0
    logo_count = 0
    icon_count = 0
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    if args.apply:
        for account_id, record in list(manifest["accounts"].items()):
            if record.get("reason") == "search_unavailable":
                manifest["accounts"].pop(account_id)
    print(f"Inspecting {len(eligible)} of {len(accounts_config['accounts'])} accounts", flush=True)
    consecutive_search_failures = 0
    processed = 0
    for index, account in enumerate(eligible, 1):
        print(f"[{index:03d}/{len(eligible):03d}] {account['name']}", end="", flush=True)
        result, audit = discover_account(
            session,
            account,
            args.delay,
            wikidata_candidates.get(account["id"], ()),
            overrides.get("accounts", {}).get(account["id"]),
        )
        audits.append(audit)
        processed += 1
        if audit.get("reason") == "search_unavailable":
            consecutive_search_failures += 1
            print(" -> deferred: search service unavailable", flush=True)
            if consecutive_search_failures >= 2:
                print("Search provider is rate-limited; stopping without marking remaining accounts unresolved.", flush=True)
                break
            time.sleep(max(3.0, args.delay * 3))
            continue
        consecutive_search_failures = 0
        if result:
            resolved += 1
            kind = result["record"]["source_kind"]
            logo_count += kind == "official_website_logo"
            icon_count += kind == "official_site_icon"
            print(f" -> {kind} ({result['record']['identity_score']})", flush=True)
            if args.apply:
                path = ASSET_DIR / result["filename"]
                path.write_bytes(result["data"])
                previous = manifest["accounts"].get(account["id"], {})
                previous_asset = previous.get("asset")
                if previous_asset and previous_asset != result["record"]["asset"]:
                    previous_path = ROOT / previous_asset
                    if previous_path.exists() and previous_path.is_relative_to(ASSET_DIR):
                        previous_path.unlink()
                manifest["accounts"][account["id"]] = result["record"]
                account["logo_id"] = account["id"]
                manifest["updated_at"] = date.today().isoformat()
                LOGOS_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                ACCOUNTS_PATH.write_text(json.dumps(accounts_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        else:
            print(f" -> unresolved: {audit['reason']}", flush=True)
            if args.apply:
                previous = manifest["accounts"].get(account["id"], {})
                previous_asset = previous.get("asset")
                if previous_asset:
                    previous_path = ROOT / previous_asset
                    if previous_path.exists() and previous_path.is_relative_to(ASSET_DIR):
                        previous_path.unlink()
                if account.get("logo_id") == account["id"]:
                    account.pop("logo_id", None)
                unresolved_record = {
                    "account_name": account["name"],
                    "status": "unresolved",
                    "reason": audit["reason"],
                    "note": {
                        "official_site_not_found": "公开搜索未找到可确认的独立官网。",
                        "official_site_identity_not_confirmed": "找到候选页面，但页面身份不足以唯一确认该账户。",
                        "official_site_no_usable_brand_asset": "官网身份已确认，但未找到可安全复用的 Logo 或站点图标。",
                        "official_site_text_only_identity": "官网身份已确认，但公开页面仅使用文字名称，未发布独立图形标识。",
                        "official_domain_unavailable_current": "已确认原官网域名，但该域名当前无法正常提供公司页面或品牌资产。",
                        "organization_inactive_no_current_official_site": "已确认该机构为历史主体，但目前没有可用的独立官网或品牌资产。",
                        "organization_merged_legacy_identity": "该账户对应历史机构，现已合并或更名；为避免冒用继任机构 Logo，保留文字标识。",
                        "official_parent_page_only": "仅找到母公司或关联方官网中的主体记录，未找到该账户独立发布的品牌资产。",
                        "official_identity_conflict": "同名候选官网与账户所在地或主体信息冲突，未绑定 Logo。",
                        "search_unavailable": "本轮搜索服务不可用，尚未完成核验。",
                    }.get(audit["reason"], "本轮未能完成官网标识核验。"),
                    "checked_at": date.today().isoformat(),
                }
                for field in (
                    "website",
                    "evidence_page",
                    "verification_note",
                    "identity_score",
                    "identity_reasons",
                    "candidates",
                ):
                    if audit.get(field):
                        unresolved_record[field] = audit[field]
                manifest["accounts"][account["id"]] = unresolved_record
                manifest["updated_at"] = date.today().isoformat()
                LOGOS_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                ACCOUNTS_PATH.write_text(json.dumps(accounts_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        time.sleep(max(0.0, args.delay))

    verified_after = verified_logo_ids(manifest)
    account_level_records = manifest.get("accounts", {})
    unresolved_reason_counts = {}
    for account in accounts_config["accounts"]:
        if account.get("logo_id") in verified_after:
            continue
        reason = account_level_records.get(account["id"], {}).get("reason", "unchecked")
        unresolved_reason_counts[reason] = unresolved_reason_counts.get(reason, 0) + 1
    report = {
        "generated_at": date.today().isoformat(),
        "applied": args.apply,
        "eligible": len(eligible),
        "inspected": processed,
        "resolved": resolved,
        "official_website_logo": logo_count,
        "official_site_icon": icon_count,
        "unresolved": sum(record.get("status") == "unresolved" for record in audits),
        "inventory": {
            "total_accounts": len(accounts_config["accounts"]),
            "accounts_with_verified_asset": sum(
                account.get("logo_id") in verified_after for account in accounts_config["accounts"]
            ),
            "accounts_without_graphic_asset": sum(unresolved_reason_counts.values()),
            "unresolved_reason_counts": unresolved_reason_counts,
        },
        "records": audits,
    }
    if args.apply:
        REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in report if key != "records"}, ensure_ascii=False), flush=True)
    return 0 if resolved or not eligible else 2


if __name__ == "__main__":
    sys.exit(main())
