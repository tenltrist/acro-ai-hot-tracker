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
  feedback: loadFeedback(),
  history: null,
};

const sourceInventory = [
  {
    layer: "official",
    number: "01",
    title: "官方自有来源",
    subtitle: "这 6 类已经逐一实测。能用免费 RSS 的直接接入；官网直抓遇到验证码或 403 时，改用公开索引 RSS，不绕过网站限制。",
    sources: [
      {
        name: "ACRO 全球官网 News",
        status: "enabled",
        trust: "A",
        method: "官网定向 RSS",
        note: "官网直抓会进入滑块验证，现用 Google News 的 site 定向 RSS 获取官网已收录新闻。",
        result: "近 90 天命中 1 条，PMDA 相关内容质量高",
        url: "acrobiosystems.com/news",
      },
      {
        name: "ACRO Events / Webinar",
        status: "enabled",
        trust: "A",
        method: "官网定向 RSS",
        note: "监控官网 activities 栏目，并在抓取前排除礼品、问卷、优惠和免费样品等营销噪音。",
        result: "清洗后保留 4 条活动，空标题和促销内容已排除",
        url: "acrobiosystems.com/activities",
      },
      {
        name: "ACRO 日本官网",
        status: "enabled",
        trust: "A",
        method: "日文站定向 RSS",
        note: "日本站同样有滑块验证；改用 jp 域名定向 RSS，并限制在 180 天内。",
        result: "180 天内命中 2 条，当前以日本产品页更新为主",
        url: "jp.acrobiosystems.com",
      },
      {
        name: "Thermo Fisher IR / Press Release",
        status: "enabled",
        trust: "A",
        method: "官方 RSS",
        note: "直接读取官方结构化新闻稿，日期、标题和链接完整，是当前最稳定的官方来源。",
        result: "实测返回 10 条，HTTP 200，结构稳定",
        url: "ir.thermofisher.com/rss/pressrelease.aspx",
      },
      {
        name: "Thermo Fisher Newsroom",
        status: "covered",
        trust: "A",
        method: "IR RSS 替代",
        note: "Newsroom HTML 直抓返回 403，不单独抓取；同一批新闻稿由官方 IR RSS 覆盖，避免重复。",
        result: "HTML 不可用，但内容链路没有缺口",
        url: "newsroom.thermofisher.com",
      },
      {
        name: "产品 / Blog / 资源库",
        status: "enabled",
        trust: "A",
        method: "RSS + 定向 RSS",
        note: "接入 Thermo Biotech at Scale 官方 RSS，以及 ACRO Insights 的主题定向 RSS；只保留 180 天内内容。",
        result: "Thermo 3 个 Blog RSS 均可用，优先选最贴近生物医药的一条",
        url: "thermofisher.com/blog/biotechnology",
      },
    ],
  },
  {
    layer: "wire_media",
    number: "02",
    title: "新闻稿与行业媒体",
    subtitle: "竞品发布、融资、合作、会议传播和行业热点。优先找 RSS，注意重复转载和弱相关内容。",
    sources: [
      { name: "PR Newswire（via Google News site）", status: "enabled", trust: "B", method: "site 搜索 RSS", note: "定向补漏新闻稿，已在 ACRO 来源中配置" },
      { name: "Business Wire", status: "watchlist", trust: "B", method: "site 搜索 RSS", note: "后续为每家目标公司补充 site 查询" },
      { name: "GlobeNewswire", status: "watchlist", trust: "B", method: "site 搜索 RSS", note: "同上，后续批量配置" },
      { name: "BioSpace", status: "watchlist", trust: "B", method: "RSS", note: "生物医药行业动态，频率和噪音待评估" },
      { name: "Fierce Biotech / Fierce Pharma", status: "watchlist", trust: "B", method: "RSS", note: "行业热点覆盖面好，后期作为通用背景源" },
      { name: "GEN / Technology Networks / Labiotech", status: "watchlist", trust: "B", method: "RSS", note: "技术与行业内容，可作为主题增强模块" },
      { name: "日文 / 中文行业媒体", status: "watchlist", trust: "B", method: "待调研", note: "日本和中国市场信号，需先确认有哪些可用源" },
    ],
  },
  {
    layer: "aggregator",
    number: "03",
    title: "聚合搜索补漏",
    subtitle: "免费、覆盖广，快速发现散落在不同媒体里的公开新闻。MVP 可用，但必须配合去重、评分和归档控制噪音。",
    sources: [
      { name: "Google News RSS — ACRO 全球", status: "enabled", trust: "C", method: "RSS", note: "主要补漏源，噪音较高但配合评分后可用" },
      { name: "Google News RSS — ACRO 日本", status: "enabled", trust: "C", method: "RSS", note: "日文/日本区域动态，命中少但价值高" },
      { name: "Google News RSS — ACRO + PR Newswire", status: "enabled", trust: "B", method: "site 搜索 RSS", note: "定向新闻稿平台，比泛搜质量高" },
      { name: "Google News RSS — Thermo Fisher 全球", status: "enabled", trust: "C", method: "RSS", note: "量大（100条/次），噪音占比高，需强力过滤" },
      { name: "Google News RSS — Thermo Fisher 日本", status: "enabled", trust: "C", method: "RSS", note: "日本区域动态" },
      {
        name: "Bing News RSS — ACRO / Thermo",
        status: "backup",
        trust: "C",
        method: "RSS 备用源",
        note: "只补 Google News 未覆盖的标题，跨来源标题去重后再进入新闻流。",
        result: "ACRO 7 条、Thermo 10 条；重复转载较多，适合作为备用而非主源",
      },
    ],
  },
  {
    layer: "social_content",
    number: "04",
    title: "社交与内容平台",
    subtitle: "很有业务信号——活动传播、招聘、产品内容、区域市场声量。但自动化和合规限制多，MVP 先人工观察。",
    sources: [
      { name: "LinkedIn 公司主页", status: "manual", trust: "D", method: "人工查看", note: "产品/活动/招聘动态价值高，但不自动抓取" },
      { name: "LinkedIn 员工 / 管理层账号", status: "manual", trust: "D", method: "不抓取", note: "可能有早期信号，但隐私和合规风险高" },
      { name: "微信公众号", status: "manual", trust: "D", method: "人工查看", note: "中国市场重要来源，自动化门槛高" },
      { name: "X / Twitter", status: "watchlist", trust: "D", method: "人工查看", note: "海外会议和活动传播，后续可评估 API" },
      {
        name: "Thermo Fisher 官方 YouTube",
        status: "enabled",
        trust: "A",
        method: "Atom RSS",
        note: "免费订阅官方频道更新，作为独立视频信号，不混入默认新闻流。",
        result: "实测返回最新 15 条视频，无需 API Key",
        url: "youtube.com/@thermofisher",
      },
      { name: "ACRO YouTube / Bilibili", status: "watchlist", trust: "D", method: "待确认频道", note: "先确认官方频道 ID，再按同一方式接入" },
    ],
  },
  {
    layer: "market_channel",
    number: "05",
    title: "市场活动与渠道",
    subtitle: "观察展会、Webinar、经销商和合作伙伴动作，捕捉市场推广节奏和销售线索。先记录重点来源，重要事件人工录入。",
    sources: [
      { name: "展会官网参展商页面", status: "watchlist", trust: "B", method: "人工查看", note: "判断参展、赞助、主题方向；可建展会日历" },
      { name: "Webinar 报名平台", status: "watchlist", trust: "B", method: "人工查看", note: "主题方向和客户教育内容" },
      { name: "经销商 / 代理商新闻页", status: "watchlist", trust: "D", method: "人工查看", note: "区域市场动作和转载信号" },
      { name: "合作伙伴新闻页", status: "watchlist", trust: "C", method: "人工查看", note: "合作和联合推广信号" },
      { name: "客户案例 / 应用笔记", status: "watchlist", trust: "B", method: "人工查看", note: "商业落地证据，但通常不频繁更新" },
    ],
  },
  {
    layer: "research_regulatory",
    number: "06",
    title: "研发监管与组织信号",
    subtitle: "技术方向、监管风险和公司公告已经按独立类型接入；默认新闻流不展示这些专题信号。",
    sources: [
      {
        name: "PubMed — ACRO",
        status: "trial",
        trust: "B",
        method: "E-utilities API",
        note: "单独进入论文信号；只保留一年内与 ACROBiosystems 查询关联的记录。",
        result: "当前总命中 19 条，试运行抓取最近 10 条",
      },
      { name: "ClinicalTrials.gov", status: "watchlist", trust: "A", method: "公开 API", note: "ACRO 命中 0；Thermo 多为试验中使用其设备，相关性不足，暂不接入", result: "接口可用，但公司情报价值低" },
      { name: "专利数据库", status: "watchlist", trust: "B", method: "API / 搜索", note: "技术布局和产品方向" },
      {
        name: "openFDA — Thermo 召回监控",
        status: "trial",
        trust: "A",
        method: "公开 API",
        note: "只显示两年内新增记录；历史命中不灌入页面，未来有新召回时自动出现。",
        result: "接口命中 15 条 enforcement 记录，但最新为 2021 年，当前展示 0 条",
      },
      { name: "招聘网站", status: "watchlist", trust: "D", method: "人工查看", note: "组织扩张、区域布局、技术方向信号" },
      {
        name: "SEC EDGAR — Thermo",
        status: "trial",
        trust: "A",
        method: "官方 JSON API（待配置）",
        note: "解析规则已完成，将只保留 8-K、10-Q、10-K；当前不发请求。",
        result: "SEC 要求 User-Agent 包含真实联系邮箱，待配置后再启用",
        url: "data.sec.gov/submissions",
      },
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
      { name: "新闻 API（NewsAPI / GNews / Mediastack）", status: "paid_later", trust: "A", method: "API", note: "稳定性和覆盖率比 RSS 好，月费可控" },
      { name: "商业情报数据库", status: "paid_later", trust: "A", method: "API / 导出", note: "企业、产品、管线数据，适合竞品深度分析" },
      { name: "LinkedIn 官方 API", status: "paid_later", trust: "B", method: "API", note: "合规获取公司动态和招聘信号" },
      { name: "微信生态监控服务", status: "paid_later", trust: "B", method: "第三方服务", note: "合规监测公众号和视频号内容" },
      { name: "专利 / 临床数据库订阅", status: "paid_later", trust: "A", method: "API / 批量导出", note: "研发和监管信号的结构化数据" },
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
  trendList: document.querySelector("#trendList"),
  trendDays: document.querySelector("#trendDays"),
  pageEyebrow: document.querySelector("#pageEyebrow"),
  pageTitle: document.querySelector("#pageTitle"),
  toolbar: document.querySelector(".toolbar"),
  ruleGrid: document.querySelector("#ruleGrid"),
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
  els.ruleGrid.innerHTML = sourceInventory
    .map(
      (cat) => `
        <section class="rule-lane ${cat.layer}">
          <div class="rule-lane-head">
            <div class="rule-lane-title">
              <span class="lane-number">${cat.number}</span>
              <h3>${escapeHtml(cat.title)}</h3>
              <span class="lane-summary">${summaryForCategory(cat)}</span>
            </div>
            <p>${escapeHtml(cat.subtitle)}</p>
          </div>
          <div class="source-grid">
            ${cat.sources
              .map(
                (src) => `
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
                    ${src.result ? `<div class="source-card-result"><span>实测</span>${escapeHtml(src.result)}</div>` : ""}
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function summaryForCategory(cat) {
  const counts = {};
  for (const src of cat.sources) {
    counts[src.status] = (counts[src.status] || 0) + 1;
  }
  const parts = [];
  if (counts.enabled) parts.push(`${counts.enabled} 已启用`);
  if (counts.backup) parts.push(`${counts.backup} 备用`);
  if (counts.covered) parts.push(`${counts.covered} 已覆盖`);
  if (counts.trial) parts.push(`${counts.trial} 试运行`);
  if (counts.watchlist) parts.push(`${counts.watchlist} 观察中`);
  if (counts.manual) parts.push(`${counts.manual} 人工`);
  if (counts.blocked) parts.push(`${counts.blocked} 受限`);
  if (counts.paid_later) parts.push(`${counts.paid_later} 后期付费`);
  return parts.join(" · ");
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
    enabled: "已启用",
    backup: "备用",
    covered: "已覆盖",
    trial: "试运行",
    watchlist: "观察中",
    manual: "人工",
    blocked: "受限",
    paid_later: "后期付费",
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

els.pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.page = button.dataset.pageTarget;
    renderPage();
  });
});

loadData();
