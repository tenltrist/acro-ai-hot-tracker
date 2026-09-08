# 公司品牌标识

更新日期：2026-09-08。

## 范围和来源

当前覆盖 34 家持续监测公司中的 30 家：本公司 1 家、竞品 17 家、客户 / 市场账户 12 家。
232 家日本账户目录不是 232 家已确认客户；目录中已关联监测公司的条目复用同一份标识，其他账户不推断 Logo。

来源清单为 `config/company_logos.json`。每张图片保留官网、证据页面、原始图片链接、获取日期、SHA-256。
26 张来自官网或官方品牌资产，4 张取自公司官方新闻稿（Abcam、Sino Biological、Sigma-Aldrich、Bio-Techne）。新闻稿素材可核实归属，但不声称是最新品牌规范。

R&D Systems、MedChemExpress、CellGenix、PeproTech 的原图待补，显示公司名称和简短文字占位，不伪造 Logo、不替换成集团标识。
公司分组、竞争关系和客户关系判断不因 Logo 而变更。商标权归各品牌所有，展示不表示合作、客户认证或官方背书。

## 展示位置

- 左侧监控公司列表。
- 公司池的公司名称旁。
- 总览的竞品动作矩阵、客户优先列表。
- 公司数据源档案标题。
- 日本账户目录及详情中已匹配的监测公司。

标识保留原比例，不裁剪、不重新着色；白色原图使用深色底。图片加载失败时保留文字，公司筛选和跳转仍可使用。

## 更新和验证

原图保存在 `web/assets/company-logos/`。新增标识时先核对原始发布主体，再更新清单；不要根据名字自动匹配搜索结果。

`scripts/build_share_page.py` 将图片嵌入 `web/embedded-data.js` 和单文件分享页。本地文件与 GitHub Pages 使用同一份图片，访客无需访问外部 Logo 服务。

```sh
python3 scripts/build_share_page.py
python3 scripts/validate_company_logos.py
python3 scripts/validate_dashboard.py
```

浏览器回归脚本：`scripts/test_company_logos.cjs`。使用 Playwright 和已安装的 Chrome，检查桌面 / 手机、跨页面一致性、原图解码和失败回退。
