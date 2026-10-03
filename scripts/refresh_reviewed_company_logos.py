#!/usr/bin/env python3
"""Cache only explicitly reviewed official images; never invent replacements."""
import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image
from enrich_account_logos import validated_asset

ROOT = Path(__file__).resolve().parents[1]


def reviewed_asset(response):
    asset = validated_asset(response)
    if asset:
        return asset
    # White wordmarks need a dark display surface, not rejection as blank images.
    try:
        image = Image.open(io.BytesIO(response.content)).convert("RGBA")
        pixels = [pixel for pixel in image.getdata() if pixel[3] > 80]
        if image.width >= 16 and image.height >= 16 and image.getchannel("A").getextrema()[0] < 80 and len(pixels) > 20 and all(min(pixel[:3]) > 235 for pixel in pixels):
            output = io.BytesIO()
            image.save(output, format="PNG")
            return output.getvalue(), ".png", "dark"
    except (OSError, ValueError):
        pass
    return None
REVIEWED = {
    "rd_systems": ("https://www.rndsystems.com/", "https://resources.rndsystems.com/images/logos/rnd_500.png", "official_website_logo"),
    "jp-account-a1ca845874": ("https://www.cira.kyoto-u.ac.jp/", "https://www.cira.kyoto-u.ac.jp/common/img/header/header_logo.svg", "official_website_logo"),
    "jp-account-b20e945eeb": ("https://www.biken.or.jp/about/biken_co/", "https://www.biken.or.jp/common/img/logo.svg", "official_group_logo"),
    "jp-account-c058ffe5bc": ("https://www.jihs.go.jp/", "https://www.jihs.go.jp/assets/img/common/logo.png", "official_website_logo"),
    "jp-account-09810019e5": ("https://www.nobelpharma.co.jp/", "https://www.nobelpharma.co.jp/assets/images/common/logo.png", "official_website_logo"),
    "jp-account-c684d2d966": ("https://www.onodera-gtp.com/", "https://www.onodera-gtp.com/img/common/logo.svg", "official_website_logo"),
    "jp-account-4753704e5c": ("https://onodera-medical.co.jp/company/about/", "https://onodera-medical.co.jp/wp/wp-content/uploads/2022/05/logo.svg", "official_website_logo"),
    "jp-account-89cf2527b9": ("https://h.kawasaki-m.ac.jp/", "https://h.kawasaki-m.ac.jp/img/header_logo.png", "official_website_logo"),
    "jp-account-bfea1e18b5": ("https://www.jikei.ac.jp/", "https://www.jikei.ac.jp/wp-content/themes/twentytwentyone_child/images/common/logo.png", "official_group_logo"),
    "jp-account-75dc94e8d2": ("https://rinmab.co.jp/company", "https://rinmab.co.jp/wp/wp-content/themes/rinmab/images/common/logo.png", "official_website_logo"),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("baseline", help="Verified deployed logo manifest downloaded read-only")
    parser.add_argument("--ids", nargs="+", help="Refresh only these reviewed identities")
    parser.add_argument("--review-config", type=Path, help="Additional explicitly reviewed image URLs")
    args = parser.parse_args()
    target = ROOT / "config/company_logos.json"
    existing = json.loads(target.read_text())
    baseline = json.loads(Path(args.baseline).read_text())
    for group in ("companies", "accounts"):
        existing[group] = {**baseline.get(group, {}), **existing.get(group, {})}
    report = []
    reviewed = dict(REVIEWED)
    if args.review_config:
        reviewed.update({identity: (row[0], row[1], "official_website_logo") for identity, row in json.loads(args.review_config.read_text()).items()})
    session = requests.Session()
    session.headers["User-Agent"] = "ACROMarketIntelligence/1.0 (official brand verification)"
    for identity, (website, url, kind) in reviewed.items():
        if args.ids and identity not in args.ids:
            continue
        try:
            response = session.get(url, timeout=(8, 15))
            response.raise_for_status()
            asset = reviewed_asset(response)
            if not asset:
                raise ValueError("Image validation failed")
            data, suffix, background = asset
            path = ROOT / f"web/assets/company-logos/{identity}-verified{suffix}"
            path.write_bytes(data)
            group = "accounts" if identity.startswith("jp-account-") else "companies"
            existing[group][identity] = {
                "status": "available", "website": website, "evidence_page": website,
                "source_url": url, "resolved_url": response.url, "source_kind": kind,
                "asset": str(path.relative_to(ROOT)), "background": background,
                "sha256": hashlib.sha256(data).hexdigest(),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "verification_note": "本轮逐页核对的官方页眉品牌图片；集团共用标识单独标注。",
            }
            report.append({"id": identity, "status": "available", "source_url": url})
        except (requests.RequestException, ValueError) as error:
            report.append({"id": identity, "status": "failed", "error": str(error)[:240]})
    existing["updated_at"] = datetime.now(timezone.utc).isoformat()
    target.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n")
    output = ROOT / "reports/company-brand-refresh.json"
    earlier = json.loads(output.read_text()) if output.exists() else []
    refreshed = {row["id"]: row for row in earlier}
    refreshed.update({row["id"]: row for row in report})
    output.write_text(json.dumps(list(refreshed.values()), ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
