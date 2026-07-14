#!/usr/bin/env python3
"""Build an Obsidian Excalidraw mind map for the AI Hot Tracker discussion."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path


VAULT_EXCALIDRAW = Path(
    "/Users/trist/Library/Mobile Documents/iCloud~md~obsidian/Documents/自我认知记录/Excalidraw"
)
OUT_BASENAME = "AI Hot Tracker 讨论思维导图"
OUT_EXCALIDRAW = VAULT_EXCALIDRAW / f"{OUT_BASENAME}.excalidraw"
OUT_MD = VAULT_EXCALIDRAW / f"{OUT_BASENAME}.excalidraw.md"

random.seed(20260707)

COLORS = {
    "canvas": "#FFFFFF",
    "ink": "#1E2A30",
    "muted": "#56636D",
    "blue_bg": "#DDE7ED",
    "blue": "#3D6A82",
    "green_bg": "#E2EDDF",
    "green": "#3A6B42",
    "yellow_bg": "#F5F0DC",
    "yellow": "#7A6020",
    "rose_bg": "#F2E8E6",
    "rose": "#8F3F3A",
    "line": "#B8C4CC",
    "gold": "#B8882A",
}


def eid() -> str:
    return "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(20))


def base(x: float, y: float, w: float, h: float) -> dict:
    return {
        "id": eid(),
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "seed": random.randint(1, 2_000_000_000),
        "version": 1,
        "versionNonce": random.randint(1, 2_000_000_000),
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False,
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 3},
    }


def rect(x: float, y: float, w: float, h: float, bg: str, stroke: str, r: int = 3) -> dict:
    e = base(x, y, w, h)
    e.update(
        {
            "type": "rectangle",
            "strokeColor": stroke,
            "backgroundColor": bg,
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "roundness": {"type": r},
        }
    )
    return e


def text(x: float, y: float, value: str, size: int, color: str, w: float, align: str = "left") -> dict:
    lines = value.split("\n")
    h = max(size * 1.28 * len(lines), size + 8)
    e = base(x, y, w, h)
    e.update(
        {
            "type": "text",
            "strokeColor": color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "text": value,
            "fontSize": size,
            "fontFamily": 1,
            "textAlign": align,
            "verticalAlign": "top",
            "baseline": math.ceil(h * 0.8),
            "containerId": None,
            "originalText": value,
            "lineHeight": 1.25,
        }
    )
    return e


def arrow(x1: float, y1: float, x2: float, y2: float, color: str = COLORS["line"]) -> dict:
    e = base(x1, y1, x2 - x1, y2 - y1)
    e.update(
        {
            "type": "arrow",
            "strokeColor": color,
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 90,
            "startBinding": None,
            "endBinding": None,
            "lastCommittedPoint": None,
            "startArrowhead": None,
            "endArrowhead": "arrow",
            "points": [[0, 0], [x2 - x1, y2 - y1]],
        }
    )
    return e


def card(elements: list[dict], x: int, y: int, w: int, h: int, title: str, bullets: list[str], bg: str, stroke: str) -> None:
    elements.append(rect(x, y, w, h, bg, stroke))
    elements.append(text(x + 18, y + 16, title, 22, stroke, w - 36))
    body = "\n".join(f"• {b}" for b in bullets)
    elements.append(text(x + 18, y + 58, body, 16, COLORS["ink"], w - 36))


def small_option(elements: list[dict], x: int, y: int, label: str, kind: str, bg: str, stroke: str) -> None:
    elements.append(rect(x, y, 210, 48, bg, stroke))
    elements.append(text(x + 14, y + 10, f"{kind} {label}", 15, COLORS["ink"], 182))


def build() -> list[dict]:
    elements: list[dict] = []
    elements.append(text(60, 40, "AI Hot Tracker 讨论思维导图", 34, COLORS["ink"], 960))
    elements.append(text(62, 88, "目标：拿这张图和需求方确认「热点新闻平台」到底要做成什么", 18, COLORS["muted"], 980))

    center_x, center_y, center_w, center_h = 520, 170, 420, 190
    elements.append(rect(center_x, center_y, center_w, center_h, "#FFFFFF", COLORS["gold"]))
    elements.append(text(center_x + 26, center_y + 26, "核心问题", 26, COLORS["gold"], center_w - 52, "center"))
    elements.append(
        text(
            center_x + 34,
            center_y + 76,
            "不是「看到新闻就推送」\n而是「目标公司 + 行业主题 + 竞品动态」\n经过筛选后进入 dashboard / 日报 / 提醒",
            18,
            COLORS["ink"],
            center_w - 68,
            "center",
        )
    )

    modules = [
        (
            60,
            190,
            "1. 使用对象",
            ["已确认：市场部工作辅助", "已确认：老板需要 dashboard", "待确认：第一优先用户是谁"],
            COLORS["blue_bg"],
            COLORS["blue"],
        ),
        (
            60,
            470,
            "2. 监控对象",
            ["已确认：先用 ACRO 做标本", "已加入：Thermo Fisher", "待确认：休假前公司名单能否公开"],
            COLORS["green_bg"],
            COLORS["green"],
        ),
        (
            520,
            470,
            "3. 信息来源",
            ["官网 / 官方 RSS", "Google News RSS / PR wire", "待确认：是否允许付费 API"],
            COLORS["yellow_bg"],
            COLORS["yellow"],
        ),
        (
            980,
            190,
            "4. 筛选机制",
            ["公司别名 + 主题关键词", "业务动作 + 噪音词扣分", "待确认：什么算重要"],
            COLORS["rose_bg"],
            COLORS["rose"],
        ),
        (
            980,
            470,
            "5. 输出形态",
            ["精选流 / 全部动态", "日报 / 静态 API", "待确认：是否要 Excel / 邮件 / PPT"],
            COLORS["blue_bg"],
            COLORS["blue"],
        ),
        (
            520,
            750,
            "6. 更新与推送",
            ["当前假设：工作日 09:00 日报", "高价值事件才即时提醒", "待确认：渠道和频率"],
            COLORS["green_bg"],
            COLORS["green"],
        ),
    ]

    for x, y, title, bullets, bg, stroke in modules:
        card(elements, x, y, 360, 190, title, bullets, bg, stroke)

    arrow_pairs = [
        (420, 285, center_x, center_y + 95),
        (940, center_y + 95, 980, 285),
        (240, 470, center_x + 80, center_y + center_h),
        (700, 470, center_x + center_w / 2, center_y + center_h),
        (980, 560, center_x + center_w, center_y + center_h - 20),
        (700, 750, center_x + center_w / 2, center_y + center_h),
    ]
    for x1, y1, x2, y2 in arrow_pairs:
        elements.append(arrow(x1, y1, x2, y2))

    elements.append(text(60, 1010, "每个环节的可选方案", 28, COLORS["ink"], 460))
    option_y = 1070
    option_blocks = [
        ("使用对象", ["市场部执行", "市场负责人", "老板总览"], COLORS["blue_bg"], COLORS["blue"]),
        ("监控范围", ["公司自身新闻", "竞品动态", "行业主题"], COLORS["green_bg"], COLORS["green"]),
        ("更新频率", ["每日一次", "每日两次", "重大事件即时"], COLORS["yellow_bg"], COLORS["yellow"]),
        ("输出方式", ["Dashboard", "日报", "API / Agent"], COLORS["rose_bg"], COLORS["rose"]),
        ("部署权限", ["公开样本", "内部版", "权限登录"], COLORS["blue_bg"], COLORS["blue"]),
    ]
    for row, (title, opts, bg, stroke) in enumerate(option_blocks):
        y = option_y + row * 80
        elements.append(text(70, y + 12, title, 18, stroke, 150))
        for col, opt in enumerate(opts):
            small_option(elements, 230 + col * 240, y, opt, "可选", bg, stroke)

    card(
        elements,
        980,
        1010,
        360,
        290,
        "带去问对方的 5 组问题",
        [
            "目标：平台 / 情报 / 选题 / 看板？",
            "范围：哪些公司和主题？",
            "价值：什么推送，什么归档？",
            "频率：日报还是实时？",
            "权限：公开还是内部？",
        ],
        COLORS["yellow_bg"],
        COLORS["yellow"],
    )

    elements.append(text(62, 1380, "阅读顺序：先看中心问题 → 六个环节 → 每环可选方案 → 最右下角问题清单", 18, COLORS["muted"], 1180))
    return elements


def build_payload() -> dict:
    return {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": build(),
        "appState": {
            "gridSize": None,
            "viewBackgroundColor": COLORS["canvas"],
            "currentItemStrokeColor": COLORS["ink"],
            "currentItemBackgroundColor": "transparent",
        },
        "files": {},
    }


def main() -> int:
    payload = build_payload()
    VAULT_EXCALIDRAW.mkdir(parents=True, exist_ok=True)
    OUT_EXCALIDRAW.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md = "\n".join(
        [
            "---",
            "excalidraw-plugin: parsed",
            "tags: [excalidraw, AIHotTracker, PRD]",
            "---",
            "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==",
            "",
            "# Text Elements",
            "AI Hot Tracker 讨论思维导图",
            "",
            "%%",
            "# Drawing",
            "```json",
            json.dumps(payload, ensure_ascii=False, indent=2),
            "```",
            "%%",
            "",
        ]
    )
    OUT_MD.write_text(md, encoding="utf-8")
    print(OUT_MD)
    print(OUT_EXCALIDRAW)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
