#!/usr/bin/env python3
"""Read official identity pages into a review queue without changing live data."""
import argparse
import concurrent.futures
import hashlib
import json
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup

LOCAL = threading.local()


def session():
    if not hasattr(LOCAL, "session"):
        LOCAL.session = requests.Session()
        LOCAL.session.headers.update({"User-Agent": "ACROMarketIntelligence/1.0 (public company profile verification)", "Accept-Language": "ja,en;q=0.8"})
    return LOCAL.session


def fetch(url):
    response = session().get(url, timeout=(6, 12), stream=True)
    status = response.status_code
    content = bytearray()
    for chunk in response.iter_content(32768):
        content.extend(chunk)
        if len(content) > 2_000_000:
            break
    if status != 200:
        return {"url": response.url, "status": status, "error": f"HTTP {status}"}
    soup = BeautifulSoup(bytes(content), "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    description = next((tag.get("content", "") for tag in soup.select('meta[name="description"], meta[property="og:description"]') if tag.get("content")), "")
    jsonld = []
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            value = json.loads(tag.string or tag.get_text())
            jsonld.append(value)
        except (ValueError, TypeError):
            pass
    links = []
    for tag in soup.select("a[href]"):
        label = tag.get_text(" ", strip=True)
        href = urljoin(response.url, tag["href"])
        if urlsplit(href).scheme in {"https", "http"} and re.search(r"会社概要|会社情報|企業情報|corporate profile|company profile|about us|日本語|japanese", label, re.I) and len(label) < 65:
            links.append({"label": label, "url": href})
    logos = []
    for tag in soup.select("img[src]"):
        parent_logo = tag.find_parent(lambda parent: "logo" in " ".join(str(parent.get(key, "")) for key in ("id", "class")).lower())
        if parent_logo or "logo" in " ".join(str(tag.get(k, "")) for k in ("src", "alt", "class", "id")).lower():
            logos.append({"url": urljoin(response.url, tag["src"]), "alt": tag.get("alt", "")})
    metadata_image = soup.select_one('meta[property="og:image"]')
    if metadata_image and "logo" in metadata_image.get("content", "").lower():
        logos.append({"url": urljoin(response.url, metadata_image["content"]), "alt": "official page metadata logo"})
    header_images = [{"url": urljoin(response.url, tag["src"]), "alt": tag.get("alt", "")} for tag in soup.select("header img[src], #header img[src]")][:8]
    for tag in soup.select("script,style,noscript,svg"):
        tag.decompose()
    lines = [re.sub(r"\s+", " ", text).strip() for text in soup.stripped_strings]
    lines = [line for line in lines if line and len(line) < 600]
    japanese_names = list(dict.fromkeys(line for line in lines if re.search(r"株式会社|大学|合同会社|医療法人|有限会社|学校法人", line) and len(line) < 100))[:14]
    snippets = []
    for index, line in enumerate(lines):
        if re.search(r"会社名|商号|事業内容|Company Name|Corporate Name|Business Activities|Company Profile|事業概要", line, re.I):
            snippets.append(" / ".join(lines[max(0, index - 1):index + 5]))
    main = soup.select_one("main, article, #main, #content") or soup.body or soup
    visible_text = main.get_text(" ", strip=True)[:10000]
    return {"url": response.url, "status": status, "title": title, "description": description, "visible_text": visible_text, "japanese_names": japanese_names, "profile_snippets": snippets[:12], "links": list({link["url"]: link for link in links}.values())[:20], "logo_candidates": logos[:12], "header_images": header_images, "jsonld": jsonld[:3], "sha256": hashlib.sha256(content).hexdigest()}


def probe(record):
    result = {**record, "checked_at": datetime.now(timezone.utc).isoformat(), "pages": []}
    url = record.get("website")
    if not url:
        result["error"] = "No known official website"
        return result
    try:
        first = fetch(url)
        result["pages"].append(first)
        candidate = next((link for link in first.get("links", []) if re.search(r"会社概要|会社情報|企業情報|company profile|corporate profile", link["label"], re.I) and link["url"] != first["url"]), None)
        if not candidate:
            candidate = next((link for link in first.get("links", []) if re.search(r"日本語|japanese", link["label"], re.I) and link["url"] != first["url"]), None)
        if candidate:
            result["pages"].append(fetch(candidate["url"]))
    except requests.RequestException as error:
        result["error"] = str(error).split("(Caused by")[0][:240]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    args = parser.parse_args()
    records = json.loads(Path(args.input).read_text())
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(probe, record): record["id"] for record in records}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            if len(results) % 20 == 0:
                print(f"Checked {len(results)}/{len(records)}", flush=True)
                Path(args.output).write_text(json.dumps(results, ensure_ascii=False, indent=2))
    Path(args.output).write_text(json.dumps(sorted(results, key=lambda result: result["id"]), ensure_ascii=False, indent=2))
    print(json.dumps({"checked": len(results), "with_page": sum(any(page.get("status") == 200 for page in record["pages"]) for record in results)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
