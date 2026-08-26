#!/usr/bin/env python3
"""Create a public-safe Japan account directory from the sales workbook.

The workbook's private relationship field is validated during import but is
never written to the public dashboard configuration.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "config" / "japan_accounts.json"
SHEET_NAME = "日本客户列表"
NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}

PUBLIC_CLIENT_CATALOG = (
    "https://www.fishersci.co.uk/content/dam/fssite/eu/brands/a/acrobiosystems/"
    "27808_Product_Catalogue_flyer.pdf"
)
PUBLIC_RELATIONSHIP_MARKERS = {
    "takeda": "Takeda Pharmaceutical",
    "astellas": "Astellas Pharma",
    "daiichi sankyo": "Daiichi Sankyo",
    "eisai": "Eisai",
}

ORGANIZATION_LABELS = {
    "pharma_biotech": "制药与生命科学",
    "academic_research": "高校与学术研究",
    "hospital_clinical": "医院与临床机构",
    "public_research": "公共与国家研究机构",
    "channel_service": "渠道与专业服务",
    "industrial_other": "其他产业机构",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path, help="Path to Global Data-日本客户列表.xlsx")
    parser.add_argument(
        "--private-status-column",
        required=True,
        help="Name of the private 0/1 relationship-status column; values are validated but never exported",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference.upper())
    if not letters:
        return 0
    value = 0
    for character in letters.group(0):
        value = value * 26 + ord(character) - 64
    return value - 1


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(node.itertext()) for node in root.findall("main:si", NS)]


def worksheet_path(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall("rel:Relationship", REL_NS)
    }
    relationship_key = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        if sheet.attrib.get("name") != sheet_name:
            continue
        target = targets[sheet.attrib[relationship_key]].lstrip("/")
        return target if target.startswith("xl/") else f"xl/{target}"
    raise ValueError(f"worksheet not found: {sheet_name}")


def read_rows(path: Path, sheet_name: str) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        root = ET.fromstring(archive.read(worksheet_path(archive, sheet_name)))
    rows: list[list[str]] = []
    for row in root.findall("main:sheetData/main:row", NS):
        values: dict[int, str] = {}
        for cell in row.findall("main:c", NS):
            index = column_index(cell.attrib.get("r", "A1"))
            cell_type = cell.attrib.get("t")
            if cell_type == "inlineStr":
                value = "".join(cell.itertext())
            else:
                raw = cell.findtext("main:v", default="", namespaces=NS)
                value = strings[int(raw)] if cell_type == "s" and raw else raw
            values[index] = value.strip()
        if values:
            rows.append([values.get(index, "") for index in range(max(values) + 1)])
    return rows


def normalize_name(value: str) -> str:
    value = value.casefold().replace("＆", "&")
    value = re.sub(r"[‐‑‒–—]", "-", value)
    value = re.sub(r"[^a-z0-9一-龥ぁ-ヿ&+]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def organization_type(name: str) -> str:
    text = normalize_name(name)
    if re.search(r"hospital|clinic|medical center|cancer center|医療|病院|クリニック", text):
        return "hospital_clinical"
    if re.search(r"university|college|school of|大学|学園", text):
        return "academic_research"
    if re.search(r"riken|national institute|national center|ministry|prefectural institute|独立行政|国立|省|庁", text):
        return "public_research"
    if re.search(r"research institute|research center|研究所|研究センター|academy", text):
        return "academic_research"
    if re.search(r"trading|distribution|distributor|commerce|logistics|consult|商事|販売|サービス", text):
        return "channel_service"
    if re.search(
        r"pharma|pharmaceutical|therap|biotech|biological|bioscience|bio |bios |"
        r"cell|gene|genom|vaccine|vax|medicine|medical|med |drug|molecular|"
        r"immun|protein|proteom|pep|rna|oligo|onco|cure|health|stem|cord|"
        r"theranostic|metabo|glytech|science|製薬|薬品|バイオ|細胞|遺伝子",
        text,
    ):
        return "pharma_biotech"
    return "industrial_other"


def public_relationship(name: str) -> dict[str, Any] | None:
    text = normalize_name(name)
    matched = next((label for marker, label in PUBLIC_RELATIONSHIP_MARKERS.items() if marker in text), None)
    if not matched:
        return None
    return {
        "label": "公开关系已找到",
        "summary": f"ACROBiosystems 公开产品目录将 {matched} 列入 Global Top Pharmaceuticals 客户示例。",
        "source_title": "ACROBiosystems Product Catalog - Our Clients",
        "source_url": PUBLIC_CLIENT_CATALOG,
        "evidence_kind": "official_catalog",
    }


def make_account(name: str, headquarters: str) -> dict[str, Any]:
    relation = public_relationship(name)
    kind = "pharma_biotech" if relation else organization_type(name)
    account = {
        "id": f"jp-account-{hashlib.sha1(normalize_name(name).encode('utf-8')).hexdigest()[:10]}",
        "name": name,
        "headquarters": headquarters or "Japan",
        "region": "Japan",
        "country": "Japan",
        "organization_type": kind,
        "organization_label": ORGANIZATION_LABELS[kind],
        "account_stage": "public_relationship" if relation else "market_account",
        "account_stage_label": "公开关系" if relation else "市场账户",
        "identity_status": "listed",
    }
    if relation:
        account["public_evidence"] = [relation]
    return account


def main() -> int:
    args = parse_args()
    rows = read_rows(args.workbook, SHEET_NAME)
    if not rows:
        raise ValueError("workbook is empty")
    headers = rows[0]
    required = ["UniName", "ParentHeadquarters", args.private_status_column]
    missing = [header for header in required if header not in headers]
    if missing:
        raise ValueError(f"missing columns: {', '.join(missing)}")
    positions = {header: headers.index(header) for header in required}

    accounts: list[dict[str, Any]] = []
    seen: set[str] = set()
    private_status_counts: Counter[str] = Counter()
    duplicate_count = 0
    for source_row, row in enumerate(rows[1:], start=2):
        value = lambda key: row[positions[key]].strip() if positions[key] < len(row) else ""
        name = value("UniName")
        if not name:
            continue
        private_status = value(args.private_status_column)
        if private_status not in {"0", "1"}:
            raise ValueError(f"row {source_row}: private relationship status must be 0 or 1")
        private_status_counts[private_status] += 1
        key = normalize_name(name)
        if key in seen:
            duplicate_count += 1
            continue
        seen.add(key)
        accounts.append(make_account(name, value("ParentHeadquarters")))

    accounts.sort(key=lambda account: (account["account_stage"] != "public_relationship", account["name"].casefold()))
    organization_mix = Counter(account["organization_type"] for account in accounts)
    stage_mix = Counter(account["account_stage"] for account in accounts)
    payload = {
        "version": 2,
        "imported_at": "2026-08-25",
        "source": f"{args.workbook.name} / {SHEET_NAME}（公开展示版）",
        "semantics": "这是日本市场账户目录，不自动等于已成交客户。公开页面只显示公开可验证关系与外部动态，销售内部状态不发布。",
        "privacy_note": "源表中的内部销售状态不会写入公开配置或 GitHub Pages。",
        "import_summary": {
            "source_rows": sum(private_status_counts.values()),
            "unique_accounts": len(accounts),
            "duplicate_rows_merged": duplicate_count,
            "public_relationships": stage_mix["public_relationship"],
        },
        "organization_type_mix": dict(sorted(organization_mix.items())),
        "account_stage_mix": dict(sorted(stage_mix.items())),
        "accounts": accounts,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(accounts)} public-safe accounts to {args.output}")
    print(f"Validated private statuses in memory: {dict(sorted(private_status_counts.items()))}; none were exported")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
