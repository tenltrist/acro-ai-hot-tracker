# AI Hot Tracker MVP

这是一个面向“目标公司热点追踪平台”的本地 MVP。第一版先拿 ACROBiosystems / 百普赛斯做标本对象，验证三件事：

1. 能不能用低成本公开来源收集候选新闻。
2. 能不能用规则把“值得推送”和“只是提到公司名”的噪音分开。
3. 能不能每天生成一份可读的公司情报简报。

当前配置 19 家监测公司，以 ACROBiosystems / 百普赛斯为本公司标本，其余公司按业务证据进入竞品、客户候选或生态观察角色。公司身份和业务关系仍采用“先留证据、后确认”的方式维护，暂不把集团与子品牌自动合并。

业务角色写在 `config/companies.json`。分类依据是产品与技术能力、应用场景、目标客户是否重叠；客户身份不能仅凭新闻内容推断，未确认前不会把公司放进客户池。

当前活动生态来源：

- LINK-J 公开活动列表
- 近畿生物产业振兴会议官方 RSS
- 湘南 iPark 新闻与活动公告

这三个平台是跨公司的监测数据源，不属于公司池。抓到内容后，系统再用公司别名匹配本公司、竞品池或后续加入的客户公司。

## 核心判断

第一版不做实时推送，也不接付费新闻 API。默认机制是：

- 高分内容：标记为 `immediate`，理论上可以接即时提醒。
- 中分内容：进入每日简报。
- 低分内容：归档，不主动推送。
- 明显噪音：过滤。

日报还会经过第二层准入：低 ACRO 相关性内容统一留在归档；未命中公司且没有明确业务动作的中相关内容也不进入日报。新闻发布日期与活动举办日期分别保存，避免把未来活动误判为刚发布的新闻。

页面中的摘要会明确标注来源：配置模型 API 并运行 `--ai-summary` 时显示“AI 摘要”；没有模型结果时显示“规则提要”，不把规则模板冒充 AI 总结。

每条信息还会保存一组证据字段：原始入口、来源类型、可引用摘录、核验状态和关联链接。页面默认只突出业务摘要与建议动作，证据、六组结构化字段和处理状态放在展开区，避免单张卡片承载过多内容。

“公司时间线”按公司沉淀全部命中记录、日报信号、来源数、主题和动作分布。信号的“待处理 / 已阅读 / 已核验 / 已行动 / 已归档”状态目前保存在当前浏览器，适合个人试用；多人共享状态仍需要后端数据库。

这样可以避免“公司名一出现就乱推送”的问题。

## 运行

```bash
python3 ai_hot_tracker/scripts/run_daily.py
```

输出会写入：

```text
ai_hot_tracker/reports/
```

状态文件会写入：

```text
ai_hot_tracker/data/seen_urls.json
```

网页 dashboard 读取的数据会写入：

```text
ai_hot_tracker/data/latest_run.json
```

每轮运行会在同一个 `latest_run.json` 中同时更新新闻列表、汇总指标和
`source_health`。网页右上角的同步按钮会重新读取这份最新结果，因此数据源健康与
日报保持同一轮时间；该按钮只同步已完成的结果，不会直接在静态网页中启动抓取。

如果只是想试跑，不更新已读状态：

```bash
python3 ai_hot_tracker/scripts/run_daily.py --dry-run
```

### 可选的真实 AI 摘要

默认运行只使用免费规则提要，不会调用付费模型。只有同时显式配置提供商、API Key、模型并加上 `--ai-summary` 时，才会对日报候选进行二次摘要。

OpenAI Responses API 示例：

```bash
AI_SUMMARY_PROVIDER=openai \
OPENAI_API_KEY="..." \
AI_SUMMARY_MODEL="你确认使用的模型" \
python3 ai_hot_tracker/scripts/run_daily.py --ai-summary --ai-summary-limit 10
```

Anthropic Messages API 示例：

```bash
AI_SUMMARY_PROVIDER=anthropic \
ANTHROPIC_API_KEY="..." \
AI_SUMMARY_MODEL="你确认使用的模型" \
python3 ai_hot_tracker/scripts/run_daily.py --ai-summary --ai-summary-limit 10
```

每轮默认最多生成 10 条新摘要，已生成的 AI 摘要会复用，避免每天重复花费。配置缺失或请求失败时，本轮仍保留规则提要，并在 `summary_pipeline` 中记录原因。

生成后可以运行数据一致性检查：

```bash
python3 ai_hot_tracker/scripts/validate_dashboard.py
```

GitHub 的定时更新会在发布前自动执行这项检查；公司、来源、日报门槛、日期语义或健康统计断链时，本轮数据不会发布。

打开本地网站：

在 `ai_hot_tracker` 目录运行：

```bash
python3 -m http.server 8765
```

然后访问：

```text
http://127.0.0.1:8765/web/
```

部署到 GitHub Pages 后，仓库根目录会自动跳转到：

```text
/web/
```

静态 API：

```text
/api/public/daily.json
/api/public/items.json
/api/public/topics.json
```

`topics.json` 同时包含公司时间线和开放源接入试验结果。RSSHub 公共演示实例只用于连通性测试，不作为生产依赖；当前 GitHub Pages 方案继续使用官网直连、YouTube 直连、Sitemap 和公开页面差分。需要持续运行服务器的 changedetection.io 暂列为未来方案，测试与替代关系记录在 `config/source_experiments.json`。

## 生成可分享网页

如果要发给别人一个不需要本地服务的数据快照网页：

```bash
python3 ai_hot_tracker/scripts/build_share_page.py
```

生成文件：

```text
ai_hot_tracker/share/acro_ai_hot_tracker_dashboard.html
```

这个 HTML 已经内嵌当前数据、样式和交互脚本，可以直接作为文件发送。

## 后续扩展

把休假前那批公司名单接进来时，只需要扩展：

- `config/companies.json`
- `config/sources.json`

先为每家公司建立完整的数据源档案，再决定哪些来源进入自动抓取：

- `docs/data_source_profile_template.md`

建议先为每家公司配置：

- 公司别名
- 主要产品/技术关键词
- 竞品/市场关键词
- 官网 news/event 页面
- Google News RSS 查询

等 ACRO 标本跑顺后，再批量复制这套结构。
