# AI Hot Tracker MVP

这是一个面向“目标公司热点追踪平台”的本地 MVP。第一版先拿 ACROBiosystems / 百普赛斯做标本对象，验证三件事：

1. 能不能用低成本公开来源收集候选新闻。
2. 能不能用规则把“值得推送”和“只是提到公司名”的噪音分开。
3. 能不能每天生成一份可读的公司情报简报。

当前公司池：

- ACROBiosystems / 百普赛斯
- Thermo Fisher Scientific

当前活动生态来源：

- LINK-J 公开活动列表
- 近畿生物产业振兴会议官方 RSS
- 湘南 iPark 新闻与活动公告

这三个平台是跨公司的监测数据源，不属于公司池。抓到内容后，系统再用公司别名匹配 ACRO、Thermo Fisher 或后续加入的对标公司。

## 核心判断

第一版不做实时推送，也不接付费新闻 API。默认机制是：

- 高分内容：标记为 `immediate`，理论上可以接即时提醒。
- 中分内容：进入每日简报。
- 低分内容：归档，不主动推送。
- 明显噪音：过滤。

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

如果只是想试跑，不更新已读状态：

```bash
python3 ai_hot_tracker/scripts/run_daily.py --dry-run
```

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
