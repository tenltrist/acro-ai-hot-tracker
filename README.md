# AI Hot Tracker MVP

这是一个面向“目标公司热点追踪平台”的本地 MVP。第一版先拿 ACROBiosystems / 百普赛斯做标本对象，验证三件事：

1. 能不能用低成本公开来源收集候选新闻。
2. 能不能用规则把“值得推送”和“只是提到公司名”的噪音分开。
3. 能不能每天生成一份可读的公司情报简报。

监测公司池由基础公司配置与重点账户配置在运行时自动合并，以 ACROBiosystems / 百普赛斯为本公司标本，并接入 232 家日本市场账户目录。页面上的公司数、持续监测账户数、来源数和覆盖档案都由同一次跑批生成。平台不再只是新闻阅读器，而是以公司为锚点的市场情报层：把新闻、活动、产品和关系证据沉淀到公司档案，再交给市场或销售继续处理。

业务角色写在 `config/companies.json`。竞品与客户/账户分开，不是为了多做一套标签，而是为了进入不同动作链路：

- 竞品动态：判断别人正在做什么，进入产品、技术、区域和市场话术对标。
- 公开关系账户：结合外部动态判断需求与跟进时机。
- 市场账户：出现有效动态后，再判断是否值得开发为潜客。

日本账户公开配置写在 `config/japan_accounts.json`。源销售表中的内部销售状态只在导入时校验，不会写入配置或 GitHub Pages；公开页面只显示公开可验证关系与外部动态。

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

页面中的摘要会明确标注来源：自动流水线使用“规则提要”；高价值条目可导出到 ChatGPT Pro 人工批处理，核对原文后以“ChatGPT Pro 人工复核摘要”回填。当前自动运行不调用付费 LLM API，也不把规则模板冒充 AI 总结。

每条信息还会保存一组证据字段：原始入口、来源类型、可引用摘录、核验状态和关联链接。页面默认只突出业务摘要与建议动作，证据、六组结构化字段和处理状态放在展开区，避免单张卡片承载过多内容。

首页默认按市场决策顺序组织：先由“AI 情报助手”回答今天应该做什么，再看重点账户行动矩阵、竞品对标、账户机会和合作生态，最后用趋势、地区与原文证据验证判断。每条行动同时显示建议动作、负责人和当前处理状态。

重点账户行动矩阵从同一轮抓取结果动态计算。排序综合近 90 天进入日报信号、ACRO 中高相关密度、时效性和来源多样性；“公开关系证据”和“关系待确认”分开展示。该优先指数只用于安排市场与销售的核验顺序，不代表成交概率，也不会把 232 家账户目录自动解释成客户。

静态页面中的情报助手目前是证据驱动的规则分析：支持提问账户跟进、竞品应对、日本热点和数据源健康，并可点击答案进入对应证据。它不在浏览器中保存模型密钥，也不会把规则答案伪装成大模型生成。

“公司时间线”按公司沉淀全部命中记录、日报信号、来源数、主题和动作分布。信号的“待处理 / 已阅读 / 已核验 / 已行动 / 已归档”状态目前保存在当前浏览器，适合个人试用；多人共享状态仍需要后端数据库。

日本账户页默认只加载前 40 个账户并支持继续展开，避免一次渲染完整目录。ACRO 运营档案读取本轮真实来源、覆盖、产出和异常统计，不使用静态试运行文案。

这样可以避免“公司名一出现就乱推送”的问题。

## 运行

```bash
python3 ai_hot_tracker/scripts/run_daily.py
```

更新日本账户目录时，传入销售工作簿路径：

```bash
python3 ai_hot_tracker/scripts/import_japan_accounts.py "/path/to/Global Data-日本客户列表.xlsx" --private-status-column "<内部字段名>"
```

该命令只生成公开安全的账户目录，不导出工作簿中的内部关系状态。

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

当前没有数据库，而是按用途分开保存 Git 版本化 JSON：

- `data/latest_run.json`：页面使用的最新完整快照。
- `data/history/YYYY-MM-DD.json`：每日历史快照。
- `data/seen_urls.json`：跨轮去重索引。
- `data/source_snapshots.json`：官网页面变化检测状态。
- `data/manual_summaries.json`：已核验的 ChatGPT Pro 人工摘要。
- `api/public/*.json`：面向静态页面和后续 Agent 的公开快照。

页面上的反馈、处理状态和语言偏好只保存在当前浏览器 `localStorage`，不会回写 GitHub，也不会在多个用户之间同步。

每轮运行会在同一个 `latest_run.json` 中同时更新新闻列表、汇总指标和
`source_health`。网页右上角的同步按钮会重新读取这份最新结果，因此数据源健康与
日报保持同一轮时间；该按钮只同步已完成的结果，不会直接在静态网页中启动抓取。

如果只是想试跑，不更新已读状态：

```bash
python3 ai_hot_tracker/scripts/run_daily.py --dry-run
```

### ChatGPT Pro 人工批处理摘要

当前策略是“自动规则 + 人工 AI 复核”，不使用自动付费 API。先导出日报/即时候选：

```bash
python3 scripts/export_manual_summary_batch.py --limit 20 --output /tmp/aihot-summary-batch.csv
```

将 CSV 中的公开标题、来源摘要、结构化字段和原文链接提交给 ChatGPT Pro，填写 `manual_summary`。人工打开原文核对后，将 `review_status` 填为 `verified` 或 `已核验`，然后导入：

```bash
python3 scripts/import_manual_summaries.py /tmp/aihot-summary-batch.csv
python3 scripts/run_daily.py --dry-run
```

回填数据保存在 `data/manual_summaries.json`，以稳定 item id 与新闻关联，页面会显示 `ChatGPT Pro 人工复核摘要`的来源标识。未通过人工核对的摘要不允许导入。

生成后可以运行数据一致性检查：

```bash
python3 ai_hot_tracker/scripts/validate_dashboard.py
python3 ai_hot_tracker/scripts/validate_rule_contract.py
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
