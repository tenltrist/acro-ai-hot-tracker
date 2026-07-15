# AI Hot Tracker 公司数据源档案模板

## 目录

- [1. 使用原则](#1-使用原则)
- [2. 完整数据源档案包括什么](#2-完整数据源档案包括什么)
- [3. 来源启用状态](#3-来源启用状态)
- [4. 可信等级](#4-可信等级)
- [5. 抓取/获取方式](#5-抓取获取方式)
- [6. 公司基础信息](#6-公司基础信息)
- [7. 单个数据源记录字段](#7-单个数据源记录字段)
- [8. 数据源候选池](#8-数据源候选池)
- [9. ACRO / 百普赛斯第一版完整档案](#9-acro--百普赛斯第一版完整档案)
- [10. MVP 与完整档案的关系](#10-mvp-与完整档案的关系)
- [11. 本周 Demo 的数据源边界](#11-本周-demo-的数据源边界)

## 1. 使用原则

这份档案是“情报地图”，不是“自动抓取清单”。

第一阶段要把每家公司可能相关的信息入口尽量记录完整，包括官网、RSS、新闻稿平台、行业媒体、LinkedIn、微信公众号、视频平台、展会、招聘、专利、论文、数据库、登录平台和反爬严重网站。但是否进入程序自动抓取，需要单独用 `启用状态` 判断。

MVP 阶段只优先启用公开、低成本、低风险、稳定性相对高的数据源。高价值但不稳定、需要登录、反爬严重或可能涉及版权/合规问题的来源，先记录在档案里，后续再评估人工、半自动、API 或付费方式。

## 2. 完整数据源档案包括什么

每家公司都应该先做一份完整档案。完整档案不是只看“现在能不能爬”，而是先把这家公司所有可能产生业务信号的位置列出来，再按状态决定是否进入 MVP。

| 模块 | 要记录的内容 | 第一阶段处理 |
| --- | --- | --- |
| 公司基础信息 | 公司名、别名、本地语言名称、官网、区域、业务线、战略主题、噪音词 | 必填 |
| 官方自有来源 | 官网 News、Press Release、IR、Events、Webinar、Blog、Resource、Product News | 优先评估 |
| 新闻稿与行业媒体 | PR Newswire、Business Wire、GlobeNewswire、BioSpace、Fierce、GEN、日文/中文行业媒体 | 优先评估 RSS 或 Google News site 查询 |
| 聚合搜索来源 | Google News RSS、区域 Google News、site 定向搜索、Bing News、GDELT | MVP 可用 Google News RSS |
| 社交与内容平台 | LinkedIn、微信公众号、X、YouTube、Bilibili、Facebook、Instagram | 先记录，通常不自动抓 |
| 市场活动与渠道 | 展会官网、Webinar 平台、经销商新闻、合作伙伴新闻、客户案例 | 先记录，重要来源可人工复核 |
| 研发与监管信号 | PubMed、Google Scholar、ClinicalTrials.gov、jRCT、EU CTIS、专利、FDA、EMA、PMDA | 后续模块化接入 |
| 商业与组织信号 | 招聘网站、财报、SEC、EDINET、招投标、供应商/客户公告 | 先记录，后续按价值接入 |
| 高风险来源 | 需要登录的平台、反爬严重网站、付费墙、私域群聊、个人账号、robots 限制路径 | 不进入 MVP 自动抓取 |
| 付费候选来源 | 新闻 API、商业数据库、企业情报平台、LinkedIn 官方 API、微信生态监控服务 | 标记为 `paid_later` |
| 人工入口 | 重要但无法自动抓取的链接、人工补充新闻、手动复核结果 | MVP 可保留 |

完整档案的核心判断不是“能不能一次性全部自动化”，而是：

1. 这个来源可能提供什么信号。
2. 这个信号对市场部/老板有没有业务价值。
3. 这个来源是否公开、稳定、低成本。
4. 自动抓取是否有合规、版权、登录、反爬或维护风险。
5. 当前应该 `enabled`、`trial`、`watchlist`、`manual`、`blocked` 还是 `paid_later`。

## 3. 来源启用状态

| 状态 | 含义 | MVP 是否自动抓取 |
| --- | --- | --- |
| `enabled` | 已确认可抓，进入当前自动化流程 | 是 |
| `backup` | 已验证可用，仅在主来源未覆盖时补漏 | 是，需跨源去重 |
| `trial` | 可以尝试抓取，但需要观察稳定性、误报和失败率 | 可试运行 |
| `watchlist` | 有情报价值，但当前只记录，不自动抓 | 否 |
| `blocked` | 当前不抓取，通常因为登录、权限、反爬、合规或版权风险 | 否 |
| `paid_later` | 后续可通过付费 API、数据库或商业服务接入 | 否 |
| `manual` | 适合人工定期查看或人工录入 | 否 |

## 4. 可信等级

| 等级 | 来源类型 | 判断 |
| --- | --- | --- |
| `A` | 公司官方来源、官方 RSS、IR / Press Release | 可信度最高，适合优先展示 |
| `B` | 新闻稿平台、权威行业媒体、展会主办方 | 可信度较高，需要去重 |
| `C` | Google News、Bing News 等聚合源 | 覆盖广，但噪音和漂移较高 |
| `D` | 社交媒体、视频平台、招聘平台、合作伙伴转载 | 有信号价值，但需要复核 |
| `E` | 论坛、个人账号、低质量转载、SEO 页面 | 默认只归档或不接入 |

## 5. 抓取/获取方式

| 方式 | 适用来源 | MVP 建议 |
| --- | --- | --- |
| `rss` | 官方 RSS、新闻稿 RSS、媒体 RSS、Google News RSS | MVP 首选 |
| `html_links` | 官网新闻页、活动页、资源页 | 可试运行，需监控页面结构变化 |
| `site_search_rss` | Google News site 查询、新闻聚合搜索 | 可作为补漏 |
| `api` | 新闻 API、商业数据库、社交平台官方 API | 后续评估 |
| `manual_review` | LinkedIn、微信、登录平台、展会页面 | MVP 先人工或半自动 |
| `manual_entry` | 重要但无法自动抓取的链接 | MVP 可保留人工录入入口 |
| `do_not_fetch` | 登录、付费墙、私域、禁止爬取路径 | 不抓 |

## 6. 公司基础信息

```yaml
company_id:
display_name:
legal_name:
aliases:
  - 
local_names:
  - 
homepage:
regions:
  - 
languages:
  - 
company_type:
  - 自家公司
  - 竞品
  - 客户
  - 合作伙伴
  - 行业标杆
  - 潜在客户
business_lines:
  - 
strategic_topics:
  - 
business_actions:
  - product launch
  - partnership
  - funding
  - acquisition
  - clinical trial
  - regulatory approval
  - event
  - webinar
  - content marketing
noise_terms:
  - stock price
  - price target
  - earnings estimate
priority: high | medium | low
notes:
```

## 7. 单个数据源记录字段

```yaml
- source_id:
  source_name:
  source_category:
  url:
  region:
  language:
  owner:
  trust_level: A | B | C | D | E
  enable_status: enabled | trial | watchlist | blocked | paid_later | manual
  fetch_method: rss | html_links | site_search_rss | api | manual_review | manual_entry | do_not_fetch
  suggested_frequency: daily | weekly | monthly | event_based | manual
  content_scope:
    - company news
    - press release
    - product update
    - event
    - webinar
    - resource
    - hiring
    - patent
    - publication
    - clinical trial
    - social post
  include_terms:
    - 
  exclude_terms:
    - 
  known_risks:
    - anti_scraping
    - login_required
    - paywall
    - unstable_html
    - high_noise
    - duplicate_content
    - copyright_risk
    - robots_restriction
    - rate_limit
  current_decision:
  next_action:
  owner_note:
```

## 8. 数据源候选池

### 8.1 官方自有来源

| 来源 | 价值 | MVP 处理 |
| --- | --- | --- |
| 全球官网 News / Press Release | 公司正式动态 | `enabled` 或 `trial` |
| 区域官网 News / Event | 日本、中国、美国、欧洲等区域动态 | `trial` |
| Investor Relations / IR RSS | 上市公司公告、新闻稿 | `enabled` |
| Product News / New Products | 产品发布、目录更新 | `trial` |
| Events / Webinar | 展会、线上研讨会、市场活动 | `trial` |
| Blog / Resource / Knowledge Center | 内容营销、技术文章 | `trial` 或 `watchlist` |
| Support / Documentation / Downloads | 产品资料更新 | `watchlist` |
| Newsletter 订阅页 | 可能有活动和内容更新 | `manual` |

### 8.2 新闻稿与行业媒体来源

| 来源 | 价值 | MVP 处理 |
| --- | --- | --- |
| PR Newswire | 新闻稿补充 | `enabled` 或 Google News site 查询 |
| Business Wire | 新闻稿补充 | `enabled` 或 Google News site 查询 |
| GlobeNewswire | 新闻稿补充 | `enabled` 或 Google News site 查询 |
| BioSpace | 生物医药行业动态 | `trial` |
| Fierce Biotech / Fierce Pharma | 行业热点 | `trial` |
| GEN News / Technology Networks / Labiotech | 技术与行业内容 | `trial` |
| 日文行业媒体 | 日本市场信号 | `watchlist` 或 `trial` |
| 中文行业媒体 | 中国市场信号 | `watchlist` 或 `trial` |

### 8.3 聚合搜索来源

| 来源 | 价值 | MVP 处理 |
| --- | --- | --- |
| Google News RSS 公司名查询 | 免费补漏，覆盖广 | `enabled` |
| Google News RSS 公司名 + 区域 | 区域动态补漏 | `enabled` |
| Google News RSS 公司名 + site 查询 | 定向抓新闻稿平台 | `enabled` |
| Bing News / 其他搜索聚合 | 备选补漏 | `backup`，去重后使用 |
| GDELT / Common Crawl 等开放数据 | 大规模开放数据 | 后续研究 |

### 8.4 社交与内容平台

| 来源 | 价值 | MVP 处理 |
| --- | --- | --- |
| LinkedIn 公司主页 | 产品、招聘、活动、合作动态 | `watchlist` / `manual` |
| LinkedIn 员工或管理层账号 | 早期信号、活动传播 | `watchlist`，不自动抓 |
| 微信公众号 | 中国市场、活动、内容营销 | `watchlist` / `manual` |
| X / Twitter | 海外传播、会议活动 | `watchlist` |
| YouTube / Bilibili | Webinar、产品视频 | 官方 YouTube Atom 可 `enabled`，但单独展示 |
| Facebook / Instagram | 品牌传播，通常业务价值较低 | `watchlist` |

### 8.5 市场活动与渠道来源

| 来源 | 价值 | MVP 处理 |
| --- | --- | --- |
| 展会官网参展商页面 | 判断参展、赞助、主题方向 | `watchlist` / `manual` |
| Webinar 平台页面 | 主题与潜在客户教育方向 | `watchlist` |
| 经销商新闻页 | 区域市场动作 | `watchlist` / `trial` |
| 合作伙伴新闻页 | 合作、联合推广 | `watchlist` / `trial` |
| 客户案例页面 | 商业落地信号 | `watchlist` |

### 8.6 研发、监管与商业信号来源

| 来源 | 价值 | MVP 处理 |
| --- | --- | --- |
| Google Scholar / PubMed | 论文、引用、技术影响 | PubMed 可 `trial`，但不进新闻日报 |
| ClinicalTrials.gov / jRCT / EU CTIS | 临床项目关联 | `watchlist` |
| 专利数据库 | 技术布局、产品方向 | `watchlist` |
| FDA / EMA / PMDA | 监管与批准信号 | openFDA 可 `trial`，无新记录时不展示 |
| 招聘网站 | 组织扩张、区域布局、技术方向 | `watchlist` |
| 公司财报 / SEC / EDINET | 战略、营收、风险披露 | SEC 解析可免费实现，启用前须配置真实联系方式 |

### 8.7 需要谨慎或暂不抓取的来源

| 来源 | 主要问题 | MVP 处理 |
| --- | --- | --- |
| 需要登录的平台 | 权限和账号合规 | `blocked` |
| 反爬严重的网站 | 稳定性、成本、合规风险 | `blocked` 或 `paid_later` |
| 付费墙内容 | 版权和授权 | `blocked` 或 `paid_later` |
| 私域群聊 / 社群 | 非公开内容 | `blocked` |
| 个人账号内容 | 隐私、误读、噪音 | `blocked` 或 `manual` |
| 明确禁止爬取路径 | robots / 条款风险 | `blocked` |

## 9. ACRO / 百普赛斯第一版完整档案

### 9.1 公司基础信息

```yaml
company_id: acro
display_name: ACROBiosystems / 百普赛斯
legal_name: ACROBiosystems
aliases:
  - ACROBiosystems
  - ACRO Biosystems
  - ACROBio
  - ACRO
local_names:
  - 百普赛斯
  - アクロバイオシステムズ
homepage: https://www.acrobiosystems.com/
regions:
  - Global
  - China
  - Japan
  - US
  - Europe
languages:
  - English
  - Chinese
  - Japanese
company_type:
  - 自家公司
business_lines:
  - recombinant proteins
  - antibodies
  - assay kits
  - GMP-grade reagents
  - cell and gene therapy reagents
  - organoid solutions
strategic_topics:
  - ADC
  - antibody
  - bispecific antibody
  - CD20
  - B7-H3
  - CGT
  - GMP
  - organoid
  - HEK293
  - recombinant protein
  - assay kit
  - exosome
  - immuno-oncology
  - webinar
  - conference
  - exhibition
  - Japan
business_actions:
  - product launch
  - new product
  - webinar
  - exhibition
  - conference
  - partnership
  - collaboration
  - case study
  - application note
  - white paper
noise_terms:
  - stock price
  - price target
  - earnings estimate
  - generic directory
  - coupon
  - unrelated acronym
priority: high
notes: MVP 标本公司。第一阶段用于验证数据获取、筛选、存储和展示链路。
```

### 9.2 ACRO 来源清单

| source_id | 来源 | 状态 | 方式 | 可信 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `acro_official_news` | ACRO 全球官网 News | `trial` | `html_links` | A | 官网公开页，价值高；需观察页面防护和结构变化 |
| `acro_japan_official` | ACRO 日本官网 | `trial` | `html_links` | A | 区域市场信号；需筛选 news/event/webinar 相关链接 |
| `google_news_acro` | Google News RSS - ACRO 全球 | `enabled` | `rss` | C | 免费补漏源，噪音较高 |
| `google_news_acro_jp` | Google News RSS - ACRO 日本 | `enabled` | `rss` | C | 日文/日本区域动态补漏 |
| `google_news_acro_prnewswire` | Google News RSS - ACRO + PR Newswire | `enabled` | `site_search_rss` | B/C | 定向新闻稿平台补漏 |
| `bing_news_acro_backup` | Bing News RSS - ACRO | `backup` | `rss` | C | 只保留 Google News 未覆盖标题 |
| `acro_prnewswire_direct` | PR Newswire 搜索 ACRO | `watchlist` | `rss` / `site_search_rss` | B | 后续确认是否有稳定搜索 RSS |
| `acro_businesswire` | Business Wire 搜索 ACRO | `watchlist` | `site_search_rss` | B | 后续补充 |
| `acro_globenewswire` | GlobeNewswire 搜索 ACRO | `watchlist` | `site_search_rss` | B | 后续补充 |
| `acro_linkedin_company` | LinkedIn 公司主页 | `manual` | `manual_review` | D | 有高价值活动/产品传播信号，但 MVP 不自动抓 |
| `acro_wechat_official` | 微信公众号 | `manual` | `manual_review` | D | 中国市场重要来源；自动化成本和合规风险较高 |
| `acro_youtube` | YouTube / Webinar 视频 | `watchlist` | `manual_review` | D | 可用于内容营销观察 |
| `acro_bilibili` | Bilibili 视频 | `watchlist` | `manual_review` | D | 中国内容渠道观察 |
| `acro_events_pages` | 展会 / Webinar 活动页 | `watchlist` | `manual_review` | B/D | 可以人工记录重点展会 |
| `acro_distributors` | 经销商 / 合作伙伴新闻页 | `watchlist` | `manual_review` | D | 区域动态和转载信号 |
| `acro_jobs` | 招聘网站 | `watchlist` | `manual_review` | D | 可观察组织扩张和区域布局，不进 MVP |
| `acro_patents` | 专利数据库 | `watchlist` | `manual_review` | B/D | 后续作为技术情报模块 |
| `acro_pubmed_research` | PubMed - ACRO | `trial` | `api` | B | 论文信号单独展示，不进默认新闻日报 |
| `acro_login_sources` | 需要登录的平台 | `blocked` | `do_not_fetch` | - | 当前不抓 |
| `acro_anti_scraping_sources` | 反爬严重网站 | `blocked` | `do_not_fetch` | - | 当前不绕过 |
| `acro_paid_databases` | 付费数据库 / 商业情报平台 | `paid_later` | `api` | A/B | 后续预算允许时评估 |

## 10. MVP 与完整档案的关系

当前 Demo 只应读取程序配置里的运行源，例如：

- 公开 RSS
- Google News RSS
- 少量官网公开 HTML 页面

完整数据源档案保留更多来源，但不会自动进入抓取。新增公司时，推荐流程是：

1. 先填完整公司数据源档案。
2. 标记每个来源的 `enable_status`。
3. 只把 `enabled` 和少量 `trial` 来源写入 `config/sources.json`。
4. 跑 1-2 周，观察失败率、误报率、重复率和是否能产出有效信号。
5. 再决定是否把 `watchlist` 来源升级为 `trial`，或通过付费/API/人工方式接入。

## 11. 本周 Demo 的数据源边界

本周 Demo 的数据源边界建议保持克制：

- `enabled`：Google News RSS、官方 RSS、官网定向 RSS、新闻稿平台可访问 RSS。
- `covered`：HTML 直抓失败、但同一内容已由官方 RSS 覆盖的页面。
- `trial`：公开 sitemap 变化监控等可访问但尚未证明内容质量的方式。
- `manual`：LinkedIn、微信公众号、重要展会页。
- `blocked`：登录平台、反爬严重网站、付费墙、私域内容。
- `paid_later`：商业新闻 API、企业情报数据库、LinkedIn 官方 API、微信生态监控服务。

这样对外表达时可以说：

> 第一阶段已经建立完整的数据源档案，但自动化抓取只启用低风险公开来源。LinkedIn、微信公众号、登录平台和反爬严重网站会进入情报地图，不会在 MVP 阶段强行自动抓取。后续会根据价值、稳定性、合规和预算，决定人工、半自动、API 或付费接入方式。

### 11.1 2026-07-15 官方自有来源实测

| 官方来源 | 实测结果 | 当前处理 |
| --- | --- | --- |
| ACRO 全球官网 News | HTTP 200，但返回阿里云滑块验证页，简单 HTML 抓取为 0 条 | 使用 `site:acrobiosystems.com/news` 的 Google News RSS |
| ACRO Events / Webinar | 直抓同样触发滑块验证 | 使用 activities 定向 RSS，并过滤礼品、问卷、优惠等噪音 |
| ACRO 日本官网 | 直抓同样触发滑块验证 | 使用 `site:jp.acrobiosystems.com` 日文定向 RSS，限制 180 天 |
| Thermo Fisher IR / Press Release | 官方 RSS 返回 HTTP 200，单次 10 条，结构完整 | 直接启用 |
| Thermo Fisher Newsroom | HTML 返回 403 | 不直接抓；新闻稿由 IR RSS 覆盖 |
| 产品 / Blog / 资源库 | Thermo 的 3 个官方 Blog RSS 均返回 10 条；ACRO Insights 可被定向 RSS 收录 | 启用 Biotech at Scale RSS + ACRO Insights 定向 RSS |

补充测试：ACRO 公开 sitemap 可以免费访问，英文约 9,267 个 URL、日文约 8,666 个 URL，但大量页面共享同一个 `lastmod` 日期，不适合直接当作“当天新内容”。现阶段只把 sitemap 作为栏目发现和未来新增 URL 监控候选，不把几千个页面灌入日报。

### 11.2 2026-07-15 免费扩展入口实测

| 扩展入口 | 实测结果 | 当前处理 |
| --- | --- | --- |
| Bing News RSS | ACRO 原始 7 条、Thermo 原始 10 条；转载重复较多 | 作为 `backup`，跨来源标题去重后本次留下 5 条 |
| Thermo Fisher 官方 YouTube Atom | 稳定返回最新 15 条，无需 API Key | 启用为 `video`，只进视频专题 |
| PubMed E-utilities - ACRO | 总命中 19 条，90 天数据集中留下 7 条 | 试运行为 `research`，只进论文专题 |
| ClinicalTrials.gov | ACRO 命中 0；Thermo 多为试验中提及设备，非公司主体 | 保留观察，暂不运行 |
| openFDA - Thermo | enforcement 历史命中 15 条，最新为 2021 年 | 保留新事件监控，当前展示 0 条 |
| SEC EDGAR - Thermo | JSON 解析器已完成，可过滤为 8-K、10-Q、10-K | SEC 要求 User-Agent 带真实联系邮箱；配置前保持禁用 |
| GDELT | 重复测试返回 HTTP 429 | 不进入当前免费抓取流 |

完整跑批结果：本轮 242 条候选、0 个抓取错误、15 个实际产出来源。38 条新闻日报信号。其中视频 15 条、论文 7 条均被隔离到对应专题，不参与默认新闻日报筛选。公开聚合源会实时变动，因此候选总数在不同跑批间可能有小幅波动。
