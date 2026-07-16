# AI Hot Tracker 公司数据源档案模板

## 目录

- [1. 使用原则](#1-使用原则)
- [2. 四轴分类模型](#2-四轴分类模型)
- [3. 第一轴：来源板块](#3-第一轴来源板块)
- [4. 第二轴：内容类型](#4-第二轴内容类型)
- [5. 第三轴：抓取/获取方式](#5-第三轴抓取获取方式)
- [6. 第四轴：建设阶段](#6-第四轴建设阶段)
- [7. 辅助属性与单个数据源字段](#7-辅助属性与单个数据源字段)
- [8. 数据源候选池](#8-数据源候选池)
- [9. ACRO / 百普赛斯第一版完整档案](#9-acro--百普赛斯第一版完整档案)
- [10. MVP 与完整档案的关系](#10-mvp-与完整档案的关系)
- [11. 当前 Demo 的数据源边界](#11-当前-demo-的数据源边界)

## 1. 使用原则

这份档案是“情报地图”，不是“自动抓取清单”。

第一阶段要把每家公司可能相关的信息入口尽量记录完整，包括官网、RSS、新闻稿平台、行业媒体、LinkedIn、微信公众号、视频平台、展会、招聘、专利、论文、数据库、登录平台和反爬严重网站。但是否进入程序自动抓取，需要单独用“建设阶段”判断。

MVP 阶段只优先启用公开、低成本、低风险、稳定性相对高的数据源。高价值但不稳定、需要登录、反爬严重或可能涉及版权/合规问题的来源，先记录在档案里，后续再评估人工、半自动、API 或付费方式。

每个数据源必须同时回答四个问题：

1. `来源板块`：信息由谁发布，属于哪一类证据来源。
2. `内容类型`：这个入口主要提供什么业务信号。
3. `获取方式`：系统通过什么技术或人工方式获得信息。
4. `建设阶段`：这个入口目前做到哪里，是否进入自动流程。

公司、地区、语言、可信度、来源角色和抓取频率是辅助属性，不与四个主轴混为同一级分类。

## 2. 四轴分类模型

四个轴分别解决不同的管理问题，不能互相替代。

| 轴 | 回答的问题 | 示例 | 在网页中的表现 |
| --- | --- | --- | --- |
| 来源板块 | 信息从哪里来、证据身份是什么？ | 官方自有、行业媒体、聚合搜索、监管数据库 | 数据源地图的 8 个大板块 |
| 内容类型 | 它提供什么业务信号？ | 公司新闻、产品更新、活动、技术内容、视频 | 官方自有板块内部的子分组；抓取后也用于内容归类 |
| 获取方式 | 我们怎样拿到它？ | 直接 RSS、索引 RSS、Atom、API、Sitemap 差分、人工 | 每张来源卡片的方法标签 |
| 建设阶段 | 这个入口目前做到哪里？ | 现在在用、可用待接、未来开发、人工观察 | 卡片状态和阶段筛选器 |

同一个来源可以同时拥有四个轴的值。例如：

```yaml
source_name: ACRO 日本官网补充入口
source_layer: official
content_type: mixed_pending_classification
fetch_method: indexed_rss
build_stage: active
company: ACRO
region: Japan
```

这里的 `Japan` 只是地区标签。抓到具体页面后，仍要将内容归入公司新闻、产品更新、活动、技术内容或视频，而不是把“日本官网”当成一种内容。

## 3. 第一轴：来源板块

来源板块按照发布者和证据作用划分。它决定“应该如何理解和验证这条信息”，而不是决定技术上怎么抓。

| 来源板块 | 主要内容 | 单独成板块的理由 |
| --- | --- | --- |
| 官方自有内容 | 官网 News、IR、Events、Blog、产品页、官方视频 | 第一方原始表述，可信度最高，但可能只呈现公司希望公开的一面 |
| 新闻稿与行业媒体 | PR Newswire、Business Wire、BioSpace、Fierce、GEN、区域媒体 | 提供外部报道和第二证据，需要处理转载、改写和重复 |
| 聚合搜索补漏 | Google News、Bing News、站内定向搜索 | 用于发现分散内容，覆盖广但不是事实来源，噪音最高 |
| 社交与内容平台 | LinkedIn、微信公众号、X、Bilibili、管理层公开账号 | 可能更早出现传播、招聘和活动信号，但需要人工复核和合规判断 |
| 市场活动与渠道 | 展会官网、经销商、代理商、合作伙伴、客户案例 | 不一定被称为新闻，但对市场、销售和 BD 有直接业务价值 |
| 研发监管与组织信号 | PubMed、ClinicalTrials、FDA、PMDA、SEC、专利、招聘 | 数据结构和判断逻辑不同于新闻，应单独形成专题 |
| 高风险受限来源 | 登录平台、反爬严重网站、付费墙、私域、个人账号 | 记录系统盲区和不接入理由，不为抓数据绕过边界 |
| 商业数据服务 | 新闻 API、企业情报数据库、LinkedIn API、微信监控服务 | 可以通过采购合法稳定接入，用于未来评估预算与覆盖收益 |

## 4. 第二轴：内容类型

内容类型回答“这条信息在业务上是什么”。目前官方自有内容先采用五个主分类。

| 内容类型 | 包含内容 | 主要业务问题 |
| --- | --- | --- |
| 公司新闻与公告 | 合作、融资、收购、管理层、战略、正式新闻稿、IR 公告 | 公司正式宣布了什么重大事项？ |
| 产品与解决方案更新 | 新品、新靶点、新试剂盒、新服务、产品目录和解决方案页 | 公司正在推出或强化什么产品方向？ |
| 活动与 Webinar | 展会、会议、Workshop、Webinar、报名、议程和回放状态 | 公司准备在哪里、围绕什么主题进行市场活动？ |
| 技术内容 | Insights、Blog、Application Note、白皮书、Protocol、Knowledge Center | 公司正在教育市场关注哪些技术和应用方向？ |
| 视频与回放 | 官方 YouTube、技术视频、Webinar Replay | 公司最近通过视频传播了什么？ |

`地区覆盖`不是内容类型。全球站、日本站、中国站和欧洲语言站属于地区标签或补充入口。地区入口抓到页面后，仍要归入上述五个内容类型。

新闻稿平台、媒体、聚合器和监管来源抓回来的内容，也可以继续使用合作、产品、活动、监管、财务、研究等统一的下游内容分类。来源板块和内容类型分别回答“谁发布”和“讲了什么”。

## 5. 第三轴：抓取/获取方式

获取方式只描述“怎样获得信息”，不决定来源身份和内容类型。

| 方式 | 适用来源 | MVP 建议 |
| --- | --- | --- |
| `direct_rss` | 官方 RSS、IR RSS、Blog RSS、媒体 RSS | MVP 首选，结构稳定且成本低 |
| `indexed_rss` | Google News 公司查询、site 定向查询、区域查询 | 官网反爬或没有 RSS 时用于发现和补漏 |
| `atom` | YouTube 官方频道等 Atom Feed | 免费接入，按视频专题单独展示 |
| `api` | PubMed、openFDA、SEC、商业数据库 | 根据接口规则、联系信息、限频和相关性决定是否启用 |
| `sitemap_diff` | 产品页、资源页、活动页的新 URL 发现 | 只比较新增 URL，不直接相信不准确的 `lastmod` |
| `html_link_diff` | 可公开访问且结构稳定的列表页 | 需要监控页面改版、403 和抓取失败 |
| `manual_review` | LinkedIn、微信、展会页、登录平台 | MVP 先人工定期查看 |
| `manual_entry` | 重要但无法自动抓取的链接 | 允许人工补充进入统一处理流程 |
| `do_not_fetch` | 登录、付费墙、私域、禁止抓取路径 | 只记录，不发起请求 |

“官方 RSS”和“Google News 站内定向 RSS”可能都抓到官方页面，但获取链路不同：前者是官方直接提供，后者是搜索索引代为发现。网页必须把两者明确标注。

## 6. 第四轴：建设阶段

建设阶段只说明当前执行进度，不代表来源类型、内容类型或可信度。

| 状态 | 网页名称 | 含义 | 是否自动运行 |
| --- | --- | --- | --- |
| `active` | 现在在用 | 已进入当前抓取或监控流程 | 是 |
| `available` | 可用待接 | 方法已验证，但因配置、相关性或优先级尚未启用 | 否 |
| `planned` | 未来开发 | 有价值，但方法、规则或产品设计尚未完成 | 否 |
| `manual` | 人工观察 | 当前采用人工查看或人工录入 | 否 |
| `covered` | 已有其他来源覆盖 | 当前入口不单独抓，内容已由其他来源覆盖 | 否 |
| `blocked` | 不接入 | 因登录、权限、反爬、版权、隐私或合规边界不发起请求 | 否 |
| `paid` | 付费候选 | 需要采购 API、数据库或监控服务后才能接入 | 否 |

`backup` 不再作为建设阶段。它属于 `source_role`：来源可以同时是 `active` 和 `backup`，表示程序正在运行，但只保留主来源未覆盖的内容。

## 7. 辅助属性与单个数据源字段

### 7.1 公司基础信息

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

### 7.2 可信等级

| 等级 | 来源类型 | 判断 |
| --- | --- | --- |
| `A` | 公司官方来源、官方 RSS、IR / Press Release、官方监管数据 | 可信度最高，适合优先展示 |
| `B` | 新闻稿平台、权威行业媒体、展会主办方、科研数据库 | 可信度较高，需要去重和语境判断 |
| `C` | Google News、Bing News 等聚合源 | 覆盖广，但噪音、漂移和旧内容较多 |
| `D` | 社交媒体、招聘平台、合作伙伴转载 | 有信号价值，但需要复核 |
| `E` | 论坛、个人账号、低质量转载、SEO 页面 | 默认只归档或不接入 |

可信度是辅助属性，不是建设阶段。一个可信 A 级的官网也可能因为反爬而处于 `blocked`；一个 C 级聚合源也可能因为免费稳定而处于 `active`。

### 7.3 单个数据源记录字段

```yaml
- source_id:
  source_name:
  source_layer: official | wire_media | aggregator | social_content | market_channel | research_regulatory | restricted | commercial
  content_type: company_news | product_update | event | technical_content | video | regulatory | research | finance | organization | mixed_pending_classification
  company_id:
  url:
  region:
  language:
  owner:
  trust_level: A | B | C | D | E
  build_stage: active | available | planned | manual | covered | blocked | paid
  source_role: primary | backup | discovery | verification | manual_supplement
  fetch_method: direct_rss | indexed_rss | atom | api | sitemap_diff | html_link_diff | manual_review | manual_entry | do_not_fetch
  suggested_frequency: daily | weekly | monthly | event_based | manual
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

候选池首先按第一轴“来源板块”排列。每个具体入口还必须补充内容类型、获取方式和建设阶段，不能只因为出现在候选池里就自动运行。

### 8.1 官方自有来源

官方层内部按第二轴“内容类型”排列，让不同公司可以横向比较同类入口。

| 内容类型 | 候选入口 | 价值 | 常见获取方式 | MVP 建议 |
| --- | --- | --- | --- | --- |
| 公司新闻与公告 | 全球官网 News、Press Release、IR、ESG、正式公告 | 公司正式动态和原始表述 | `direct_rss`、`indexed_rss`、`html_link_diff` | 优先评估，通常 `active` 或 `covered` |
| 产品与解决方案更新 | Product News、New Products、产品目录、Solutions、Services | 新品、产品线和商业方向变化 | `sitemap_diff`、`html_link_diff`、`indexed_rss` | 先做栏目白名单，通常 `planned` |
| 活动与 Webinar | Events、Conference、Workshop、Webinar、报名页、回放状态 | 市场活动节奏和客户教育主题 | `indexed_rss`、`html_link_diff`、`manual_review` | 有稳定入口时 `active`，否则 `planned` |
| 技术内容 | Blog、Insights、Resource、Knowledge Center、Application Note、Protocol | 内容营销、技术定位和产品应用方向 | `direct_rss`、`indexed_rss`、`sitemap_diff` | 可 `active`，需与产品促销内容分开 |
| 视频与回放 | 官方 YouTube、官网 Videos、Webinar Replay | 视频传播和活动回放 | `atom`、`html_link_diff` | 单独作为视频专题 |
| 跨类别地区覆盖 | 日本站、中国站、美国站、欧洲语言站 | 补充区域市场内容 | `indexed_rss`、`sitemap_diff`、`html_link_diff` | 地区是标签，抓到后必须再分内容类型 |

辅助入口：

| 入口 | 作用 | 建议 |
| --- | --- | --- |
| Support / Documentation / Downloads | 发现数据表、说明书、质量文件和下载资源更新 | 低频 `planned` 或 `manual`，避免把大量 PDF 当新闻 |
| Newsletter 订阅 | 发现活动、产品和内容更新 | `manual`；后续可评估邮箱转发和结构化解析 |

### 8.2 新闻稿与行业媒体来源

本板块不能把“媒体是谁”“报道扮演什么角色”“监控哪家公司”“使用什么查询方式”写在同一层。网页采用以下结构：

- 主分类：来源角色。
- 辅助标签：公司、竞品、地区和获取方式。
- 抓取后分类：公司新闻、产品、合作、活动、监管、技术主题等内容类型。

“公司定向查询”不是一种数据源。它表示用公司名、别名或 `site:` 条件从某个真实平台中筛选内容，属于第三轴“获取方式”。

#### A. 新闻稿分发平台

这类平台承载公司自行发布的正式新闻稿。它们适合发现和核对公司原始表述，但不能当作独立媒体评价。

| 来源 | 当前能力判断 | 常见获取方式 | 建设阶段 |
| --- | --- | --- | --- |
| PR Newswire | ACRO 已有实际命中 | 公司名 + `site:` 索引 RSS | `active` |
| Business Wire | 官方支持按行业和关键词定制 RSS / Atom，尚未验证公司池增量 | 官方 RSS、关键词查询、`indexed_rss` | `available` |
| GlobeNewswire | 官方提供 Health、Biotechnology、Partnerships、Product Announcement 等 RSS | 官方分类 RSS、公司关键词 | `available` |

#### B. 生物医药行业新闻

这类来源有编辑筛选和报道属性，可补充外部视角、交易背景和竞品信息。

| 来源 | 主要价值 | 常见获取方式 | 建设阶段 |
| --- | --- | --- | --- |
| BioSpace | 公司、Deals、Drug Development、FDA 和行业动态 | 官方栏目 RSS | `available` |
| Fierce Biotech | Biotech、Medtech、CRO、研发交易 | 官方 RSS | `available` |
| Fierce Pharma | Pharma、Manufacturing、Marketing、Vaccines、Pharma Asia | 官方栏目 RSS | `available` |

#### C. 生命科学技术媒体

这类来源更适合技术趋势、实验工具、应用场景和内容选题，不应与公司新闻稿混在同一个默认推送权重中。

| 来源 | 主要价值 | 常见获取方式 | 建设阶段 |
| --- | --- | --- | --- |
| GEN | Drug Discovery、Bioprocessing、OMICS、Gene Editing、Translational Medicine | 栏目索引；稳定 RSS 待确认 | `planned` |
| Technology Networks | 实验工具、分析技术、科研趋势、Webinar | 栏目索引、Newsletter；自动入口待测试 | `planned` |
| Labiotech | 欧洲 Biotech 公司、融资、合作和区域产业动态 | RSS / 索引待测试 | `planned` |

#### D. 地区媒体补充

地区只是辅助属性，不是来源类型。不能再用“日文行业媒体”或“中文行业媒体”代表一个虚拟数据源，必须落实到具体媒体、栏目和入口。

| 地区 | 建档要求 | 建设阶段 |
| --- | --- | --- |
| 日本 | 逐家记录媒体名、栏目、免费范围、RSS、登录要求和转载比例 | `planned` 或 `manual` |
| 中国 | 逐家记录媒体名、原文链、转载链、公众号关系和人工复核规则 | `manual`，稳定公开入口确认后再升级 |

### 8.3 聚合搜索来源

| 来源 | 价值 | 来源角色 | 建设阶段建议 |
| --- | --- | --- | --- |
| Google News RSS 公司名查询 | 免费补漏，覆盖广 | `discovery` | `active` |
| Google News RSS 公司名 + 区域 | 区域动态补漏 | `discovery` | 查询词收紧后 `active` |
| Google News RSS 公司名 + site 查询 | 定向发现官方页或新闻稿平台 | `discovery` | `active` |
| Bing News RSS | 备用补漏 | `backup` | 可为 `active`，但只保留主来源未覆盖内容 |
| GDELT / Common Crawl | 大规模开放数据 | `discovery` | 限频和噪音较高，`planned` 或 `blocked` |

### 8.4 社交与内容平台

| 来源 | 价值 | 常见获取方式 | 建设阶段建议 |
| --- | --- | --- | --- |
| LinkedIn 公司主页 | 产品、招聘、活动、合作动态 | `manual_review` 或官方 API | `manual`；不自动绕过登录 |
| LinkedIn 员工或管理层账号 | 早期信号、活动传播 | `manual_review` | `manual` |
| 微信公众号 | 中国市场、活动、内容营销 | `manual_review` 或商业服务 | `manual` 或 `paid` |
| X / Twitter | 海外传播、会议活动 | `manual_review` 或官方 API | `manual` 或 `paid` |
| Bilibili | 中国市场视频和 Webinar | `manual_review` | `manual` |
| Facebook / Instagram | 品牌传播 | `manual_review` | 低优先级 `manual` |

官方 YouTube 频道归入“官方自有内容 - 视频与回放”，不再因为发布平台是 YouTube 就放在社交板块。非官方转载频道仍留在本板块。

### 8.5 市场活动与渠道来源

这一层不再把所有活动页面都叫作“Webinar 平台”，而是先区分平台在信息链路中的角色：

> LINK-J、近畿生物产业振兴会议、湘南 iPark 是跨公司的数据源平台，不是公司池成员。系统先从平台抓取公开内容，再用公司别名匹配公司池；命中后归到对应公司，未命中则保留为行业观察。

| 角色 | 回答的问题 | 记录方式 |
| --- | --- | --- |
| 发现来源 | 我们最先从哪里看到这条活动或公司信息？ | 保存来源平台、原始页面和发布时间 |
| 分发渠道 | 哪些行业组织、合作方或地区平台帮助传播？ | 同一事件可保留多个渠道 |
| 报名承载工具 | 最终在哪里报名或观看？ | 保存 Zoom / EventRegist / Peatix URL 与会议 ID |

同一场 Webinar 可能同时出现在 LINK-J、近畿生物产业振兴会议和湘南 iPark。系统不生成三条重复新闻，而是按标题、活动日期、报名 URL 和 Webinar ID 归并，同时保留全部分发渠道。

| 分类 | 具体来源 | 价值 | 常见获取方式 | 建设阶段建议 |
| --- | --- | --- | --- | --- |
| 行业生态与活动平台 | LINK-J | 会员企业活动、技术议题、Webinar、项目和开放创新信号 | 公开活动列表 `html_links` | `active` |
| 行业生态与活动平台 | 近畿生物产业振兴会议 | 关西研讨会、产业交流、BioJapan 支援和区域项目 | 官方直接 RSS | `active` |
| 行业生态与活动平台 | 湘南 iPark | 园区企业、活动公告、开放创新、合作及新闻 | News 列表 `html_links` | `active`；旧 RSS 和旧海报活动页不作为主入口 |
| 展会与专业会议 | 重点展会官网和参展商页面 | 判断参展、赞助、演讲和主题方向 | `manual_review`、白名单页面差分 | `planned` |
| 合作与商业网络 | 经销商 / 代理商新闻页 | 区域市场动作 | 白名单 RSS、`html_link_diff` | `planned` |
| 合作与商业网络 | 合作伙伴新闻页 | 补齐合作另一方表述 | `indexed_rss`、`html_link_diff` | `planned` |
| 合作与商业网络 | 客户案例页面 | 商业落地和应用信号 | `sitemap_diff`、`html_link_diff` | `planned` |
| 报名承载工具 | Zoom / EventRegist / Peatix | 确认报名、会议编号和活动详情 | 跟随原始活动链接核对 | `covered`；不做全站发现式抓取 |

### 8.6 研发监管与组织信号

| 来源 | 价值 | 常见获取方式 | 建设阶段建议 |
| --- | --- | --- | --- |
| PubMed / Google Scholar | 论文、引用、技术影响 | `api`、`manual_review` | PubMed 可 `active`，但进入研究专题 |
| ClinicalTrials.gov / jRCT / EU CTIS | 临床项目关联 | `api` | 相关性验证后 `available` 或 `planned` |
| 专利数据库 | 技术布局、产品方向 | `api`、`manual_review` | `planned` |
| FDA / EMA / PMDA | 监管、批准和召回信号 | `api`、公开索引 | 可做低频监控，无新记录时不撑大日报 |
| SEC / EDINET | 战略、财务和重大事项 | `api` | 满足接口要求后 `available` |
| 招聘网站 | 组织扩张、区域布局、技术方向 | `manual_review` | `manual` |

### 8.7 高风险受限来源

| 来源 | 主要问题 | 获取方式 | 建设阶段 |
| --- | --- | --- | --- |
| 需要登录的平台 | 权限和账号合规 | `do_not_fetch` 或 `manual_review` | `blocked` 或 `manual` |
| 反爬严重的网站 | 稳定性、成本、合规风险 | `do_not_fetch` | `blocked`；有替代来源时可 `covered` |
| 付费墙内容 | 版权和授权 | `do_not_fetch` | `blocked` 或转商业服务评估 |
| 私域群聊 / 社群 | 非公开内容 | `do_not_fetch` | `blocked` |
| 个人账号内容 | 隐私、误读、噪音 | `manual_review` | `manual` 或 `blocked` |
| 明确禁止抓取路径 | robots / 条款风险 | `do_not_fetch` | `blocked` |

### 8.8 商业数据服务

| 来源 | 可能补齐的能力 | 建设阶段建议 |
| --- | --- | --- |
| 商业新闻 API | 更稳定的新闻覆盖、历史数据和结构化字段 | `paid` |
| 企业情报数据库 | 公司关系、融资、并购、组织和商业数据 | `paid` |
| LinkedIn 官方 API / 合规服务 | 公司主页和组织信号 | `paid` |
| 微信生态监控服务 | 公众号和中国市场内容 | `paid` |
| 专业生命科学数据库 | 临床、专利、药物管线和市场数据 | `paid` |

付费来源进入采购评估前，应先用免费 MVP 量化三个问题：当前漏报了什么、漏报是否影响业务、付费后能否显著降低人工成本。

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

下表用同一行同时记录四个轴。`来源角色`、地区和可信度为辅助属性。

| source_id | 来源板块 | 内容类型 | 地区 | 建设阶段 | 来源角色 | 获取方式 | 可信 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `acro_official_news_index` | 官方自有 | 公司新闻与公告 | 全球 | `active` | `primary` | `indexed_rss` | A | 官网直抓触发验证，当前只发现公开索引收录的官方 News 页面 |
| `acro_official_activities_index` | 官方自有 | 活动与 Webinar | 全球 | `active` | `primary` | `indexed_rss` | A | 监控 Activities，并过滤礼品、问卷、优惠和免费样品 |
| `acro_official_insights_index` | 官方自有 | 技术内容 | 全球 | `active` | `primary` | `indexed_rss` | A | 监控 Insights、技术解读和应用内容 |
| `acro_japan_official_index` | 官方自有 | 待二次分类 | 日本 | `active` | `discovery` | `indexed_rss` | A | 先发现日本站页面，再归入新闻、产品、活动、技术或视频 |
| `acro_product_sitemap` | 官方自有 | 产品与解决方案更新 | 全球 | `active` | `discovery` | `sitemap_diff` | A | 读取 robots.txt 指定的官方 Sitemap；首次建立基线，之后只报告产品与 Solutions 新增 URL |
| `acro_youtube_official` | 官方自有 | 视频与回放 | 全球 | `active` | `primary` | `html_link_diff` | A | 官方 Channel ID 已确认；Atom Feed 返回 404，改读公开频道页面 |
| `acro_official_html_direct` | 官方自有 | 多类型 | 全球 / 日本 | `covered` | `verification` | `do_not_fetch` | A | HTML 直抓触发滑块验证，当前由官方页面索引 RSS 覆盖 |
| `google_news_acro_prnewswire` | 新闻稿与行业媒体 | 公司新闻与公告 | 全球 | `active` | `verification` | `indexed_rss` | B | 定向补漏 PR Newswire 上的 ACRO 新闻稿 |
| `acro_businesswire` | 新闻稿与行业媒体 | 公司新闻与公告 | 全球 | `available` | `discovery` | `indexed_rss` | B | 方法可用，等公司池和重复控制稳定后接入 |
| `acro_globenewswire` | 新闻稿与行业媒体 | 公司新闻与公告 | 全球 | `available` | `discovery` | `indexed_rss` | B | 当前尚未证明比 PR Newswire 更有增量价值 |
| `google_news_acro` | 聚合搜索补漏 | 多类型 | 全球 | `active` | `discovery` | `indexed_rss` | C | 免费补漏源，覆盖广但噪音较高 |
| `google_news_acro_jp` | 聚合搜索补漏 | 多类型 | 日本 | `active` | `discovery` | `indexed_rss` | C | 日文和日本区域外部报道补漏 |
| `bing_news_acro_backup` | 聚合搜索补漏 | 多类型 | 全球 | `active` | `backup` | `direct_rss` | C | 只保留 Google News 未覆盖的标题 |
| `acro_linkedin_company` | 社交与内容平台 | 多类型 | 全球 | `manual` | `manual_supplement` | `manual_review` | D | 活动、产品、合作和招聘信号价值高，但 MVP 不自动抓 |
| `acro_wechat_official` | 社交与内容平台 | 多类型 | 中国 | `manual` | `manual_supplement` | `manual_review` | D | 中国市场重要来源，自动化和合规边界复杂 |
| `acro_bilibili` | 社交与内容平台 | 视频与回放 | 中国 | `manual` | `manual_supplement` | `manual_review` | D | 中国市场视频内容观察 |
| `acro_exhibition_pages` | 市场活动与渠道 | 活动与 Webinar | 多地区 | `manual` | `manual_supplement` | `manual_review` | B | 人工记录重点展会的参展、赞助和演讲信息 |
| `linkj_life_science_events` | 市场活动与渠道 | 行业生态与活动平台 | 日本 / 全国 | `active` | `discovery` | `html_link_diff` | B | 读取 LINK-J 主办、共办和特别会员活动，提取技术主题与公司信号 |
| `kinkibio_official_feed` | 市场活动与渠道 | 行业生态与活动平台 | 日本 / 关西 | `active` | `discovery` | `direct_rss` | B | 官方 RSS 直接提供研讨会、产业交流和 BioJapan 支援信息 |
| `shonan_ipark_news_events` | 市场活动与渠道 | 行业生态与活动平台 | 日本 / 湘南 | `active` | `discovery` | `html_link_diff` | B | 读取 News 列表；官方 RSS 仅有旧测试内容，旧活动页不作为主入口 |
| `event_registration_platforms` | 市场活动与渠道 | 报名承载工具 | 多地区 | `covered` | `verification` | `manual_review` | C | 保存 Zoom 等报名 URL、会议 ID 与渠道参数，不做全站抓取 |
| `acro_distributors` | 市场活动与渠道 | 公司新闻与公告 | 多地区 | `planned` | `discovery` | `html_link_diff` | C | 观察重点经销商和代理商的区域市场动作 |
| `acro_partner_news` | 市场活动与渠道 | 公司新闻与公告 | 全球 | `planned` | `verification` | `indexed_rss` | B | 补齐合作另一方表述，并与 ACRO 事件归并 |
| `acro_pubmed_research` | 研发监管与组织信号 | 研究 | 全球 | `active` | `discovery` | `api` | B | 论文信号单独展示，不进入默认新闻日报 |
| `acro_patents` | 研发监管与组织信号 | 研究 / 产品 | 全球 | `planned` | `discovery` | `api` | B | 后续作为技术布局专题 |
| `acro_jobs` | 研发监管与组织信号 | 组织 | 多地区 | `manual` | `manual_supplement` | `manual_review` | D | 观察组织扩张、区域布局和技术方向 |
| `acro_login_sources` | 高风险受限来源 | 多类型 | 多地区 | `blocked` | `discovery` | `do_not_fetch` | - | 需要登录或权限，不进入自动流程 |
| `acro_private_sources` | 高风险受限来源 | 多类型 | 多地区 | `blocked` | `discovery` | `do_not_fetch` | - | 私域、个人账号或明确禁止抓取内容 |
| `acro_paid_databases` | 商业数据服务 | 多类型 | 全球 | `paid` | `discovery` | `api` | A/B | 免费 MVP 证明业务价值后再评估采购 |

## 10. MVP 与完整档案的关系

当前 Demo 只应读取程序配置里的运行源，例如：

- 官方直接 RSS / Blog RSS
- Google News 站内定向或公司查询 RSS
- YouTube Atom Feed
- 已验证且满足接口要求的少量免费 API

完整数据源档案保留更多来源，但不会自动进入抓取。新增公司时，推荐流程是：

1. 先填完整公司数据源档案。
2. 为每个入口填写来源板块、内容类型、获取方式和建设阶段。
3. `active` 来源在 `config/sources.json` 中启用；解析器已经完成的 `available` 来源可以保留为 `enabled: false`，`planned` 来源只保留在地图和档案中。
4. 跑 1-2 周，观察失败率、误报率、重复率和是否能产出有效信号。
5. 根据结果将 `available` 或 `planned` 升级为 `active`，或调整为 `manual`、`covered`、`blocked`、`paid`。

网页分工：

- 数据源地图：展示来源板块、内容覆盖、获取方式和建设阶段。
- 数据源健康：展示实际候选数、日报贡献、最后内容、错误和维护价值。
- 日报 / 精选流：展示经过分类、去重和评分后的最终业务信号。

## 11. 当前 Demo 的数据源边界

当前 Demo 的数据源边界保持克制：

- `active`：Google News RSS、官方 RSS、官网定向 RSS、Sitemap 新 URL 差分、YouTube Atom / 官方频道页、已验证的免费 API。
- `available`：方法已经验证，但因为配置要求、相关性或优先级暂未运行。
- `planned`：尚未建立稳定入口的产品页变化、专利、展会日历、合作伙伴页面等未来开发项。
- `manual`：LinkedIn、微信公众号、重要展会页。
- `covered`：HTML 直抓失败、但同一内容已由官方 RSS 或索引 RSS 覆盖的页面。
- `blocked`：登录平台、反爬严重网站、付费墙、私域内容。
- `paid`：商业新闻 API、企业情报数据库、LinkedIn 官方 API、微信生态监控服务。

这样对外表达时可以说：

> 第一阶段已经建立完整的数据源档案，但自动化抓取只启用低风险公开来源。LinkedIn、微信公众号、登录平台和反爬严重网站会进入情报地图，不会在 MVP 阶段强行自动抓取。后续会根据价值、稳定性、合规和预算，决定人工、半自动、API 或付费接入方式。

### 11.1 2026-07-16 官方自有来源实测

| 官方来源 | 实测结果 | 当前处理 |
| --- | --- | --- |
| ACRO robots.txt / 官方 Sitemap | robots.txt 返回 HTTP 200，并明确列出 6 个 `console.acrobiosystems.com` Sitemap；英文 Sitemap 返回约 1.9 MB XML | 产品与解决方案更新 · `sitemap_diff` · `active`；首次建立 6300+ 产品和 Solutions URL 基线 |
| ACRO 全球官网 News | 首页和 robots.txt 当前可返回 HTTP 200，但具体内容页仍可能进入阿里云 WAF | 公司新闻与公告 · `indexed_rss` · `active` |
| ACRO Events / Webinar | 直抓同样触发滑块验证 | 活动与 Webinar · `indexed_rss` · `active`，并过滤促销噪音 |
| ACRO Insights | 直抓同样触发滑块验证，但公开搜索能够收录页面 | 技术内容 · `indexed_rss` · `active` |
| ACRO 日本官网 | 直抓同样触发滑块验证 | 地区补充入口 · `indexed_rss` · `active`；抓到后再分内容类型 |
| ACRO 官方 YouTube | 官方频道 `@ACROBiosystems` 与 Channel ID 已确认；标准 Atom Feed 返回 404，频道公开页返回 30 条视频 | 视频与回放 · 公开频道页解析 · `active` |
| Thermo Fisher IR / Press Release | 官方 RSS 返回 HTTP 200，结构完整 | 公司新闻与公告 · `direct_rss` · `active` |
| Thermo Fisher Newsroom | HTML 返回 403 | 公司新闻与公告 · `do_not_fetch` · `covered`，由 IR RSS 覆盖 |
| Thermo Fisher Biotech at Scale Blog | 官方 Blog RSS 可稳定返回 | 技术内容 · `direct_rss` · `active` |
| Thermo Fisher 官方 YouTube | Atom Feed 稳定返回，无需 API Key | 视频与回放 · `atom` · `active` |
| Thermo Fisher Events / Webinar | 主活动页直抓返回 403；公开索引可返回 Webinar、Conference 和 Summit 页面 | 活动与 Webinar · `indexed_rss` · `active` |
| Thermo Fisher 产品更新 | 大型产品目录不适合全量抓取；官方新闻稿 RSS 已包含新品发布，例如 ASMS 2026 新产品与技术 | 产品与解决方案更新 · 由 `thermo_official_rss` 覆盖，不单独重复建源 |
| Thermo Fisher 日本官网 | 日本站公开索引可返回新闻、活动和 Seminar 页面 | 地区补充入口 · `indexed_rss` · `active`；限制 180 天并与泛新闻源去重 |

补充测试：ACRO 英文 Sitemap 中约有 6302 个产品 URL 和 29 个 Solutions URL，且这些页面共享同一个 `lastmod` 日期，不能把 `lastmod` 当作真实发布时间。系统因此保存 URL 哈希基线，后续只把新增 URL 作为产品更新候选，不回灌历史页面。

### 11.2 2026-07-15 免费扩展入口实测

| 扩展入口 | 实测结果 | 当前处理 |
| --- | --- | --- |
| Bing News RSS | ACRO 原始 7 条、Thermo 原始 10 条；转载重复较多 | `direct_rss` · `active` · `backup`，只保留主来源未覆盖标题 |
| Thermo Fisher 官方 YouTube Atom | 稳定返回最新 15 条，无需 API Key | 视频与回放 · `atom` · `active` |
| PubMed E-utilities - ACRO | 总命中 19 条，90 天数据集中留下 7 条 | 研究专题 · `api` · `active` |
| ClinicalTrials.gov | ACRO 命中 0；Thermo 多为试验中提及设备，非公司主体 | 临床信号 · `api` · `available`，暂不运行 |
| openFDA - Thermo | enforcement 历史命中 15 条，最新为 2021 年 | 监管监控 · `api` · `active`，无新记录时显示 0 条 |
| SEC EDGAR - Thermo | JSON 解析器已完成，可过滤为 8-K、10-Q、10-K | 财务公告 · `api` · `available`，等待配置真实联系邮箱 |
| GDELT | 重复测试返回 HTTP 429 | 聚合发现 · `api` · `blocked` |

完整跑批结果：本轮跟踪 21 个入口，18 个入口有内容产出，274 条候选、0 个抓取错误、39 条新闻日报信号。ACRO 产品 Sitemap 持续监控 6331 个 URL，本轮新增 0；ACRO 官方 YouTube 返回 20 条视频并全部隔离到视频专题；Thermo 活动源返回 5 条，Thermo 日本官网入口返回 9 条。公开聚合源会实时变动，因此候选总数在不同跑批间可能有小幅波动。
