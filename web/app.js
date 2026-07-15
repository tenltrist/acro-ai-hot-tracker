const FEEDBACK_STORE_KEY = "aihot_feedback";

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFeedback(id, value) {
  const fb = loadFeedback();
  if (value === null) {
    delete fb[id];
  } else {
    fb[id] = { value, ts: new Date().toISOString() };
  }
  localStorage.setItem(FEEDBACK_STORE_KEY, JSON.stringify(fb));
  return fb;
}

const state = {
  payload: null,
  tier: "daily",
  signalType: "news",
  company: "all",
  category: "all",
  searchQuery: "",
  page: "overview",
  sourceStage: "all",
  healthCompany: "all",
  healthStatus: "all",
  feedback: loadFeedback(),
  history: null,
};

const sourceInventory = [
  {
    layer: "official",
    number: "01",
    title: "官方自有内容",
    subtitle: "公司自己发布的新闻、活动、技术内容和区域动态。官网直抓受限时，只使用公开索引结果，不绕过验证。",
    sources: [
      {
        name: "ACRO 官网 News",
        status: "active",
        trust: "A",
        method: "官网索引 RSS",
        note: "官网直抓会进入滑块验证；当前监控公开搜索已收录的官方 News 页。",
        sourceIds: ["acro_official_news_index"],
        url: "acrobiosystems.com/news",
      },
      {
        name: "ACRO Events / Webinar",
        status: "active",
        trust: "A",
        method: "Activities 索引 RSS",
        note: "监控 activities 栏目，并排除礼品、问卷、优惠和免费样品等促销噪音。",
        sourceIds: ["acro_official_activities_index"],
        url: "acrobiosystems.com/activities",
      },
      {
        name: "ACRO Insights / 技术内容",
        status: "active",
        trust: "A",
        method: "Insights 索引 RSS",
        note: "监控官方技术解读、应用文章和产品主题，属于内容与产品信号。",
        sourceIds: ["acro_official_insights_index"],
        url: "acrobiosystems.com/insights",
      },
      {
        name: "ACRO 日本官网",
        status: "active",
        trust: "A",
        method: "日文站定向 RSS",
        note: "用 jp 域名定向 RSS 观察日本市场页面；当前产出较少，但区域价值高。",
        sourceIds: ["acro_japan_official_index"],
        url: "jp.acrobiosystems.com",
      },
      {
        name: "Thermo Fisher IR / Press Release",
        status: "active",
        trust: "A",
        method: "官方 RSS",
        note: "直接读取官方结构化新闻稿，日期、标题和链接完整，是当前最稳定的官方来源。",
        sourceIds: ["thermo_official_rss"],
        url: "ir.thermofisher.com/rss/pressrelease.aspx",
      },
      {
        name: "Thermo Fisher Biotech at Scale Blog",
        status: "active",
        trust: "A",
        method: "官方 Blog RSS",
        note: "技术、CDMO、制造和行业活动内容，单独作为内容营销信号。",
        sourceIds: ["thermo_biotech_blog_rss"],
        url: "thermofisher.com/blog/biotechnology",
      },
      {
        name: "Thermo Fisher Newsroom",
        status: "covered",
        trust: "A",
        method: "IR RSS 已覆盖",
        note: "Newsroom HTML 直抓返回 403；主要新闻稿已由官方 IR RSS 覆盖，不再重复接入。",
        url: "newsroom.thermofisher.com",
      },
      {
        name: "官网 Sitemap 新 URL 差分",
        status: "planned",
        trust: "A",
        method: "URL 清单对比",
        note: "已确认 ACRO sitemap 可访问；未来只对比新增 URL，不依赖不准确的 lastmod。",
      },
    ],
  },
  {
    layer: "wire_media",
    number: "02",
    title: "新闻稿与行业媒体",
    subtitle: "外部新闻稿、行业媒体和区域媒体。用于补充官方来源，但需要跨来源去重和事件归并。",
    sources: [
      { name: "PR Newswire - ACRO", status: "active", trust: "B", method: "Google News site RSS", note: "定向补漏 ACRO 新闻稿，已进入当前抓取流。", sourceIds: ["google_news_acro_prnewswire"] },
      { name: "Business Wire 公司定向查询", status: "available", trust: "B", method: "site 搜索 RSS", note: "方法可用，但尚未按公司批量配置；等目标公司池稳定后接入。" },
      { name: "GlobeNewswire 公司定向查询", status: "available", trust: "B", method: "site 搜索 RSS", note: "方法可用，当前没有证明对 ACRO 比 PR Newswire 更有价值。" },
      { name: "BioSpace / Fierce / GEN", status: "planned", trust: "B", method: "RSS / 定向查询", note: "作为行业背景和竞品报道增强层，需先测试噪音率和重复率。" },
      { name: "日文行业媒体", status: "planned", trust: "B", method: "媒体清单 + RSS", note: "为日本市场信号单独建源，不与全球新闻混在一起。" },
      { name: "中文行业媒体", status: "planned", trust: "B", method: "媒体清单 + 人工复核", note: "先建立白名单，避免采集低质量转载和 SEO 页面。" },
    ],
  },
  {
    layer: "aggregator",
    number: "03",
    title: "聚合搜索补漏",
    subtitle: "作为补漏层覆盖分散公开新闻。它们是发现入口，不是事实来源，必须经过去重、相关性评分和原文核对。",
    sources: [
      { name: "Google News - ACRO 全球", status: "active", trust: "C", method: "RSS", note: "ACRO 主要外部补漏源，有效内容比例不高，但能发现媒体和合作方报道。", sourceIds: ["google_news_acro"] },
      { name: "Google News - ACRO 日本", status: "active", trust: "C", method: "日文 RSS", note: "命中少，本轮只进归档；保留用于日文区域补漏。", sourceIds: ["google_news_acro_jp"] },
      { name: "Google News - Thermo Fisher 全球", status: "active", trust: "C", method: "RSS", note: "产出量最大，同时也是归档噪音最多的来源，必须保留强过滤。", sourceIds: ["google_news_thermo"] },
      { name: "Google News - Thermo Fisher 日本", status: "active", trust: "C", method: "日文 RSS", note: "本轮数量高但全部归档，说明查询词过宽；下一步要收紧日本市场关键词。", sourceIds: ["google_news_thermo_jp"] },
      {
        name: "Bing News RSS — ACRO / Thermo",
        status: "active",
        trust: "C",
        method: "RSS 备用源",
        note: "只补 Google News 未覆盖的标题，跨来源标题去重后再进入新闻流。",
        sourceIds: ["bing_news_acro_backup", "bing_news_thermo_backup"],
      },
    ],
  },
  {
    layer: "social_content",
    number: "04",
    title: "社交与内容平台",
    subtitle: "观察内容传播、活动、招聘和区域声量。只有公开且结构化的官方频道自动接入，其他平台保留人工观察。",
    sources: [
      { name: "LinkedIn 公司主页", status: "manual", trust: "D", method: "人工查看", note: "产品/活动/招聘动态价值高，但不自动抓取" },
      { name: "微信公众号", status: "manual", trust: "D", method: "人工查看", note: "中国市场重要来源，自动化门槛高" },
      { name: "X / Twitter", status: "manual", trust: "D", method: "人工查看", note: "海外会议和活动传播，目前不申请付费 API" },
      {
        name: "Thermo Fisher 官方 YouTube",
        status: "active",
        trust: "A",
        method: "Atom RSS",
        note: "免费订阅官方频道更新，作为独立视频信号，不混入默认新闻流。",
        sourceIds: ["thermo_youtube_official"],
        url: "youtube.com/@thermofisher",
      },
      { name: "ACRO 官方 YouTube", status: "planned", trust: "A", method: "待确认 Channel ID", note: "确认官方频道后可使用同样的 Atom RSS 免费接入。" },
      { name: "Bilibili", status: "manual", trust: "D", method: "人工观察", note: "先作为中国市场内容渠道观察，不进入 MVP 自动抓取。" },
    ],
  },
  {
    layer: "market_channel",
    number: "05",
    title: "市场活动与渠道",
    subtitle: "观察展会、Webinar、经销商、合作伙伴和客户案例。这一类信号业务价值高，但来源分散，需按公司建白名单。",
    sources: [
      { name: "重点展会日历", status: "planned", trust: "B", method: "白名单 + 日历", note: "为目标展会建立主办方、日期、参展商和主题记录，不抓全网展会。" },
      { name: "Webinar 报名平台", status: "manual", trust: "B", method: "人工复核", note: "页面结构不一且常有表单，先用人工记录重要事件。" },
      { name: "经销商 / 代理商新闻页", status: "planned", trust: "C", method: "公司白名单", note: "等公司池完成分类后，只接入重点区域经销商的公开页。" },
      { name: "合作伙伴新闻页", status: "planned", trust: "B", method: "定向 RSS / 新 URL", note: "用于补齐合作另一方的表述，并与 ACRO 事件归并。" },
      { name: "客户案例 / 应用笔记", status: "planned", trust: "B", method: "新页面监控", note: "商业落地价值高，但更新频率低，适合低频检查。" },
    ],
  },
  {
    layer: "research_regulatory",
    number: "06",
    title: "研发监管与组织信号",
    subtitle: "论文、监管、公司申报、专利和组织变化。这些信号与新闻分开展示，避免用论文或历史监管记录撑大日报。",
    sources: [
      {
        name: "PubMed — ACRO",
        status: "active",
        trust: "B",
        method: "E-utilities API",
        note: "单独进入论文信号；不进默认新闻日报。",
        sourceIds: ["acro_pubmed_research"],
      },
      { name: "Crossref 科研元数据", status: "planned", trust: "B", method: "REST API", note: "作为 PubMed 之外的免费补充，需配置真实联系邮箱并做本地缓存。" },
      { name: "ClinicalTrials.gov", status: "available", trust: "A", method: "公开 API", note: "接口已验证可用；ACRO 命中 0，Thermo 多为试验中使用设备，相关性不足，暂不运行。" },
      {
        name: "openFDA — Thermo 召回监控",
        status: "active",
        trust: "A",
        method: "公开 API",
        note: "监控任务正在运行，但只显示两年内记录；历史召回不灌入页面。",
        sourceIds: ["thermo_openfda_monitor"],
      },
      {
        name: "SEC EDGAR — Thermo",
        status: "available",
        trust: "A",
        method: "官方 JSON API（待配置）",
        note: "解析规则已完成，将只保留 8-K、10-Q、10-K；当前不发请求。",
        sourceIds: ["thermo_sec_filings"],
        url: "data.sec.gov/submissions",
      },
      { name: "EPO OPS 专利信号", status: "planned", trust: "A", method: "OAuth API", note: "免费额度足够 MVP，但需注册、OAuth 和公司名称归一，放在第二阶段。" },
      { name: "EDINET / PMDA 日本公开信号", status: "planned", trust: "A", method: "API / 公开索引", note: "为日本市场建立公司公告和监管专题，不与日文新闻混用。" },
      { name: "招聘网站", status: "manual", trust: "D", method: "人工复核", note: "用于观察组织扩张、区域布局和技术方向，暂不自动抓取。" },
    ],
  },
  {
    layer: "restricted",
    number: "07",
    title: "高风险受限来源",
    subtitle: "可能有价值，但权限、合规、版权和稳定性风险高。记录存在，MVP 不抓取，不绕过限制。",
    sources: [
      { name: "需要登录的平台", status: "blocked", trust: "—", method: "不抓取", note: "权限和账号合规问题" },
      { name: "反爬严重网站", status: "blocked", trust: "—", method: "不抓取", note: "稳定性、成本、合规三重风险" },
      { name: "付费墙内容", status: "blocked", trust: "—", method: "不抓取", note: "版权和授权限制" },
      { name: "私域社群 / 群聊", status: "blocked", trust: "—", method: "不抓取", note: "非公开内容，不应进入系统" },
      { name: "个人账号内容", status: "blocked", trust: "—", method: "不抓取", note: "隐私、误读和噪音风险" },
      { name: "robots.txt 禁止路径", status: "blocked", trust: "—", method: "不抓取", note: "遵守 robots 协议，不强行绕过" },
    ],
  },
  {
    layer: "paid_later",
    number: "08",
    title: "商业数据服务",
    subtitle: "覆盖更稳定、更全面。等 MVP 证明价值后再申请预算评估，不在一开始烧钱。",
    sources: [
      { name: "新闻 API（NewsAPI / GNews / Mediastack）", status: "paid", trust: "A", method: "API", note: "等免费来源证明价值后，再用预算换覆盖率和稳定性。" },
      { name: "商业情报数据库", status: "paid", trust: "A", method: "API / 导出", note: "企业、产品、管线和融资数据，用于竞品深度分析而不是日常新闻。" },
      { name: "LinkedIn 官方 API", status: "paid", trust: "B", method: "API", note: "只在公司明确需要社交和招聘信号时评估。" },
      { name: "微信生态监控服务", status: "paid", trust: "B", method: "第三方服务", note: "合规获取公众号和视频号内容，不自建绕过平台的抓取器。" },
      { name: "专利 / 临床数据库订阅", status: "paid", trust: "A", method: "API / 批量导出", note: "免费专利与临床接口不能满足稳定性后再考虑。" },
    ],
  },
];

const pageMeta = {
  overview: ["Market Intelligence Dashboard", "目标公司与行业热点雷达"],
  companies: ["Company Pool", "目标公司池"],
  sources: ["Source Map", "数据源地图与接入边界"],
  acro: ["Company Profile", "ACRO 样本档案"],
  pipeline: ["System Pipeline", "数据获取、处理、存储、展现链路"],
  questions: ["Open Questions", "待确认事项"],
  "source-health": ["Source Operations", "数据源健康与产出质量"],
};

const companyIdToDisplayName = {
  acro: "ACROBiosystems / 百普赛斯",
  thermo_fisher: "Thermo Fisher Scientific",
};

const fallbackPayload = {
  generated_at: new Date().toISOString(),
  window_days: 90,
  summary: {
    new_candidates: 43,
    immediate: 0,
    daily: 5,
    archive: 38,
    errors: 0,
    companies: 2,
    sources: 7,
  },
  category_mix: {
    partnership: 6,
    finance: 3,
    regulatory: 1,
    company: 33,
  },
  source_mix: {
    "Google News RSS - ACROBiosystems": 36,
    "ACROBiosystems official news": 5,
    "ACROBiosystems Japan official site": 2,
  },
  items: [
    {
      id: "sample-cgt",
      company: "ACROBiosystems / 百普赛斯",
      source_label: "Google News RSS - ACROBiosystems",
      source_trust: "aggregator",
      title: "Driving Innovation, Empowering Partners: ACROBiosystems Showcases Comprehensive CGT Solutions Anchored by GMP Capabilities at Bio Korea 2026",
      url: "#",
      published: "2026-06-01",
      ai_summary: "ACRO在Bio Korea 2026展示了CGT与GMP综合方案，突出其亚太市场活动传播能力。建议市场部关注该活动的后续报道，可作为LinkedIn和Newsletter选题。",
      summary: "ACRO 展示围绕 CGT 与 GMP 能力的综合解决方案，适合作为市场部观察亚太活动传播和产品线表达的样本。",
      score: 65,
      tier: "daily",
      category: "partnership",
      reasons: ["公司别名命中: ACROBiosystems", "战略主题命中: CGT, GMP", "业务动作命中: partner", "高价值分类加成 +10: partnership"],
      age_days: 35,
    },
    {
      id: "sample-ipo",
      company: "ACROBiosystems / 百普赛斯",
      source_label: "Google News RSS - ACROBiosystems",
      source_trust: "aggregator",
      title: "IPO News | ACROBiosystems Plans Hong Kong IPO",
      url: "#",
      published: "2026-05-29",
      ai_summary: "ACRO香港IPO进展涉及境外投资监管合规，属于公司级战略信号。对市场部而言，可用于判断公司品牌阶段和资本市场动态。",
      summary: "资本市场信号不一定直接给市场部使用，但对老板视角的公司动态和品牌阶段判断有参考价值。",
      score: 48,
      tier: "daily",
      category: "regulatory",
      reasons: ["公司别名命中: ACROBiosystems", "高价值分类加成 +8: regulatory"],
      age_days: 38,
    },
  ],
};

const els = {
  metricCandidates: document.querySelector("#metricCandidates"),
  metricDaily: document.querySelector("#metricDaily"),
  metricImmediate: document.querySelector("#metricImmediate"),
  metricArchive: document.querySelector("#metricArchive"),
  updatedAt: document.querySelector("#updatedAt"),
  signalList: document.querySelector("#signalList"),
  topicBars: document.querySelector("#topicBars"),
  sourceList: document.querySelector("#sourceList"),
  sourceCount: document.querySelector("#sourceCount"),
  windowDays: document.querySelector("#windowDays"),
  tierFilter: document.querySelector("#tierFilter"),
  signalTypeFilter: document.querySelector("#signalTypeFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  companyFilter: document.querySelector("#companyFilter"),
  searchInput: document.querySelector("#searchInput"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  refreshButton: document.querySelector("#refreshButton"),
  healthStatus: document.querySelector("#healthStatus"),
  healthList: document.querySelector("#healthList"),
  healthGeneratedAt: document.querySelector("#healthGeneratedAt"),
  healthMetricTracked: document.querySelector("#healthMetricTracked"),
  healthMetricProducing: document.querySelector("#healthMetricProducing"),
  healthMetricSelected: document.querySelector("#healthMetricSelected"),
  healthMetricAttention: document.querySelector("#healthMetricAttention"),
  healthAttentionDetail: document.querySelector("#healthAttentionDetail"),
  healthCompanyFilter: document.querySelector("#healthCompanyFilter"),
  healthStatusFilter: document.querySelector("#healthStatusFilter"),
  healthRowCount: document.querySelector("#healthRowCount"),
  healthTableBody: document.querySelector("#healthTableBody"),
  trendList: document.querySelector("#trendList"),
  trendDays: document.querySelector("#trendDays"),
  pageEyebrow: document.querySelector("#pageEyebrow"),
  pageTitle: document.querySelector("#pageTitle"),
  toolbar: document.querySelector(".toolbar"),
  ruleGrid: document.querySelector("#ruleGrid"),
  sourceStageFilter: document.querySelector("#sourceStageFilter"),
  sourceStageCount: document.querySelector("#sourceStageCount"),
  pagePanels: document.querySelectorAll("[data-page]"),
  pageButtons: document.querySelectorAll("[data-page-target]"),
};

async function loadData() {
  if (window.AIHOT_EMBEDDED_PAYLOAD) {
    state.payload = window.AIHOT_EMBEDDED_PAYLOAD;
    state.history = window.AIHOT_EMBEDDED_HISTORY || null;
    hydrateFilters();
    render();
    renderSourceHealth();
    renderSourceHealthPage();
    renderTrend();
    return;
  }

  try {
    let response = await fetch("../data/latest_run.json", { cache: "no-store" });
    if (!response.ok) {
      response = await fetch("./data/latest_run.json", { cache: "no-store" });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.payload = await response.json();
  } catch (error) {
    state.payload = fallbackPayload;
  }

  // Try loading yesterday's snapshot for trend comparison
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.toISOString().slice(0, 10);
    const histResp = await fetch(`../data/history/${ymd}.json`, { cache: "no-store" });
    if (histResp.ok) {
      state.history = await histResp.json();
    } else {
      state.history = null;
    }
  } catch {
    state.history = null;
  }

  hydrateFilters();
  render();
  renderSourceHealth();
  renderSourceHealthPage();
  renderTrend();
}

function hydrateFilters() {
  const categories = [...new Set(state.payload.items.map((item) => item.category))].sort();
  const companies = [...new Set(state.payload.items.map((item) => item.company))].sort();
  const current = els.categoryFilter.value;
  const currentCompany = els.companyFilter.value;
  els.categoryFilter.innerHTML = '<option value="all">全部主题</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = labelCategory(category);
    els.categoryFilter.appendChild(option);
  }
  els.categoryFilter.value = categories.includes(current) ? current : "all";

  els.companyFilter.innerHTML = '<option value="all">全部公司</option>';
  for (const company of companies) {
    const option = document.createElement("option");
    option.value = company;
    option.textContent = company;
    els.companyFilter.appendChild(option);
  }
  els.companyFilter.value = companies.includes(currentCompany) ? currentCompany : "all";
}

function render() {
  const { payload } = state;
  els.windowDays.textContent = `${payload.window_days} 天`;
  els.updatedAt.textContent = `更新于 ${formatDateTime(payload.generated_at)}`;

  renderOverviewScope();
  renderRules();
  renderPage();
}

function getSignalTypeItems() {
  return state.payload.items.filter(
    (item) => state.signalType === "all" || (item.signal_type || "news") === state.signalType,
  );
}

function renderOverviewScope() {
  const scoped = getSignalTypeItems();
  const hasNewFlags = scoped.some((item) => typeof item.is_new === "boolean");
  els.metricCandidates.textContent = hasNewFlags
    ? scoped.filter((item) => item.is_new).length
    : state.payload.summary.new_candidates;
  els.metricDaily.textContent = scoped.filter((item) => item.tier === "daily").length;
  els.metricImmediate.textContent = scoped.filter((item) => item.tier === "immediate").length;
  els.metricArchive.textContent = scoped.filter((item) => item.tier === "archive").length;
  els.sourceCount.textContent = `${new Set(scoped.map((item) => item.source_id || item.source_label)).size} sources`;

  const categoryMix = {};
  for (const item of scoped) {
    categoryMix[item.category] = (categoryMix[item.category] || 0) + 1;
  }
  renderSignals();
  renderBars(els.topicBars, categoryMix, labelCategory);
  renderSources(scoped);
}

function renderRules() {
  const allSources = sourceInventory.flatMap((cat) => cat.sources);
  const visibleCount = allSources.filter(
    (source) => state.sourceStage === "all" || source.status === state.sourceStage,
  ).length;
  els.sourceStageCount.textContent = state.sourceStage === "all"
    ? `共 ${allSources.length} 个来源入口`
    : `显示 ${visibleCount} / ${allSources.length} 个来源入口`;

  els.ruleGrid.innerHTML = sourceInventory
    .map((cat) => {
      const visibleSources = cat.sources.filter(
        (source) => state.sourceStage === "all" || source.status === state.sourceStage,
      );
      if (!visibleSources.length) return "";
      return `
        <section class="rule-lane ${cat.layer}">
          <div class="rule-lane-head">
            <div class="rule-lane-title">
              <span class="lane-number">${cat.number}</span>
              <h3>${escapeHtml(cat.title)}</h3>
              <span class="lane-summary">${summaryForCategory(visibleSources)}</span>
            </div>
            <p>${escapeHtml(cat.subtitle)}</p>
          </div>
          <div class="source-grid">
            ${visibleSources
              .map(
                (src) => {
                  const result = liveSourceResult(src);
                  return `
                  <article class="source-card">
                    <div class="source-card-top">
                      <strong>${escapeHtml(src.name)}</strong>
                      <span class="status-pill ${src.status}">${labelStatus(src.status)}</span>
                    </div>
                    <div class="source-card-meta">
                      <span class="trust-badge trust-${src.trust.toLowerCase().replace(/[^a-e]/g, "")}">可信 ${src.trust}</span>
                      <span class="method-tag">${escapeHtml(src.method)}</span>
                      ${src.url ? `<span class="url-hint">${escapeHtml(src.url)}</span>` : ""}
                    </div>
                    <p class="source-card-note">${escapeHtml(src.note)}</p>
                    ${result ? `<div class="source-card-result"><span>${src.status === "active" ? "本轮" : "依据"}</span>${escapeHtml(result)}</div>` : ""}
                  </article>`;
                },
              )
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function summaryForCategory(sources) {
  const counts = {};
  for (const src of sources) {
    counts[src.status] = (counts[src.status] || 0) + 1;
  }
  const parts = [];
  if (counts.active) parts.push(`${counts.active} 现在在用`);
  if (counts.available) parts.push(`${counts.available} 可用待接`);
  if (counts.planned) parts.push(`${counts.planned} 未来开发`);
  if (counts.manual) parts.push(`${counts.manual} 人工`);
  if (counts.covered) parts.push(`${counts.covered} 已覆盖`);
  if (counts.blocked) parts.push(`${counts.blocked} 不接入`);
  if (counts.paid) parts.push(`${counts.paid} 付费候选`);
  return parts.join(" · ");
}

function liveSourceResult(source) {
  if (!source.sourceIds?.length || !Array.isArray(state.payload?.source_health)) {
    return source.result || "";
  }
  const rows = state.payload.source_health.filter((row) => source.sourceIds.includes(row.source_id));
  if (!rows.length) return source.result || "";
  const pending = rows.find((row) => row.status === "pending");
  if (pending) return pending.note || "解析规则已准备，配置完成前不发起请求。";
  const errors = rows.filter((row) => row.status === "error");
  if (errors.length) return `抓取异常：${errors.map((row) => row.error).join("; ")}`;
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const selected = rows.reduce((sum, row) => sum + row.immediate + row.daily, 0);
  const archive = rows.reduce((sum, row) => sum + row.archive, 0);
  const latest = rows.map((row) => row.last_published).filter(Boolean).sort().at(-1) || "暂无";
  if (!total) return `监控正在运行，时效窗口内 0 条，最后内容：${latest}`;
  return `候选 ${total} 条 · 日报 ${selected} 条 · 归档 ${archive} 条 · 最后内容 ${latest}`;
}

function renderPage() {
  const [eyebrow, title] = pageMeta[state.page] || pageMeta.overview;
  els.pageEyebrow.textContent = eyebrow;
  els.pageTitle.textContent = title;
  els.toolbar.hidden = state.page !== "overview";
  els.pagePanels.forEach((panel) => {
    panel.hidden = panel.dataset.page !== state.page;
  });
  els.pageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.pageTarget === state.page);
  });
}

function renderSignals() {
  const query = state.searchQuery.toLowerCase().trim();
  const filtered = state.payload.items
    .filter((item) => state.tier === "all" || item.tier === state.tier)
    .filter((item) => state.signalType === "all" || (item.signal_type || "news") === state.signalType)
    .filter((item) => state.company === "all" || item.company === state.company)
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => {
      if (!query) return true;
      const haystack = `${item.title} ${item.summary} ${item.ai_summary || ""} ${item.company} ${item.reasons.join(" ")}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.score - a.score);

  els.signalList.innerHTML = "";
  const countSuffix = query ? `（搜索"${escapeHtml(state.searchQuery)}"，共 ${filtered.length} 条）` : "";
  if (!filtered.length) {
    els.signalList.innerHTML = `<div class="empty">当前筛选条件下没有需要展示的信号。${countSuffix}</div>`;
    return;
  }

  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "signal-card";
    const fb = state.feedback[item.id];
    const fbClass = fb ? `voted-${fb.value}` : "";
    card.innerHTML = `
      <div class="signal-top">
        <a class="signal-title" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        <span class="score">${item.score}</span>
      </div>
      <div class="meta-row">
        <span class="tag ${item.tier}">${labelTier(item.tier)}</span>
        <span class="tag type-tag">${labelSignalType(item.signal_type || "news")}</span>
        <span class="tag">${labelCategory(item.category)}</span>
        <span class="tag">${escapeHtml(item.company)}</span>
        <span class="tag">${escapeHtml(item.published || "no date")}</span>
      </div>
      <p class="summary">${escapeHtml(item.ai_summary || item.summary || "暂无摘要，建议回原文核对。")}</p>
      <ul class="reason-list">
        ${item.reasons.slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
      </ul>
      <div class="feedback-row ${fbClass}">
        <span class="feedback-label">这条有用吗？</span>
        <button class="fb-btn fb-up${fb && fb.value === "up" ? " active" : ""}" data-id="${item.id}" data-action="up" title="有用">👍 有用</button>
        <button class="fb-btn fb-down${fb && fb.value === "down" ? " active" : ""}" data-id="${item.id}" data-action="down" title="无用">👎 无用</button>
        ${fb ? '<span class="fb-thanks">已反馈，谢谢！</span>' : ""}
      </div>
    `;
    els.signalList.appendChild(card);
  }

  // Bind feedback button events after DOM is built
  els.signalList.querySelectorAll(".fb-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const current = state.feedback[id];
      // Toggle off if clicking same action again
      const newValue = current && current.value === action ? null : action;
      state.feedback = saveFeedback(id, newValue);
      renderSignals(); // re-render to update UI
    });
  });
}

function renderBars(container, data, labeler) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  container.innerHTML = entries
    .map(([key, value]) => {
      const width = Math.max(8, Math.round((value / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label"><span>${escapeHtml(labeler(key))}</span><strong>${value}</strong></div>
          <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderSources(items = getSignalTypeItems()) {
  const sourceMix = {};
  for (const item of items) {
    sourceMix[item.source_label] = (sourceMix[item.source_label] || 0) + 1;
  }
  const entries = Object.entries(sourceMix).sort((a, b) => b[1] - a[1]).slice(0, 6);
  els.sourceList.innerHTML = entries
    .map(([name, count]) => `<div class="source-item"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>`)
    .join("");
}

function labelStatus(status) {
  return {
    active: "现在在用",
    available: "可用待接",
    planned: "未来开发",
    covered: "已覆盖",
    manual: "人工观察",
    blocked: "不接入",
    paid: "付费候选",
  }[status] || status;
}

function labelTier(tier) {
  return {
    immediate: "即时提醒",
    daily: "进入日报",
    archive: "归档观察",
  }[tier] || tier;
}

function labelCategory(category) {
  return {
    partnership: "合作 / 伙伴",
    product: "产品 / 技术",
    event: "展会 / 活动",
    regulatory: "监管 / 申报",
    finance: "资本 / 财务",
    award: "奖项 / 认可",
    market: "市场扩张",
    company: "公司动态",
    video: "视频 / Webinar",
    research: "论文 / 研究",
    uncategorized: "未分类",
  }[category] || category;
}

function labelSignalType(type) {
  return {
    news: "新闻",
    video: "视频",
    filing: "公司公告",
    regulatory: "监管风险",
    research: "论文研究",
  }[type] || type;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function renderSourceHealth() {
  const errors = state.payload.errors || [];
  const sourceNames = new Set(state.payload.items.map((item) => item.source_label));
  const allActiveSources = [...sourceNames];

  const total = allActiveSources.length;
  const errorCount = errors.length;
  els.healthStatus.textContent = errorCount > 0 ? `${errorCount} 异常 / ${total} 来源` : `${total} 来源正常`;

  if (errors.length === 0) {
    els.healthList.innerHTML = '<div class="health-ok">所有来源运行正常 ✓</div>';
    return;
  }

  els.healthList.innerHTML = errors
    .map((err) => {
      const parts = err.split(": ");
      const sourceId = parts[0];
      const message = parts.slice(1).join(": ");
      const source = sourceInventory
        .flatMap((cat) => cat.sources)
        .find((s) => s.name.toLowerCase().includes(sourceId.replace(/_/g, " ").toLowerCase()));
      const note = source ? source.note : "";
      return `<div class="health-item error">
        <span class="health-source">${escapeHtml(sourceId)}</span>
        <span class="health-msg">${escapeHtml(message)}</span>
        ${note ? `<span class="health-note">${escapeHtml(note)}</span>` : ""}
      </div>`;
    })
    .join("");
}

function getSourceHealthRows() {
  if (Array.isArray(state.payload.source_health)) return state.payload.source_health;
  const grouped = {};
  for (const item of state.payload.items || []) {
    const id = item.source_id || item.source_label;
    if (!grouped[id]) {
      grouped[id] = {
        source_id: id,
        source_label: item.source_label,
        company_id: item.company_id || "",
        company: item.company,
        source_type: "unknown",
        signal_type: item.signal_type || "news",
        status: "archive_only",
        total: 0,
        immediate: 0,
        daily: 0,
        archive: 0,
        selected_rate: 0,
        last_published: "",
        error: "",
        note: "",
      };
    }
    const row = grouped[id];
    row.total += 1;
    row[item.tier] = (row[item.tier] || 0) + 1;
    if (item.published && item.published > row.last_published) row.last_published = item.published;
  }
  return Object.values(grouped).map((row) => {
    const selected = row.immediate + row.daily;
    row.selected_rate = row.total ? Math.round((selected / row.total) * 100) : 0;
    row.status = selected ? "productive" : "archive_only";
    return row;
  });
}

function renderSourceHealthPage() {
  const rows = getSourceHealthRows();
  const companies = [...new Set(rows.map((row) => row.company).filter(Boolean))].sort();
  const previousCompany = els.healthCompanyFilter.value || state.healthCompany;
  els.healthCompanyFilter.innerHTML = '<option value="all">全部公司</option>';
  for (const company of companies) {
    const option = document.createElement("option");
    option.value = company;
    option.textContent = company;
    els.healthCompanyFilter.appendChild(option);
  }
  state.healthCompany = companies.includes(previousCompany) ? previousCompany : "all";
  els.healthCompanyFilter.value = state.healthCompany;

  els.healthGeneratedAt.textContent = `本轮运行 ${formatDateTime(state.payload.generated_at)}`;
  els.healthMetricTracked.textContent = rows.length;
  els.healthMetricProducing.textContent = rows.filter((row) => row.total > 0).length;
  els.healthMetricSelected.textContent = rows.filter((row) => row.immediate + row.daily > 0).length;
  const quietCount = rows.filter((row) => row.status === "quiet").length;
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  els.healthMetricAttention.textContent = quietCount + pendingCount + errorCount;
  els.healthAttentionDetail.textContent = `${quietCount} 个暂无内容 · ${pendingCount} 个待配置 · ${errorCount} 个异常`;

  const visible = rows
    .filter((row) => state.healthCompany === "all" || row.company === state.healthCompany)
    .filter((row) => state.healthStatus === "all" || row.status === state.healthStatus)
    .sort((a, b) => {
      const order = { error: 0, pending: 1, quiet: 2, archive_only: 3, productive: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.total - a.total;
    });

  els.healthRowCount.textContent = `显示 ${visible.length} / ${rows.length} 个运行入口 · 需处理的来源优先排在前面`;
  if (!visible.length) {
    els.healthTableBody.innerHTML = '<div class="health-table-empty">当前筛选下没有数据源。</div>';
    return;
  }

  els.healthTableBody.innerHTML = visible
    .map((row) => {
      const selected = row.immediate + row.daily;
      const detail = row.error || row.note || healthStatusDescription(row.status);
      return `<div class="health-table-row" role="row">
        <span class="health-name"><strong>${escapeHtml(row.source_label)}</strong><small>${escapeHtml(row.company || row.company_id)}</small></span>
        <span><span class="health-type">${escapeHtml(labelSignalType(row.signal_type))}</span><small>${escapeHtml(row.source_type)}</small></span>
        <strong>${row.total}</strong>
        <strong class="health-selected">${selected}</strong>
        <span>${row.archive}</span>
        <span>${row.selected_rate}%</span>
        <span>${escapeHtml(row.last_published || "—")}</span>
        <span class="health-status-cell"><span class="health-state ${row.status}">${healthStatusLabel(row.status)}</span><small title="${escapeAttr(detail)}">${escapeHtml(detail)}</small></span>
      </div>`;
    })
    .join("");
}

function healthStatusLabel(status) {
  return {
    productive: "有效产出",
    archive_only: "仅归档",
    quiet: "暂无内容",
    pending: "待配置",
    error: "抓取异常",
  }[status] || status;
}

function healthStatusDescription(status) {
  return {
    productive: "本轮有内容进入日报",
    archive_only: "本轮产出均为归档观察",
    quiet: "时效窗口内暂无新内容",
    pending: "需完成配置后再启用",
    error: "本轮请求失败",
  }[status] || "";
}

function renderTrend() {
  if (!state.history) {
    els.trendList.innerHTML = '<div class="trend-empty">暂无历史数据对比</div>';
    els.trendDays.textContent = "vs 昨日";
    return;
  }

  const prev = state.history.summary;
  const curr = state.payload.summary;
  const daysAgo = Math.round(
    (new Date(state.payload.generated_at) - new Date(state.history.date)) / 86400000
  );
  els.trendDays.textContent = `vs ${daysAgo || 1} 天前`;

  const rows = [
    { label: "新候选", curr: curr.new_candidates, prev: prev.new_candidates },
    { label: "进入日报", curr: curr.daily, prev: prev.daily },
    { label: "即时提醒", curr: curr.immediate, prev: prev.immediate },
    { label: "噪音压制", curr: curr.archive, prev: prev.archive },
  ];

  els.trendList.innerHTML = rows
    .map((row) => {
      const delta = row.curr - row.prev;
      let deltaStr = "";
      let deltaClass = "";
      if (delta > 0) {
        deltaStr = `↑${delta}`;
        deltaClass = "trend-up";
      } else if (delta < 0) {
        deltaStr = `↓${Math.abs(delta)}`;
        deltaClass = "trend-down";
      } else {
        deltaStr = "→";
        deltaClass = "trend-flat";
      }
      return `<div class="trend-row">
        <span class="trend-label">${row.label}</span>
        <span class="trend-curr">${row.curr}</span>
        <span class="trend-delta ${deltaClass}">${deltaStr}</span>
        <span class="trend-prev">(${row.prev})</span>
      </div>`;
    })
    .join("");
}

function exportCsv() {
  const filtered = getFilteredItems();
  if (!filtered.length) {
    alert("当前没有可导出的数据。");
    return;
  }

  const headers = ["标题", "公司", "情报类型", "来源", "发布日期", "分数", "分层", "分类", "理由", "摘要", "URL"];
  const rows = [headers.join(",")];
  for (const item of filtered) {
    rows.push(
      [
        csvCell(item.title),
        csvCell(item.company),
        csvCell(labelSignalType(item.signal_type || "news")),
        csvCell(item.source_label),
        csvCell(item.published || ""),
        item.score,
        csvCell(labelTier(item.tier)),
        csvCell(labelCategory(item.category)),
        csvCell(item.reasons.slice(0, 3).join("; ")),
        csvCell(item.ai_summary || item.summary || ""),
        item.url,
      ].join(",")
    );
  }

  const bom = "﻿";
  const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-hot-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

function getFilteredItems() {
  const query = state.searchQuery.toLowerCase().trim();
  return state.payload.items
    .filter((item) => state.tier === "all" || item.tier === state.tier)
    .filter((item) => state.signalType === "all" || (item.signal_type || "news") === state.signalType)
    .filter((item) => state.company === "all" || item.company === state.company)
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => {
      if (!query) return true;
      const haystack = `${item.title} ${item.summary} ${item.ai_summary || ""} ${item.company} ${item.reasons.join(" ")}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.score - a.score);
}

// ── Event listeners ──

// Metric cards: click to filter signals by tier
document.querySelectorAll(".metric.clickable").forEach((card) => {
  card.addEventListener("click", () => {
    const tier = card.dataset.tier;
    state.page = "overview";
    state.tier = tier;
    els.tierFilter.value = tier;
    renderPage();
    renderSignals();
  });
});

// Sidebar company chips: filter overview by company
document.querySelectorAll("[data-filter-company]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const companyId = chip.dataset.filterCompany;
    state.page = "overview";
    renderPage();

    if (companyId === "all") {
      state.company = "all";
      els.companyFilter.value = "all";
    } else {
      const companyName =
        state.payload?.companies?.find((c) => c.id === companyId)?.display_name ||
        companyIdToDisplayName[companyId] ||
        companyId;
      state.company = companyName;
      let matched = false;
      for (const opt of els.companyFilter.options) {
        if (opt.textContent === companyName) {
          els.companyFilter.value = companyName;
          matched = true;
          break;
        }
      }
      if (!matched) {
        state.company = "all";
        els.companyFilter.value = "all";
      }
    }
    renderSignals();
    document.querySelectorAll("[data-filter-company]").forEach((c) => {
      c.classList.toggle("active", c.dataset.filterCompany === companyId);
    });
  });
});

els.searchInput.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  renderSignals();
});

els.exportCsvButton.addEventListener("click", exportCsv);

els.tierFilter.addEventListener("change", (event) => {
  state.tier = event.target.value;
  renderSignals();
});

els.signalTypeFilter.addEventListener("change", (event) => {
  state.signalType = event.target.value;
  renderOverviewScope();
});

els.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  renderSignals();
});

els.companyFilter.addEventListener("change", (event) => {
  state.company = event.target.value;
  const selectedCompany =
    state.payload?.companies?.find((c) => c.display_name === state.company) ||
    Object.entries(companyIdToDisplayName)
      .map(([id, display_name]) => ({ id, display_name }))
      .find((c) => c.display_name === state.company);
  const companyId = selectedCompany?.id || "all";
  document.querySelectorAll("[data-filter-company]").forEach((c) => {
    c.classList.toggle("active", c.dataset.filterCompany === companyId);
  });
  renderSignals();
});

els.refreshButton.addEventListener("click", loadData);

els.sourceStageFilter.addEventListener("change", (event) => {
  state.sourceStage = event.target.value;
  renderRules();
});

els.healthCompanyFilter.addEventListener("change", (event) => {
  state.healthCompany = event.target.value;
  renderSourceHealthPage();
});

els.healthStatusFilter.addEventListener("change", (event) => {
  state.healthStatus = event.target.value;
  renderSourceHealthPage();
});

els.pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.page = button.dataset.pageTarget;
    renderPage();
  });
});

loadData();
