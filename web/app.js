const FEEDBACK_STORE_KEY = "aihot_feedback";
const TRANSLATION_LANGUAGE_KEY = "aihot_translation_language";
const SIGNAL_WORKFLOW_STORE_KEY = "aihot_signal_workflow_v1";

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

function loadTranslationLanguage() {
  try {
    const value = localStorage.getItem(TRANSLATION_LANGUAGE_KEY);
    return value === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function saveTranslationLanguage(value) {
  try {
    localStorage.setItem(TRANSLATION_LANGUAGE_KEY, value);
  } catch {
    // Ignore storage failures; the toggle still works for the current session.
  }
}

function loadSignalWorkflow() {
  try {
    return JSON.parse(localStorage.getItem(SIGNAL_WORKFLOW_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSignalWorkflow(id, status) {
  const workflow = loadSignalWorkflow();
  workflow[id] = { status, updated_at: new Date().toISOString() };
  try {
    localStorage.setItem(SIGNAL_WORKFLOW_STORE_KEY, JSON.stringify(workflow));
  } catch {
    // The static dashboard remains readable when browser storage is unavailable.
  }
  return workflow;
}

const state = {
  payload: null,
  tier: "daily",
  relevance: "all",
  signalType: "all",
  company: "all",
  category: "all",
  timeRange: 30,
  role: "all",
  region: "all",
  searchQuery: "",
  page: "overview",
  overviewMetric: "critical",
  methodologyDetail: "",
  sourceView: "effective",
  sourceStage: "all",
  sourceFocusId: "",
  sourceFocusLayer: "",
  sourceOutputId: "all",
  sourceOutputLabel: "",
  healthCompany: "all",
  healthStatus: "all",
  coverageCompany: "acro",
  timelineCompany: "acro",
  timelineScope: "selected",
  relationshipType: "all",
  relationshipEvidence: "all",
  relationshipGraphLayer: "all",
  relationshipGraphFocus: "acro",
  accountQuery: "",
  accountStage: "all",
  accountOrganizationType: "all",
  accountSignalStatus: "all",
  selectedAccountId: null,
  accountLimit: 40,
  dockOpenRoles: new Set(["self"]),
  assistantView: "action",
  translationLanguage: loadTranslationLanguage(),
  feedback: loadFeedback(),
  signalWorkflow: loadSignalWorkflow(),
  history: null,
};

const methodologyDetailMeta = {
  "deduplication": { family: "数据准备与识别", title: "去重与来源合并" },
  "entity-matching": { family: "数据准备与识别", title: "公司实体识别" },
  "structured-extraction": { family: "数据准备与识别", title: "六组结构化提取" },
  "news-score": { family: "单篇信息判断", title: "信息筛选分" },
  "acro-relevance": { family: "单篇信息判断", title: "ACRO 相关性分" },
  "daily-admission": { family: "单篇信息判断", title: "日报准入与分层" },
  "event-classification": { family: "分类与业务输出", title: "商业事件分类" },
  "action-routing": { family: "分类与业务输出", title: "建议动作与负责人" },
  "summary-provenance": { family: "分类与业务输出", title: "摘要与证据溯源" },
  "priority-index": { family: "公司与账户排序", title: "优先指数" },
  "relevance-density": { family: "公司与账户排序", title: "ACRO 相关密度" },
  "competitor-matrix": { family: "公司与账户排序", title: "竞品动作矩阵" },
  "trend-counts": { family: "统计与运行口径", title: "信号走势图例数字" },
  "dashboard-counts": { family: "统计与运行口径", title: "总览四项统计口径" },
  "source-health": { family: "统计与运行口径", title: "数据源健康状态" },
  "source-coverage": { family: "存储与规则治理", title: "来源覆盖与产出质量" },
  "data-storage": { family: "存储与规则治理", title: "数据存储与共享边界" },
  "rule-governance": { family: "存储与规则治理", title: "规则契约与版本校验" },
};

const officialContentGroups = [
  {
    id: "company_news",
    number: "A",
    title: "公司新闻与公告",
    description: "合作、融资、收购、管理层、公司战略和正式新闻稿。",
  },
  {
    id: "product_updates",
    number: "B",
    title: "产品与解决方案更新",
    description: "新品、新靶点、新试剂盒、新服务和解决方案页面。",
  },
  {
    id: "events",
    number: "C",
    title: "活动与 Webinar",
    description: "展会、会议、Workshop、Webinar、报名和回放状态。",
  },
  {
    id: "technical_content",
    number: "D",
    title: "技术内容",
    description: "Insights、Blog、Application Note、白皮书和 Protocol。",
  },
  {
    id: "regional_coverage",
    number: "＋",
    title: "跨类别地区覆盖",
    description: "这不是内容分类；地区站抓到内容后，仍要归入上面四类。",
    secondary: true,
  },
];

const wireMediaGroups = [
  {
    id: "press_release_distribution",
    number: "A",
    title: "新闻稿分发平台",
    description: "公司自行发布并通过平台分发的正式新闻稿。适合补漏和核对原始表述，但不等于独立媒体报道。",
  },
  {
    id: "biopharma_editorial",
    number: "B",
    title: "生物医药行业新闻",
    description: "由行业编辑部筛选和撰写的公司、交易、研发、监管和市场新闻。",
  },
  {
    id: "science_technology_media",
    number: "C",
    title: "生命科学技术媒体",
    description: "偏技术趋势、实验工具、应用案例和科研产业内容，适合做主题背景和产品方向观察。",
  },
  {
    id: "regional_media",
    number: "＋",
    title: "地区媒体补充",
    description: "地区是辅助标签，不是媒体类型；进入系统后仍按新闻稿、行业新闻或技术内容重新归类。",
    secondary: true,
  },
];

const marketChannelGroups = [
  {
    id: "ecosystem_platform",
    number: "A",
    title: "行业生态与活动平台",
    description: "平台自身聚合生命科学企业、技术主题、会员活动、Webinar 和开放创新项目，是发现信息的入口。",
  },
  {
    id: "conference_exhibition",
    number: "B",
    title: "展会与专业会议",
    description: "围绕重点展会、学术会议和主办方建立白名单，观察参展、演讲、赞助和议题变化。",
  },
  {
    id: "partner_network",
    number: "C",
    title: "合作与商业网络",
    description: "经销商、代理商、合作伙伴和客户案例用于补齐区域动作、合作另一方表述与商业落地信号。",
  },
  {
    id: "registration_infrastructure",
    number: "＋",
    title: "报名承载工具",
    description: "Zoom 等工具承载报名和会议，不是主要发现源；仅用于确认活动详情、追踪渠道和去重。",
    secondary: true,
  },
];

const socialContentGroups = [
  {
    id: "official_video",
    number: "A",
    title: "官方视频与 Webinar 回放",
    description: "监测公司官方频道的新视频、技术演示和会议回放；视频单独归档，避免与官网活动和新闻重复推送。",
  },
  {
    id: "professional_social",
    number: "B",
    title: "专业社交与公司动态",
    description: "观察合作、活动传播、招聘和管理层动态。公开可看不等于可以稳定自动抓取，因此目前保留人工核对。",
  },
  {
    id: "china_content",
    number: "C",
    title: "中国内容生态",
    description: "覆盖公众号、视频号和 Bilibili 等中国市场渠道；先登记官方账号与人工线索，后续再评估合规连接方式。",
  },
  {
    id: "subscription_content",
    number: "+",
    title: "订阅与长内容补充",
    description: "Newsletter 和 Podcast 适合低频深度内容；有公开 RSS 时再自动接入，没有则只作为人工订阅和核对入口。",
    secondary: true,
  },
];

const researchSignalGroups = [
  {
    id: "research_outputs",
    number: "A",
    title: "论文、会议摘要与科研产出",
    description: "用作者机构而不是只用标题匹配公司，观察技术方向、团队产出和产品应用；全部作为研究信号归档。",
  },
  {
    id: "trials_regulatory",
    number: "B",
    title: "临床试验、审批与安全",
    description: "读取官方试验注册、审批、指南和召回数据，区分公司作为赞助方、合作方、申报方或仅被正文提及。",
  },
  {
    id: "filings_patents",
    number: "C",
    title: "公司申报、专利与知识产权",
    description: "覆盖上市公司申报、专利族和日本企业披露；需要身份信息或免费密钥的接口先保持待配置。",
  },
  {
    id: "organization_workforce",
    number: "+",
    title: "组织身份、招聘与团队变化",
    description: "组织标识用于名称归一，招聘用于判断地区和能力扩张；个人资料和登录后数据不进入自动任务。",
    secondary: true,
  },
];

const restrictedSourceGroups = [
  {
    id: "account_gate",
    number: "A",
    title: "账号、登录与授权边界",
    description: "需要个人或企业账号才能访问的内容，不复用私人会话，也不把登录权限视为自动抓取许可。",
  },
  {
    id: "anti_bot",
    number: "B",
    title: "反爬、验证码与动态页面",
    description: "页面公开不代表存在稳定数据接口；遇到验证码、滑块、设备校验或纯前端数据时停止自动化。",
  },
  {
    id: "paywall_copyright",
    number: "C",
    title: "付费墙、会员库与版权内容",
    description: "可以记录标题、日期和合法公开摘要，但不复制订阅正文、报告、图表或批量下载内容。",
  },
  {
    id: "private_personal",
    number: "D",
    title: "私域、个人账号与个人数据",
    description: "群聊、邮件、联系人和员工个人动态不属于公开公司情报，除非有明确授权和业务流程。",
  },
  {
    id: "policy_robots",
    number: "E",
    title: "网站规则与技术许可",
    description: "遵守 robots、服务条款、API 配额和删除要求；技术上能访问不等于合规上可以采集。",
  },
  {
    id: "prohibited_methods",
    number: "F",
    title: "明确不采用的高风险手段",
    description: "不使用验证码绕过、共享 Cookie、代理轮换或浏览器指纹伪装来维持来源。",
  },
];

const commercialServiceGroups = [
  {
    id: "open_foundation",
    number: "A",
    title: "先用开放数据替代",
    description: "免费官方 API 和开放元数据已经能覆盖论文、临床、监管和部分公司身份，优先把这些能力跑稳。",
  },
  {
    id: "company_freemium",
    number: "B",
    title: "公司、融资与交易数据库",
    description: "免费网页适合人工验证公司基本信息，API、批量导出、融资轮次和关系图通常需要付费授权。",
  },
  {
    id: "news_api",
    number: "C",
    title: "新闻 API 与媒体监测",
    description: "预算购买的是稳定覆盖、授权和统一接口，不是为了替代已经可用的官方 RSS。",
  },
  {
    id: "life_science_intelligence",
    number: "D",
    title: "生命科学管线与商业情报",
    description: "用于药物管线、交易、临床里程碑、市场预测和竞争格局，适合第二阶段深度研究。",
  },
  {
    id: "social_monitoring",
    number: "E",
    title: "社交与中国内容监测",
    description: "只有在社交传播和中国内容成为明确 KPI 后，才购买官方 API 或合规第三方监测服务。",
  },
  {
    id: "patent_trial_paid",
    number: "F",
    title: "专利、临床与法规专业库",
    description: "开放接口无法满足专利族清洗、法律状态、试验预测和跨库关联时，再评估专业数据库。",
  },
];

const sourceInventory = [
  {
    layer: "official",
    number: "01",
    title: "官方网站与自有内容",
    subtitle: "这里负责官网新闻、产品、活动和技术页面；官方社交频道统一放到第 04 层，避免同一入口重复出现。官网直抓受限时，只使用公开索引结果。",
    sources: [
      {
        name: "ACRO 官网 News",
        contentGroup: "company_news",
        companyTag: "ACRO",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网索引 RSS",
        note: "官网直抓会进入滑块验证；当前监控公开搜索已收录的官方 News 页。",
        sourceIds: ["acro_official_news_index"],
        url: "acrobiosystems.com/news",
      },
      {
        name: "Thermo Fisher IR / Press Release",
        contentGroup: "company_news",
        companyTag: "Thermo Fisher",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方直接 RSS",
        note: "直接读取官方结构化新闻稿，日期、标题和链接完整，是当前最稳定的官方来源。",
        sourceIds: ["thermo_official_rss"],
        url: "ir.thermofisher.com/rss/pressrelease.aspx",
      },
      {
        name: "Thermo Fisher Newsroom",
        contentGroup: "company_news",
        companyTag: "Thermo Fisher",
        regionTag: "全球站",
        status: "covered",
        trust: "A",
        method: "由 IR RSS 覆盖",
        note: "Newsroom HTML 直抓返回 403；主要新闻稿已由官方 IR RSS 覆盖，不重复接入。",
        url: "newsroom.thermofisher.com",
      },
      {
        name: "Merck KGaA Life Science News",
        contentGroup: "company_news",
        companyTag: "Merck Life Science",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网定向索引 RSS",
        note: "默克集团新闻涵盖多个业务板块；当前仅保留 Life Science、MilliporeSigma、BioReliance 和 bioprocessing 内容。",
        sourceIds: ["merck_life_science_official_index"],
        url: "emdgroup.com/en/news-stories",
      },
      {
        name: "Sartorius Newsroom",
        contentGroup: "company_news",
        companyTag: "Sartorius",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网定向索引 RSS",
        note: "监测产品、合作、扩产、biopharma 与细胞治疗内容，排除纯财务公告。",
        sourceIds: ["sartorius_official_news_index"],
        url: "sartorius.com/en/company/newsroom",
      },
      {
        name: "Miltenyi Group News",
        contentGroup: "company_news",
        companyTag: "Miltenyi Biotec",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方子站联合索引 RSS",
        note: "主站新闻索引较弱，当前联合监测 Miltenyi Bioindustry 与 Miltenyi Biomedicine 的公开新闻。",
        sourceIds: ["miltenyi_official_news_index"],
        url: "miltenyibioindustry.com",
      },
      {
        name: "Abcam Press Releases",
        contentGroup: "company_news",
        companyTag: "Abcam",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网定向索引 RSS",
        note: "直接监测 Abcam 官方 Press Releases 路径，用于合作、收购、产品平台与组织变化。",
        sourceIds: ["abcam_official_press_index"],
        url: "abcam.com/en-us/press-releases",
      },
      {
        name: "Promega Press Releases",
        contentGroup: "company_news",
        companyTag: "Promega",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网定向索引 RSS",
        note: "官方新闻是 Promega 当前产出最稳定的专属入口，已排除社区活动和雇主奖项类内容。",
        sourceIds: ["promega_official_press_index"],
        url: "promega.com/aboutus/press-releases",
      },
      {
        name: "Bio-Techne Press Releases",
        contentGroup: "company_news",
        companyTag: "Bio-Techne（R&D Systems 母公司）",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方 IR 定向索引 RSS",
        note: "集团新闻归入 Bio-Techne；明确提到 R&D Systems 的内容再同步命中品牌档案。",
        sourceIds: ["biotechne_official_press_index"],
        url: "investors.bio-techne.com/press-releases",
      },
      {
        name: "BD Biosciences News / Product Updates",
        contentGroup: "product_updates",
        companyTag: "BD Biosciences",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "Newsroom + 产品支持索引 RSS",
        note: "只保留明确属于 BD Biosciences、Rhapsody 或 FACS 的新闻和产品更新，不扫描 BD 全集团医疗器械新闻。",
        sourceIds: ["bd_biosciences_official_news_index", "bd_biosciences_official_product_updates_index"],
        url: "news.bd.com",
      },
      {
        name: "MCE Scientific Insights",
        contentGroup: "technical_content",
        companyTag: "MedChemExpress / MCE",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网定向索引 RSS",
        note: "MCE 没有稳定 Newsroom，以 Reviews、Topics 和 Blogs 观察技术方向；标题级过滤阻止普通化合物 SKU 页混入。",
        sourceIds: ["mce_official_insights_index"],
        url: "medchemexpress.com/resources.html",
      },
      {
        name: "STEMCELL Technologies News",
        contentGroup: "company_news",
        companyTag: "STEMCELL Technologies",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官网定向索引 RSS",
        note: "官方 Newsroom 负责企业、合作和新产品信号；有效但更新频率低，需与 Business Wire 互补。",
        sourceIds: ["stemcell_official_news_index"],
        url: "stemcell.com/about-us/news.html",
      },
      {
        name: "Sino Biological Official Updates",
        contentGroup: "company_news",
        companyTag: "Sino Biological / 义翘神州",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方域名定向索引 RSS",
        note: "监测合作、CRO、GMP、产能和发布动作；已排除单个重组蛋白和抗体 SKU 页。",
        sourceIds: ["sino_biological_official_updates_index"],
        url: "sinobiological.com",
      },
      {
        name: "Takara Bio News Releases",
        contentGroup: "company_news",
        companyTag: "Takara Bio / 宝生物",
        regionTag: "全球 + 日本",
        status: "active",
        trust: "A",
        method: "英文官网定向索引 RSS",
        note: "官方新闻稳定产出 CDMO、基因与细胞治疗、技术授权和业务重组信号，日文媒体再补区域视角。",
        sourceIds: ["takara_bio_official_news_index"],
        url: "takara-bio.com/en/news.html",
      },
      {
        name: "Cytiva News / Insights / Webinar Hub",
        contentGroup: "company_news",
        companyTag: "Cytiva / 思拓凡",
        regionTag: "全球 + 日本",
        status: "active",
        trust: "A",
        method: "官网公开索引 + Webinar 页面直连",
        note: "主站自动请求返回 403，因此新闻和 Insights 使用官方域名公开索引；Webinar Hub 可直接读取，缺少发布日期的视频只归档。",
        sourceIds: ["cytiva_official_news_index", "cytiva_official_insights_index", "cytiva_japan_official_index", "cytiva_official_webinars_links"],
        url: "cytivalifesciences.com",
      },
      {
        name: "FUJIFILM Wako News / Products / Events",
        contentGroup: "product_updates",
        companyTag: "FUJIFILM Wako",
        regionTag: "全球 + 日本",
        status: "active",
        trust: "A",
        method: "官网列表 HTML 直连",
        note: "英文新闻、日本新品和 Seminar 列表均可直接读取；过滤网站维护、SDS 和促销信息，产品与活动保持独立信号。",
        sourceIds: ["fujifilm_wako_official_news_links", "fujifilm_wako_japan_product_links", "fujifilm_wako_japan_event_links"],
        url: "labchem-wako.fujifilm.com",
      },
      {
        name: "Nacalai Tesque News / Products / Events",
        contentGroup: "company_news",
        companyTag: "Nacalai Tesque",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "官网列表 HTML 直连",
        note: "独立读取官方公告、新品与学会活动；同一条活动通过 URL 去重合并，保留 Nacalai 作为日本研究试剂和渠道对标对象。",
        sourceIds: ["nacalai_official_news_links", "nacalai_official_product_links", "nacalai_official_events_links"],
        url: "nacalai.co.jp/news",
      },
      {
        name: "日本重点账户官方动态",
        contentGroup: "company_news",
        companyTag: "公开关系账户 + 重点市场账户",
        regionTag: "全球 + 日本",
        status: "active",
        trust: "A",
        method: "官方 RSS / 公告 JSON / 官网定向索引",
        note: "重点账户从统一配置自动进入公司池、来源健康、覆盖档案与日报。优先使用官方 RSS、公告 JSON 或官方公开页；Google News 只作补漏。",
        sourceIds: [
          "takeda_official_news_index",
          "takeda_japan_official_index",
          "astellas_official_rss",
          "astellas_japan_official_rss",
          "daiichi_official_press_json",
          "daiichi_japan_press_json",
          "eisai_official_news_index",
          "eisai_japan_official_index",
          "chugai_official_news_rss",
          "ono_official_news_page",
          "shionogi_official_news_page",
          "tanabe_official_news_page",
          "jcr_official_press_page",
          "peptidream_official_ir_blog",
          "peptidream_official_news_index",
          "kaken_official_news_index",
          "kissei_official_news_page",
        ],
      },
      {
        name: "新增公司官方 Events / Webinar",
        contentGroup: "events",
        companyTag: "8 家新增公司",
        regionTag: "全球 + 地区站",
        status: "active",
        trust: "A",
        method: "活动页定向索引 RSS",
        note: "统一监测 Webinar、Course、Conference 和报名页；标题必须显式呈现活动属性，不再把产品页当作活动。",
        sourceIds: [
          "abcam_official_events_index",
          "promega_official_events_index",
          "biotechne_official_events_index",
          "mce_official_webinars_index",
          "stemcell_official_webinars_index",
          "sino_biological_official_webinars_index",
          "takara_bio_official_technical_events_index",
        ],
      },
      {
        name: "ACRO 产品 / Resources 新页面",
        contentGroup: "product_updates",
        companyTag: "ACRO",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方 Sitemap 新 URL 差分",
        note: "读取 robots.txt 指定的官方 Sitemap；首次建立 6300+ 产品与解决方案 URL 基线，之后只报告新增页面。",
        sourceIds: ["acro_product_sitemap"],
        url: "acrobiosystems.com/products",
      },
      {
        name: "Thermo Fisher 产品更新",
        contentGroup: "product_updates",
        companyTag: "Thermo Fisher",
        regionTag: "全球站",
        status: "covered",
        trust: "A",
        method: "由官方新闻稿 RSS 覆盖",
        note: "产品目录过大且页面直抓为 403；实测官方新闻稿 RSS 已包含新品发布，单独建产品页源会重复并放大噪音。",
        sourceIds: ["thermo_official_rss"],
      },
      {
        name: "ACRO Events / Webinar",
        contentGroup: "events",
        companyTag: "ACRO",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "Activities 索引 RSS",
        note: "监控 activities 栏目，并排除礼品、问卷、优惠和免费样品等促销噪音。",
        sourceIds: ["acro_official_activities_index"],
        url: "acrobiosystems.com/activities",
      },
      {
        name: "Thermo Fisher Events / Webinar",
        contentGroup: "events",
        companyTag: "Thermo Fisher",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "活动栏目索引 RSS",
        note: "活动页直抓仍返回 403；当前通过公开索引监控 Webinar、Conference 和 Summit，并过滤投资者活动。",
        sourceIds: ["thermo_events_index"],
        url: "thermofisher.com/us/en/home/events.html",
      },
      {
        name: "ACRO Insights",
        contentGroup: "technical_content",
        companyTag: "ACRO",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "Insights 索引 RSS",
        note: "监控官方技术解读、应用文章和产品主题，属于内容与产品信号。",
        sourceIds: ["acro_official_insights_index"],
        url: "acrobiosystems.com/insights",
      },
      {
        name: "Thermo Fisher Biotech at Scale Blog",
        contentGroup: "technical_content",
        companyTag: "Thermo Fisher",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方直接 Blog RSS",
        note: "技术、CDMO、制造和行业活动内容，作为技术内容信号处理。",
        sourceIds: ["thermo_biotech_blog_rss"],
        url: "thermofisher.com/blog/biotechnology",
      },
      {
        name: "ACRO 日本官网补充入口",
        contentGroup: "regional_coverage",
        companyTag: "ACRO",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "日文站定向 RSS",
        note: "先发现日本站的新页面；抓到后再判断属于新闻、活动、产品还是技术内容。",
        sourceIds: ["acro_japan_official_index"],
        url: "jp.acrobiosystems.com",
      },
      {
        name: "Thermo Fisher 日本官网补充入口",
        contentGroup: "regional_coverage",
        companyTag: "Thermo Fisher",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "日本站定向索引 RSS",
        note: "只查询日本官网的新闻、活动和 Seminar 页面；抓取后继续按内容类型归类，并与泛新闻源去重。",
        sourceIds: ["thermo_japan_official_index"],
        url: "thermofisher.com/jp/ja/home",
      },
    ],
  },
  {
    layer: "wire_media",
    number: "02",
    title: "新闻稿与行业媒体",
    subtitle: "先区分新闻稿分发平台、行业编辑媒体和技术媒体，再用公司、地区与获取方式作标签。新闻稿是公司表述，行业报道是外部观察，两者不能混为同一种证据。",
    sources: [
      {
        name: "PR Newswire",
        mediaGroup: "press_release_distribution",
        companyTag: "ACRO + 新增公司池",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "公司名 + site 索引 RSS",
        note: "已覆盖 ACRO 与 8 家新增公司，标题必须明确出现公司全称；“公司定向”是查询规则，不是来源分类。",
        sourceIds: ["google_news_acro_prnewswire", "prnewswire_expanded_company_pool_index"],
        url: "prnewswire.com",
      },
      {
        name: "PR Times",
        mediaGroup: "press_release_distribution",
        companyTag: "公司池 / 日本生命科学",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "公司池索引 / 主题页 HTML",
        note: "已接入生命科学宽主题、原公司池和 8 家新增公司定向入口；默认低权重归档，只在标题明确命中公司时保留。",
        sourceIds: ["prtimes_japan_biotech_index", "prtimes_company_pool_index", "prtimes_expanded_company_pool_index"],
        url: "prtimes.jp",
      },
      {
        name: "Business Wire",
        mediaGroup: "press_release_distribution",
        companyTag: "公司池",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "公司池 + site 索引 RSS",
        note: "官网拒绝当前自动请求，因此免费 MVP 使用 Google News 定向索引。能监测公司池在 Business Wire 的新闻稿，但不能写成官网 RSS 直连。",
        sourceIds: ["businesswire_company_pool_index", "businesswire_expanded_company_pool_index"],
        url: "businesswire.com",
      },
      {
        name: "GlobeNewswire",
        mediaGroup: "press_release_distribution",
        companyTag: "公司池",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "Biotechnology 官方 RSS",
        note: "已接入官方 Biotechnology RSS。它是行业发现源，不只盯公司名；财报、回购和市场报告类内容会在入口处过滤。",
        sourceIds: ["globenewswire_biotechnology_rss"],
        url: "globenewswire.com",
      },
      {
        name: "BioSpace",
        mediaGroup: "biopharma_editorial",
        companyTag: "公司池 / 竞品",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "官方栏目 RSS",
        note: "已接入 All News 官方 RSS，统一发现交易、研发、FDA、制造和公司动态；后续再根据产出决定是否拆成 Deals、Drug Development 等专门频道。",
        sourceIds: ["biospace_all_news_rss"],
        url: "biospace.com",
      },
      {
        name: "Fierce Biotech",
        mediaGroup: "biopharma_editorial",
        companyTag: "公司池 / 竞品",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "官方 RSS",
        note: "官方 RSS 已进入跑批，主要补充研发、融资、合作、CRO 和临床进展。即使未命中公司池，也可作为行业观察信号。",
        sourceIds: ["fierce_biotech_rss"],
        url: "fiercebiotech.com",
      },
      {
        name: "Fierce Pharma",
        mediaGroup: "biopharma_editorial",
        companyTag: "公司池 / 竞品",
        regionTag: "全球 / 亚洲",
        status: "active",
        trust: "B",
        method: "官方主 RSS",
        note: "官方 RSS 已进入跑批，主要补充制药合作、制造、监管和商业化信号；财务与股价类标题先行过滤。",
        sourceIds: ["fierce_pharma_rss"],
        url: "fiercepharma.com",
      },
      {
        name: "GEN",
        mediaGroup: "science_technology_media",
        companyTag: "技术主题 / 竞品",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "官方 RSS",
        note: "官方 RSS 已验证并进入跑批；覆盖 Drug Discovery、Bioprocessing、OMICS、Gene Editing、Cell Therapy 和 Translational Medicine。",
        sourceIds: ["gen_official_rss"],
        url: "genengnews.com",
      },
      {
        name: "Technology Networks",
        mediaGroup: "science_technology_media",
        companyTag: "技术主题",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "技术主题 + site 索引 RSS",
        note: "官网自动请求返回 403，当前通过抗体、ADC、细胞治疗、Bioprocessing 和 Organoid 主题定向索引，并过滤栏目分页和产品广告。",
        sourceIds: ["technology_networks_topic_index"],
        url: "technologynetworks.com",
      },
      {
        name: "Labiotech",
        mediaGroup: "science_technology_media",
        companyTag: "欧洲竞品 / 交易",
        regionTag: "欧洲",
        status: "active",
        trust: "B",
        method: "官方 RSS",
        note: "官方 RSS 已验证并进入跑批；补充欧洲 Biotech 公司、融资、合作、临床和区域产业动态。",
        sourceIds: ["labiotech_official_rss"],
        url: "labiotech.eu",
      },
      {
        name: "Pharmaceutical Technology",
        mediaGroup: "science_technology_media",
        companyTag: "制造 / CDMO / 竞品",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "技术主题 + site 索引 RSS",
        note: "本轮表现最好：9 条结果中 6 条达到日报门槛，主要补充制造扩建、CDMO、细胞治疗与 ADC 信号。",
        sourceIds: ["pharmaceutical_technology_index"],
        url: "pharmaceutical-technology.com",
      },
      {
        name: "BioProcess Online",
        mediaGroup: "science_technology_media",
        companyTag: "生物工艺 / 平台",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "技术主题 + site 索引 RSS",
        note: "补充生物工艺、单次性系统、GMP 和细胞治疗制造；技术软文仍需通过 40 分日报门槛。",
        sourceIds: ["bioprocess_online_index"],
        url: "bioprocessonline.com",
      },
      {
        name: "SelectScience",
        mediaGroup: "science_technology_media",
        companyTag: "试剂 / 仪器 / 竞品",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "产品主题 + site 索引 RSS",
        note: "12 条结果中 3 条达到日报门槛，可补充试剂、生物反应器、流式和细胞治疗平台发布。",
        sourceIds: ["selectscience_life_science_index"],
        url: "selectscience.net",
      },
      {
        name: "BioSpectrum Asia",
        mediaGroup: "regional_media",
        companyTag: "生物制药 / CDMO",
        regionTag: "亚太",
        status: "active",
        trust: "B",
        method: "亚太主题 + site 索引 RSS",
        note: "补充新加坡及亚太地区生物制药、智能制造、CDMO 和细胞治疗信号。",
        sourceIds: ["biospectrum_asia_index"],
        url: "biospectrumasia.com",
      },
      {
        name: "Korea Biomedical Review",
        mediaGroup: "regional_media",
        companyTag: "细胞治疗 / CDMO",
        regionTag: "韩国",
        status: "active",
        trust: "B",
        method: "韩国主题 + site 索引 RSS",
        note: "补充韩国细胞治疗、生物类似药、CDMO 和临床制造信号；本轮已命中 NK 细胞治疗制造合同。",
        sourceIds: ["koreabiomed_apac_index"],
        url: "koreabiomed.com",
      },
      {
        name: "BioSpectrum India",
        mediaGroup: "regional_media",
        companyTag: "制造 / 区域投资",
        regionTag: "印度",
        status: "active",
        trust: "B",
        method: "印度主题 + site 索引 RSS",
        note: "补充印度生物制药、制造与细胞治疗信号；测试中已命中 Thermo Fisher 可规模化细胞治疗平台。",
        sourceIds: ["biospectrum_india_index"],
        url: "biospectrumindia.com",
      },
      {
        name: "AnswersNews",
        mediaGroup: "regional_media",
        companyTag: "公司池 / 竞品",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "官方 RSS",
        note: "免费正文与日更汇总质量较高，适合跟踪日本制药公司的申报、获批、交易、生产和市场动作。",
        sourceIds: ["answersnews_official_rss"],
        url: "answers.and-pro.jp/pharmanews",
      },
      {
        name: "ミクスOnline",
        mediaGroup: "regional_media",
        companyTag: "公司池 / 竞品",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "官方 RSS",
        note: "官方 RSS 可读取标题与摘要；部分完整正文需要会员登录，系统不绕过权限。",
        sourceIds: ["mixonline_official_rss"],
        url: "mixonline.jp",
      },
      {
        name: "日経バイオテクONLINE",
        mediaGroup: "regional_media",
        companyTag: "公司池定向",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "公司池 + site 索引 RSS",
        note: "没有公开 RSS 且正文需要订阅；原公司池与 8 家新增公司都已纳入公开标题监测，不抓付费正文。",
        sourceIds: ["nikkei_biotech_company_pool_index", "nikkei_biotech_expanded_company_pool_index"],
        url: "bio.nikkeibp.co.jp",
      },
      {
        name: "日刊薬業",
        mediaGroup: "regional_media",
        companyTag: "制药公司 / 政策",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "生命科学主题 + site 索引 RSS",
        note: "已接入公开标题索引，30 条结果中 6 条达到日报门槛。仅记录标题、日期与链接，不绕过会员正文。",
        sourceIds: ["nikkanyaku_life_science_index"],
        url: "nk.jiho.jp",
      },
      {
        name: "薬事日報",
        mediaGroup: "regional_media",
        companyTag: "制药 / 新产品 / 政策",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "官方 RSS",
        note: "官方 RSS 已接入，本轮 24 条全部为近期内容。处方药、OTC、美容与新产品汇总混合，因此先作日本医药低权重观察源。",
        sourceIds: ["yakuji_nippo_official_rss"],
        url: "yakuji.co.jp/feed",
      },
      {
        name: "Science Portal",
        mediaGroup: "regional_media",
        companyTag: "科研趋势",
        regionTag: "日本",
        status: "active",
        trust: "B",
        method: "JST 官方 RSS",
        note: "已接入 JST 生命科学定向索引；本轮 8 条，其中 5 条在观察窗口内，包含 iPS、再生医疗和基因编辑信号。作为趋势源归档。",
        sourceIds: ["science_portal_life_science_index"],
        url: "scienceportal.jst.go.jp",
      },
      {
        name: "医药魔方 / ByDrug",
        mediaGroup: "regional_media",
        companyTag: "公司池定向",
        regionTag: "中国",
        status: "active",
        trust: "B",
        method: "公司池 + site 索引 RSS",
        note: "公司池查询已扩展到 ACRO、Thermo Fisher、默克、Sartorius 和美天旎；只保留公开索引。",
        sourceIds: ["pharmcube_company_pool_index"],
        url: "pharmcube.com",
      },
      {
        name: "生物谷",
        mediaGroup: "regional_media",
        companyTag: "技术主题 / 公司池",
        regionTag: "中国",
        status: "active",
        trust: "C",
        method: "site 索引 / 直连受限",
        note: "官网与 Feed 直连返回 403，已改用公开定向索引接入。本轮 11 条，可发现 AAV、基因治疗、类器官和会议内容；无公司命中时只归档。",
        sourceIds: ["bioon_life_science_index"],
        url: "bioon.com",
      },
      {
        name: "动脉网",
        mediaGroup: "regional_media",
        companyTag: "融资 / 医疗产业",
        regionTag: "中国",
        status: "planned",
        trust: "C",
        method: "公开网页待修复",
        note: "HTTPS 证书域名不匹配，Google News 公司池定向测试为 0；当前不作为稳定自动入口。",
        url: "vcbeat.net",
      },
      {
        name: "界面新闻 · 医药健康",
        mediaGroup: "regional_media",
        companyTag: "公司池 / 市场",
        regionTag: "中国",
        status: "active",
        trust: "C",
        method: "site 索引 RSS",
        note: "已接入医药主题公开索引，本轮 29 条。创新药 ETF、股价和资金流噪音偏高，0 条达到日报门槛，当前只作市场观察归档。",
        sourceIds: ["jiemian_health_index"],
        url: "jiemian.com",
      },
      {
        name: "36Kr · 医疗健康",
        mediaGroup: "regional_media",
        companyTag: "融资 / 初创公司",
        regionTag: "中国",
        status: "active",
        trust: "C",
        method: "site 索引 RSS",
        note: "已接入医疗创业与融资定向索引，本轮 30 条。能发现融资、技术合作和临床申报，但混入基金行情；当前全部低权重归档。",
        sourceIds: ["36kr_health_index"],
        url: "36kr.com",
      },
      {
        name: "E药经理人",
        mediaGroup: "regional_media",
        companyTag: "制药产业 / 管理层",
        regionTag: "中国",
        status: "manual",
        trust: "C",
        method: "微信公众号 / 人工复核",
        note: "主要分发渠道是微信生态，自动化和版权边界复杂；先保留为人工补充来源。",
      },
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
      { name: "Google News - Merck Life Science 全球", status: "active", trust: "C", method: "RSS", note: "强制使用 Merck KGaA、MilliporeSigma 和 Life Science 限定，避免混入美国 MSD / Merck & Co. 药品新闻。", sourceIds: ["google_news_merck_life_science"] },
      { name: "Google News - Merck Life Science 日本", status: "active", trust: "C", method: "日文 RSS", note: "监测日本市场的生命科学、生物工艺、产品和合作信号。", sourceIds: ["google_news_merck_life_science_jp"] },
      { name: "Google News - Sartorius 全球", status: "active", trust: "C", method: "RSS", note: "聚焦 bioprocessing、细胞治疗、制造、新品和合作，排除股价和财务新闻。", sourceIds: ["google_news_sartorius"] },
      { name: "Google News - Sartorius 日本", status: "active", trust: "C", method: "日文 RSS", note: "补充日本的生物工艺、细胞、产品和 Seminar 信号。", sourceIds: ["google_news_sartorius_jp"] },
      { name: "Google News - Miltenyi Biotec 全球", status: "active", trust: "C", method: "RSS", note: "监测 Miltenyi Biotec、Bioindustry 和 Biomedicine 的公开新闻，重点是细胞分选、CGT 与 CDMO。", sourceIds: ["google_news_miltenyi"] },
      { name: "Google News - Miltenyi Biotec 日本", status: "active", trust: "C", method: "日文 RSS", note: "使用日文法人名与日本、Seminar、产品限定做区域补漏。", sourceIds: ["google_news_miltenyi_jp"] },
      {
        name: "Google News - 竞品公司定向池",
        companyTag: "11 家核心竞品 + 扩展对标公司",
        regionTag: "全球 + 日本",
        status: "active",
        trust: "C",
        method: "公司全称 + 业务主题 RSS",
        note: "核心竞品按固定相关性排名管理；这一层只负责外部补漏，每个入口必须同时命中公司或品牌全称。",
        sourceIds: [
          "google_news_proteintech",
          "google_news_abcam",
          "google_news_promega",
          "google_news_rd_systems",
          "google_news_cellgenix",
          "google_news_biolegend",
          "google_news_sigma_aldrich",
          "google_news_biotechne",
          "google_news_peprotech",
          "google_news_bd_biosciences",
          "google_news_medchemexpress",
          "google_news_stemcell_technologies",
          "google_news_sino_biological",
          "google_news_takara_bio",
          "google_news_cytiva",
          "google_news_cytiva_japan",
          "google_news_fujifilm_wako",
          "google_news_nacalai_tesque",
        ],
      },
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
    subtitle: "这一层按平台用途分组，再用获取方式标记自动或人工。官方内容可信度高，但只有能公开、稳定、结构化读取的入口才进入自动任务。",
    sources: [
      {
        name: "ACRO 官方 YouTube",
        socialGroup: "official_video",
        companyTag: "ACRO",
        regionTag: "全球频道",
        status: "active",
        trust: "A",
        method: "公开频道页",
        note: "标准 Atom Feed 返回 404，当前免费读取公开频道页；只生成视频信号，不混入默认新闻日报。",
        sourceIds: ["acro_youtube_official"],
        url: "youtube.com/@ACROBiosystems",
      },
      {
        name: "Thermo Fisher 官方 YouTube",
        socialGroup: "official_video",
        companyTag: "Thermo Fisher",
        regionTag: "全球频道",
        status: "available",
        trust: "A",
        method: "公开频道页",
        note: "原 YouTube Atom Feed 返回 404，官方文档指向的公开频道页本轮解析为 0 条。已暂停自动任务，待确认新频道 ID 或稳定入口后再启用。",
        sourceIds: ["thermo_youtube_official"],
        url: "youtube.com/user/thermoscientific2",
      },
      {
        name: "Merck Life Science 官方 YouTube",
        socialGroup: "official_video",
        companyTag: "Merck Life Science",
        regionTag: "全球频道",
        status: "active",
        trust: "A",
        method: "公开频道页",
        note: "本轮测试 20 条且全部匹配公司；Atom Feed 返回 404，因此使用公开频道页读取。",
        sourceIds: ["merck_life_science_youtube_official"],
        url: "youtube.com/@MerckLifeScience",
      },
      {
        name: "Sartorius 官方 YouTube",
        socialGroup: "official_video",
        companyTag: "Sartorius",
        regionTag: "全球频道",
        status: "active",
        trust: "A",
        method: "公开频道页",
        note: "本轮测试 20 条，包含 CGT、细胞系开发和上游工艺 Webinar；统一作为视频归档信号。",
        sourceIds: ["sartorius_youtube_official"],
        url: "youtube.com/@SartoriusGlobal",
      },
      {
        name: "Miltenyi Biotec 官方 YouTube",
        socialGroup: "official_video",
        companyTag: "Miltenyi Biotec",
        regionTag: "全球频道",
        status: "active",
        trust: "A",
        method: "公开频道页",
        note: "频道由公司官方 Linktree 确认；本轮测试 20 条，覆盖 CGT、空间生物学和 Miltenyi University。",
        sourceIds: ["miltenyi_youtube_official"],
        url: "youtube.com/c/MiltenyiBiotec_MACS",
      },
      {
        name: "LinkedIn 公司主页",
        socialGroup: "professional_social",
        roleTag: "合作 / 活动 / 招聘",
        regionTag: "全球",
        status: "manual",
        trust: "A",
        method: "官方主页人工核对",
        note: "ACRO 页面自动请求实测返回 999，且没有公开稳定 RSS；登记 5 家官方主页，但 MVP 不绕过登录和访问限制。",
        url: "linkedin.com/company",
      },
      {
        name: "X / Twitter 官方账号",
        socialGroup: "professional_social",
        roleTag: "会议传播 / 快讯",
        regionTag: "海外",
        status: "manual",
        trust: "B",
        method: "人工观察",
        note: "公开页返回的是前端页面，未得到稳定结构化帖子数据；不申请付费 API 前，只记录重要活动和合作线索。",
        url: "x.com",
      },
      {
        name: "Facebook / Instagram 官方账号",
        socialGroup: "professional_social",
        roleTag: "品牌传播 / 活动",
        regionTag: "海外 / 地区账号",
        status: "manual",
        trust: "B",
        method: "人工抽查",
        note: "对 B2B 生命科学决策信号贡献较低；只在目标公司或日本地区账号发布独有活动时补录。",
      },
      {
        name: "微信公众号",
        socialGroup: "china_content",
        roleTag: "新闻 / 技术 / 活动",
        regionTag: "中国",
        status: "manual",
        trust: "A",
        method: "官方账号人工核对",
        note: "公众号是中国市场重要来源，但没有公开稳定 RSS；先建立账号白名单和文章人工录入，不自建绕过平台限制的抓取器。",
        url: "mp.weixin.qq.com",
      },
      {
        name: "微信视频号",
        socialGroup: "china_content",
        roleTag: "直播 / 视频 / 活动",
        regionTag: "中国",
        status: "manual",
        trust: "A",
        method: "人工观察",
        note: "适合发现直播预告和短视频，但缺少可公开持续读取的网页 Feed；与公众号活动做同事件去重。",
      },
      {
        name: "Bilibili 官方账号与关键词",
        socialGroup: "china_content",
        roleTag: "技术视频 / 回放",
        regionTag: "中国",
        status: "manual",
        trust: "B",
        method: "人工检索",
        note: "搜索页实测只返回前端外壳，尚未确认 5 家公司的稳定官方账号集合；确认账号后再评估公开视频监控。",
        url: "search.bilibili.com",
      },
      {
        name: "官方 Email Newsletter",
        socialGroup: "subscription_content",
        roleTag: "内容分发",
        regionTag: "全球 / 地区",
        status: "covered",
        trust: "A",
        method: "人工订阅 + 官网去重",
        note: "邮件多数会回链到官网文章或活动页，当前由官网入口覆盖；只在邮件含独有内容时人工补录。",
      },
      {
        name: "Podcast / Spotify / Apple Podcasts",
        socialGroup: "subscription_content",
        roleTag: "访谈 / 趋势",
        regionTag: "全球",
        status: "planned",
        trust: "B",
        method: "公开 Podcast RSS",
        note: "先确认目标公司是否有持续更新的官方节目；若有公开 RSS，可免费接入并作为长内容信号归档。",
      },
    ],
  },
  {
    layer: "market_channel",
    number: "05",
    title: "市场活动与渠道",
    subtitle: "这一层是跨公司监测来源，不属于公司池。平台负责发现信息，系统再匹配公司池中的 ACRO、竞品或后续对标公司；Zoom 只负责承载报名。",
    sources: [
      {
        name: "LINK-J",
        marketGroup: "ecosystem_platform",
        roleTag: "发现源 + 分发渠道",
        regionTag: "日本 / 全国",
        status: "active",
        trust: "B",
        method: "公开活动列表 HTML",
        note: "跨公司读取 LINK-J 主办、共办和特别会员活动；内容出现公司池别名时，自动标记命中的被监测公司。",
        sourceIds: ["linkj_life_science_events"],
        url: "link-j.org/event",
      },
      {
        name: "近畿生物产业振兴会议",
        marketGroup: "ecosystem_platform",
        roleTag: "发现源 + 区域生态",
        regionTag: "日本 / 关西",
        status: "active",
        trust: "B",
        method: "官方直接 RSS",
        note: "跨公司覆盖研讨会、产业交流、BioJapan 支援和关西生命科学项目；再与公司池别名进行匹配。",
        sourceIds: ["kinkibio_official_feed"],
        url: "kinkibio.com/feed",
      },
      {
        name: "湘南 iPark",
        marketGroup: "ecosystem_platform",
        roleTag: "发现源 + 园区生态",
        regionTag: "日本 / 湘南",
        status: "active",
        trust: "B",
        method: "News 列表 HTML",
        note: "跨公司监控园区企业、开放创新、活动公告与合作动态；命中公司池时归到对应公司，否则保留为行业观察。",
        sourceIds: ["shonan_ipark_news_events"],
        url: "shonan-ipark.com/news",
      },
      {
        name: "JBA 日本生物产业协会",
        marketGroup: "ecosystem_platform",
        roleTag: "活动发现 + 产业网络",
        regionTag: "日本 / 全国",
        status: "active",
        trust: "B",
        method: "公开列表 + 详情标题",
        note: "覆盖 JBA 研究会、产业 Seminar、Webinar 和会员活动。本轮获得 9 条；列表链接只写 more，因此低频跟随详情页确认标题和日期。",
        sourceIds: ["jba_public_life_science_events"],
        url: "jba.or.jp",
      },
      {
        name: "FIRM 再生医疗创新论坛",
        marketGroup: "ecosystem_platform",
        roleTag: "CGT 产业 + 活动发现",
        regionTag: "日本 / 亚太",
        status: "active",
        trust: "A",
        method: "官方直接 RSS",
        note: "FIRM 不进入公司池，而是跨公司行业数据源。官方 Feed 分成活动和产业更新两个视图，捕捉 CGT 会议、CDMO、标准、政策和亚太合作信号。",
        sourceIds: ["firm_regenerative_events_rss", "firm_industry_updates_rss"],
        url: "firm.or.jp/feed",
      },
      {
        name: "BioJapan / 再生医疗JAPAN",
        marketGroup: "conference_exhibition",
        roleTag: "旗舰展会",
        regionTag: "日本 / 横滨",
        status: "active",
        trust: "A",
        method: "官方公开页面",
        note: "当前监测来场/Partnering 登记和 Seminar 页面。本轮 2 条；官网更新频率低，但参展商和议题价值高。",
        sourceIds: ["biojapan_public_pages"],
        url: "jcd-expo.jp/jp",
      },
      {
        name: "CPHI Japan",
        marketGroup: "conference_exhibition",
        roleTag: "制药供应链展会",
        regionTag: "日本 / 东京",
        status: "active",
        trust: "A",
        method: "官方直接 RSS",
        note: "官方 RSS 覆盖展期、出展企业、来场登记和 Seminar Program。本轮获得 6 条，是目前最稳定的日本展会 Feed。",
        sourceIds: ["cphi_japan_official_feed"],
        url: "cphijapan.com/feed",
      },
      {
        name: "日本再生医疗学会（JSRM）活动",
        marketGroup: "conference_exhibition",
        roleTag: "学会 / 产业协作",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "活动分类公开页",
        note: "本轮 17 条，已过滤明确标记为已结束的活动；适合发现再生医疗、细胞治疗和产学合作议题。",
        sourceIds: ["jsrm_public_events"],
        url: "jsrm.jp/news-category/event",
      },
      {
        name: "全球重点展会白名单",
        marketGroup: "conference_exhibition",
        roleTag: "议题 / 参展 / 演讲",
        regionTag: "美国 / 欧洲 / 亚太",
        status: "planned",
        trust: "B",
        method: "主办方白名单 + 日历",
        note: "下一批只接 BIO International、SLAS、AACR、ISCT 和 BPI 等明确相关会议，记录日期、参展商、演讲者和议题，不抓全网泛展会。",
      },
      {
        name: "JHVS / MEDISO 医疗创业活动",
        marketGroup: "conference_exhibition",
        roleTag: "初创公司发现",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "厚生劳动省公开页",
        note: "已接入 MEDISO/JHVS 公开活动索引，本轮获得 30 条，包含医疗创业、跨国合作、监管研讨会和产业支持计划。先按活动源观察，后续再结构化参展企业。",
        sourceIds: ["mediso_jhvs_public_index"],
      },
      {
        name: "经销商 / 代理商公开页",
        marketGroup: "partner_network",
        roleTag: "区域验证源",
        regionTag: "多地区",
        status: "planned",
        trust: "C",
        method: "公司白名单 + 新链接差分",
        note: "公司池完成区域分类后，只接入重点经销商和代理商的公开新闻、活动及产品页面。",
      },
      {
        name: "合作伙伴新闻页",
        marketGroup: "partner_network",
        roleTag: "合作验证源",
        regionTag: "全球",
        status: "planned",
        trust: "B",
        method: "定向 RSS / 新链接差分",
        note: "用于补齐合作另一方的表述；系统按标题和事件日期与公司官网、行业平台内容归并。",
      },
      {
        name: "客户案例 / 应用笔记",
        marketGroup: "partner_network",
        roleTag: "商业落地源",
        regionTag: "全球",
        status: "planned",
        trust: "B",
        method: "Sitemap / 新页面监控",
        note: "更新频率低但业务价值高，适合低频检查并提取客户、应用场景和产品线。",
      },
      {
        name: "Zoom / EventRegist / Peatix",
        marketGroup: "registration_infrastructure",
        roleTag: "报名承载工具",
        regionTag: "多地区",
        status: "covered",
        trust: "C",
        method: "跟随原始活动链接核对",
        note: "不做全站抓取。只保存报名 URL、Webinar ID 和渠道参数，用于确认详情并合并 LINK-J、近畿生物、湘南 iPark 分发的同一活动。",
      },
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
        researchGroup: "research_outputs",
        companyTag: "ACRO",
        status: "active",
        trust: "A",
        method: "E-utilities API",
        note: "按 ACROBiosystems 关键词读取 PubMed 记录，单独进入论文研究信号，不进默认新闻日报。",
        sourceIds: ["acro_pubmed_research"],
      },
      {
        name: "Crossref — ACRO 作者机构",
        researchGroup: "research_outputs",
        companyTag: "ACRO",
        status: "active",
        trust: "B",
        method: "公共 REST API",
        note: "必须在作者机构字段出现 ACROBiosystems；本轮 7 条，避免只凭论文标题误匹配。",
        sourceIds: ["crossref_acro_affiliations"],
        url: "api.crossref.org",
      },
      {
        name: "Crossref — Miltenyi 作者机构",
        researchGroup: "research_outputs",
        companyTag: "Miltenyi Biotec",
        status: "active",
        trust: "B",
        method: "公共 REST API",
        note: "本轮 20 条，覆盖 CAR-T 制造、空间生物学和自动化工艺；全部作为研究产出归档。",
        sourceIds: ["crossref_miltenyi_affiliations"],
        url: "api.crossref.org",
      },
      {
        name: "OpenAlex",
        researchGroup: "research_outputs",
        roleTag: "论文 / 机构 / 主题关系",
        status: "available",
        trust: "B",
        method: "免费 API Key",
        note: "开放科研图谱适合补机构、引用和主题网络；当前免费层需要注册 API Key，配置前不发请求。",
        url: "api.openalex.org",
      },
      {
        name: "Europe PMC",
        researchGroup: "research_outputs",
        roleTag: "生命科学论文补充",
        status: "planned",
        trust: "B",
        method: "公开 REST API",
        note: "可补充 PubMed Central、预印本和资助信息；先评估与 PubMed/Crossref 的新增覆盖率再接入。",
      },
      {
        name: "ClinicalTrials.gov — 公司池",
        researchGroup: "trials_regulatory",
        companyTag: "Thermo / Miltenyi / Sartorius",
        status: "active",
        trust: "A",
        method: "官方 v2 API",
        note: "只查询公司作为 Sponsor 或 Collaborator 的试验，按最后更新时间排序。本轮 24 条、近一年 13 条，默认归档。",
        sourceIds: ["clinicaltrials_company_pool"],
        url: "clinicaltrials.gov/api/v2",
      },
      {
        name: "PMDA — 生命科学与再生医疗更新",
        researchGroup: "trials_regulatory",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "官方新着页",
        note: "只保留有发布日期且命中细胞、基因、抗体、生物来源或再生医疗主题的更新。本轮 11 条。",
        sourceIds: ["pmda_life_science_updates"],
        url: "pmda.go.jp/0017.html",
      },
      {
        name: "openFDA — Thermo 召回监控",
        researchGroup: "trials_regulatory",
        companyTag: "Thermo Fisher",
        status: "active",
        trust: "A",
        method: "公开 API",
        note: "只显示两年内召回记录；其余公司实测无结果，Sartorius 仅有一条 2022 年旧记录，因此未新增任务。",
        sourceIds: ["thermo_openfda_monitor"],
      },
      {
        name: "AMED 研发资助与政策",
        researchGroup: "trials_regulatory",
        regionTag: "日本",
        status: "active",
        trust: "A",
        method: "官方站定向索引 RSS",
        note: "测试获得 22 条，内容主要是采纳项目、公开招募、研发计划和产业化政策；作为研发资助信号独立归档。",
        sourceIds: ["amed_life_science_index"],
        url: "amed.go.jp",
      },
      {
        name: "jRCT / CTIS",
        researchGroup: "trials_regulatory",
        roleTag: "日本 / 欧盟试验注册",
        status: "planned",
        trust: "A",
        method: "公开检索 / 数据接口评估",
        note: "用于补 ClinicalTrials.gov 未完整覆盖的日本和欧盟试验；先确认可持续导出与公司角色字段。",
      },
      {
        name: "SEC EDGAR — Thermo",
        researchGroup: "filings_patents",
        companyTag: "Thermo Fisher",
        status: "available",
        trust: "A",
        method: "官方 JSON API（待配置）",
        note: "解析器已完成，只保留 8-K、10-Q、10-K；SEC 要求可联系的 User-Agent，配置业务邮箱前保持关闭。",
        sourceIds: ["thermo_sec_filings"],
        url: "data.sec.gov/submissions",
      },
      {
        name: "EDINET 日本公司披露",
        researchGroup: "filings_patents",
        regionTag: "日本",
        status: "available",
        trust: "A",
        method: "免费订阅密钥 API",
        note: "适合日本上市公司有价证券报告和临时报告；需要免费注册订阅密钥，公司池加入日本上市主体后再配置。",
      },
      {
        name: "J-PlatPat",
        researchGroup: "filings_patents",
        regionTag: "日本",
        status: "manual",
        trust: "A",
        method: "官方网页人工检索",
        note: "免费查看日本专利和商标，但没有适合当前自动任务的公开批量 API；用于重点事件人工核对。",
      },
      {
        name: "EPO OPS",
        researchGroup: "filings_patents",
        regionTag: "全球",
        status: "planned",
        trust: "A",
        method: "免费额度 + OAuth",
        note: "可做专利族和法律状态基础监测；需注册 OAuth、处理名称归一和严格限流，放在第二阶段。",
      },
      {
        name: "ROR 组织标识",
        researchGroup: "organization_workforce",
        roleTag: "机构名称归一",
        status: "available",
        trust: "B",
        method: "免费 REST API / 数据快照",
        note: "适合给科研机构和部分企业建立稳定 ID，不是新闻源；ACRO 本轮查询无记录，因此暂不运行。",
      },
      {
        name: "公司官方 Careers 页面",
        researchGroup: "organization_workforce",
        roleTag: "地区 / 岗位 / 能力扩张",
        status: "planned",
        trust: "A",
        method: "Sitemap / 新链接差分",
        note: "优先接官方招聘页，只记录岗位、地点和职能变化；不采集应聘者或员工个人资料。",
      },
      {
        name: "LinkedIn 招聘与组织变化",
        researchGroup: "organization_workforce",
        roleTag: "人工验证",
        status: "manual",
        trust: "B",
        method: "官方公司页人工复核",
        note: "用于验证管理层和团队扩张，但自动访问受限；不抓员工名单、个人动态或登录后信息。",
      },
    ],
  },
  {
    layer: "restricted",
    number: "07",
    title: "高风险受限来源",
    subtitle: "可能有价值，但权限、合规、版权和稳定性风险高。记录存在，MVP 不抓取，不绕过限制。",
    sources: [
      {
        name: "LinkedIn 登录后内容",
        restrictedGroup: "account_gate",
        roleTag: "公司动态 / 招聘 / 员工",
        status: "blocked",
        trust: "—",
        method: "不自动访问",
        note: "不复用个人登录会话，不批量翻页或抓员工列表；可用公开公司页、官方 Careers 和人工复核替代。",
      },
      {
        name: "微信公众号后台 / 视频号后台",
        restrictedGroup: "account_gate",
        roleTag: "账号管理区",
        status: "blocked",
        trust: "—",
        method: "不接入凭证",
        note: "后台数据属于企业账号权限；没有明确授权、专用账号和审计流程时，不向自动任务提供 Cookie 或登录凭证。",
      },
      {
        name: "会员数据库与账号席位",
        restrictedGroup: "account_gate",
        roleTag: "订阅授权",
        status: "blocked",
        trust: "—",
        method: "等待企业授权",
        note: "即使员工能登录，也需确认合同是否允许 API、导出和内部再分发；未确认前只做人工查阅。",
      },
      {
        name: "滑块 / CAPTCHA / 设备校验页面",
        restrictedGroup: "anti_bot",
        roleTag: "访问阻断",
        status: "blocked",
        trust: "—",
        method: "停止自动请求",
        note: "ACRO 等官网出现滑块时改用公开索引、Sitemap 或 RSS，不模拟拖动、不购买验证码识别服务。",
      },
      {
        name: "LinkedIn / X / Bilibili 动态搜索页",
        restrictedGroup: "anti_bot",
        roleTag: "纯前端 / 限流",
        status: "blocked",
        trust: "—",
        method: "人工观察",
        note: "实测公开请求只得到阻断码或前端外壳，没有稳定结构化帖子；不把偶尔成功当成可运行来源。",
      },
      {
        name: "Cloudflare / WAF 严格站点",
        restrictedGroup: "anti_bot",
        roleTag: "反自动化",
        status: "blocked",
        trust: "—",
        method: "寻找官方替代",
        note: "优先寻找官方 Feed、新闻稿分发平台、搜索索引或邮件订阅；没有替代时登记为人工来源。",
      },
      {
        name: "日经 Biotech / Nikkei 会员正文",
        restrictedGroup: "paywall_copyright",
        roleTag: "日本行业深度内容",
        status: "blocked",
        trust: "—",
        method: "只保留公开索引",
        note: "当前只监测公开标题、日期和链接；不抓会员正文，不把搜索摘要拼接成替代文章。",
      },
      {
        name: "BioCentury / STAT+ / Endpoints 付费内容",
        restrictedGroup: "paywall_copyright",
        roleTag: "国际行业深度内容",
        status: "blocked",
        trust: "—",
        method: "人工订阅评估",
        note: "可记录公开标题和合法摘要；需要正文时由授权用户打开，不批量复制或再发布。",
      },
      {
        name: "付费报告、图表与 PDF 下载库",
        restrictedGroup: "paywall_copyright",
        roleTag: "市场研究资产",
        status: "blocked",
        trust: "—",
        method: "不批量下载",
        note: "报告许可通常限制席位和传播；平台只保存报告名称、发布日期、覆盖范围和采购判断。",
      },
      {
        name: "微信群 / Teams / Slack 私域讨论",
        restrictedGroup: "private_personal",
        roleTag: "非公开交流",
        status: "blocked",
        trust: "—",
        method: "不采集",
        note: "群成员并未同意进入情报系统；除非公司建立明确的授权归档流程，否则不读取、不转存、不摘要。",
      },
      {
        name: "员工个人账号与个人动态",
        restrictedGroup: "private_personal",
        roleTag: "个人信息",
        status: "blocked",
        trust: "—",
        method: "不建立个人监控",
        note: "不追踪普通员工发帖、位置、关系网和离职迹象；管理层正式任免只以公司公告或可靠媒体核对。",
      },
      {
        name: "联系人、邮箱与参会者名单",
        restrictedGroup: "private_personal",
        roleTag: "个人可识别数据",
        status: "blocked",
        trust: "—",
        method: "不进入新闻库",
        note: "会议报名和销售联系人属于独立 CRM/隐私流程，不与公开新闻抓取、评分和分享页混用。",
      },
      {
        name: "robots.txt 禁止路径",
        restrictedGroup: "policy_robots",
        roleTag: "网站规则",
        status: "blocked",
        trust: "—",
        method: "不发起任务",
        note: "记录被禁止的路径和检查日期；只有网站规则改变或取得书面许可后才重新评估。",
      },
      {
        name: "API 配额、导出与再分发限制",
        restrictedGroup: "policy_robots",
        roleTag: "服务条款",
        status: "blocked",
        trust: "—",
        method: "按许可使用",
        note: "免费额度也有频率和使用范围；系统必须缓存、退避并遵守署名、删除和再分发要求。",
      },
      {
        name: "禁止自动化的站内搜索与结果页",
        restrictedGroup: "policy_robots",
        roleTag: "检索许可",
        status: "blocked",
        trust: "—",
        method: "改用开放接口",
        note: "优先使用官方 API、Sitemap、RSS 或公开数据集；网页搜索仅供人工核对。",
      },
      {
        name: "验证码识别与绕过服务",
        restrictedGroup: "prohibited_methods",
        roleTag: "明确红线",
        status: "blocked",
        trust: "—",
        method: "禁止",
        note: "不接第三方打码、不模拟验证流程，也不通过隐藏浏览器行为绕过访问控制。",
      },
      {
        name: "代理轮换与浏览器指纹伪装",
        restrictedGroup: "prohibited_methods",
        roleTag: "明确红线",
        status: "blocked",
        trust: "—",
        method: "禁止",
        note: "不会为了维持来源而更换 IP、伪造设备或隐藏自动化特征；来源不稳定就降级或停用。",
      },
      {
        name: "共享 Cookie / 密码 / 账号池",
        restrictedGroup: "prohibited_methods",
        roleTag: "凭证安全",
        status: "blocked",
        trust: "—",
        method: "禁止",
        note: "不保存个人密码，不跨员工共享会话，不用离职人员或外部账号维持抓取。",
      },
    ],
  },
  {
    layer: "paid_later",
    number: "08",
    title: "商业数据服务",
    subtitle: "覆盖更稳定、更全面。等 MVP 证明价值后再申请预算评估，不在一开始烧钱。",
    sources: [
      {
        name: "Crossref + PubMed",
        serviceGroup: "open_foundation",
        roleTag: "论文与作者机构",
        status: "covered",
        trust: "A",
        method: "开放 API",
        note: "已用于 ACRO 和 Miltenyi 科研产出；先证明作者机构匹配和主题分析价值，再考虑 Scopus / Web of Science。",
        sourceIds: ["crossref_acro_affiliations", "crossref_miltenyi_affiliations", "acro_pubmed_research"],
      },
      {
        name: "ClinicalTrials.gov + PMDA + openFDA",
        serviceGroup: "open_foundation",
        roleTag: "临床 / 监管 / 安全",
        status: "covered",
        trust: "A",
        method: "官方公开 API / 页面",
        note: "已经覆盖试验角色、监管更新和召回；只有跨库关联和预测能力不足时才采购专业库。",
        sourceIds: ["clinicaltrials_company_pool", "pmda_life_science_updates", "thermo_openfda_monitor"],
      },
      {
        name: "RSS + Google/Bing 公开索引",
        serviceGroup: "open_foundation",
        roleTag: "新闻发现",
        status: "covered",
        trust: "B",
        method: "免费 Feed",
        note: "当前 MVP 的主发现层；新闻 API 必须证明能显著降低漏报、重复或延迟，才值得替换。",
      },
      {
        name: "GDELT DOC API",
        serviceGroup: "open_foundation",
        roleTag: "全球多语新闻",
        status: "available",
        trust: "C",
        method: "免费公共 API",
        note: "本轮实测触发全局限流并返回提示文本，不是稳定 JSON；暂不运行，可用于低频研究而非日报生产。",
      },
      {
        name: "ROR / GLEIF / OpenCorporates",
        serviceGroup: "company_freemium",
        roleTag: "组织身份 / 法人关系",
        status: "available",
        trust: "B",
        method: "开放或免费层",
        note: "适合公司名称归一、法人和组织 ID；覆盖不等于新闻，ACRO 在 ROR 本轮无记录，先作为建档工具。",
      },
      {
        name: "Crunchbase Basic",
        serviceGroup: "company_freemium",
        roleTag: "公司 / 融资 / 人员",
        status: "manual",
        trust: "B",
        method: "免费网页人工核对",
        note: "免费账户适合单家公司验证，API 和批量导出需商业授权；不通过网页抓取替代付费 API。",
      },
      {
        name: "Dealroom 免费层",
        serviceGroup: "company_freemium",
        roleTag: "初创公司 / 融资 / 生态",
        status: "manual",
        trust: "B",
        method: "免费注册人工研究",
        note: "适合地区创新生态和初创公司发现；先评估日本与亚太生命科学覆盖，再决定是否采购导出或 API。",
      },
      {
        name: "PitchBook / CB Insights / Tracxn",
        serviceGroup: "company_freemium",
        roleTag: "融资 / 并购 / 投资人",
        status: "paid",
        trust: "A",
        method: "订阅 / API",
        note: "只有领导明确需要融资轮次、估值、投资人关系和交易可比分析时，才进入采购候选。",
      },
      {
        name: "NewsAPI / GNews / Mediastack",
        serviceGroup: "news_api",
        roleTag: "统一新闻接口",
        status: "paid",
        trust: "B",
        method: "商业 API",
        note: "重点比较历史回溯、全文授权、语言覆盖、去重和商业使用条款；免费开发额度不等于可用于生产。",
      },
      {
        name: "Event Registry",
        serviceGroup: "news_api",
        roleTag: "事件聚类 / 多语覆盖",
        status: "paid",
        trust: "B",
        method: "API",
        note: "如果人工去重成本持续偏高，可评估其事件聚类和实体识别，而不是只比较文章数量。",
      },
      {
        name: "Meltwater / Cision / Muck Rack",
        serviceGroup: "news_api",
        roleTag: "媒体监测 / PR 工作流",
        status: "paid",
        trust: "A",
        method: "SaaS / 导出",
        note: "适合品牌声量、媒体关系和传播报告；与当前竞品情报需求不同，需由市场传播 KPI 驱动采购。",
      },
      {
        name: "Citeline（Trialtrove / Pharmaprojects）",
        serviceGroup: "life_science_intelligence",
        roleTag: "管线 / 临床 / 试验预测",
        status: "paid",
        trust: "A",
        method: "订阅 / API",
        note: "用于跨公司管线和临床里程碑研究；当前开放试验库跑稳后，再衡量它增加了多少独有字段。",
      },
      {
        name: "GlobalData / Evaluate Pharma",
        serviceGroup: "life_science_intelligence",
        roleTag: "市场规模 / 管线 / 交易",
        status: "paid",
        trust: "A",
        method: "订阅 / 报告",
        note: "适合年度战略研究和市场预测，不适合作为每天新闻抓取的第一笔预算。",
      },
      {
        name: "Clarivate Cortellis",
        serviceGroup: "life_science_intelligence",
        roleTag: "药物 / 专利 / 监管整合",
        status: "paid",
        trust: "A",
        method: "企业订阅",
        note: "优势是跨域关联而不是单条新闻；只有需要管线、专利和监管统一实体图谱时评估。",
      },
      {
        name: "BioCentury Intelligence",
        serviceGroup: "life_science_intelligence",
        roleTag: "交易 / 公司 / 战略分析",
        status: "paid",
        trust: "A",
        method: "订阅",
        note: "深度分析价值高但版权严格；试用时应按独有洞察和决策使用率评估，不按文章数量评估。",
      },
      {
        name: "LinkedIn 官方产品 / API",
        serviceGroup: "social_monitoring",
        roleTag: "公司 / 招聘 / 组织",
        status: "paid",
        trust: "B",
        method: "官方授权",
        note: "只在社交和招聘信号成为明确需求后评估；不购买来源不明的 LinkedIn 抓取服务。",
      },
      {
        name: "微信生态监测服务",
        serviceGroup: "social_monitoring",
        roleTag: "公众号 / 视频号",
        status: "paid",
        trust: "B",
        method: "合规第三方服务",
        note: "要求说明授权链、历史覆盖、删除机制和数据出口；不自建绕过微信平台限制的采集器。",
      },
      {
        name: "Brandwatch / Talkwalker",
        serviceGroup: "social_monitoring",
        roleTag: "跨平台声量 / 主题趋势",
        status: "paid",
        trust: "B",
        method: "SaaS",
        note: "适合大规模品牌与舆情监测；当前 MVP 公司池仍优先验证免费入口。",
      },
      {
        name: "Patsnap / Derwent Innovation",
        serviceGroup: "patent_trial_paid",
        roleTag: "专利族 / 法律状态 / 语义检索",
        status: "paid",
        trust: "A",
        method: "订阅 / API",
        note: "免费专利接口无法稳定完成专利族清洗和法律状态分析时，再用重点技术主题做小范围试用。",
      },
      {
        name: "Lens.org",
        serviceGroup: "patent_trial_paid",
        roleTag: "论文与专利关联",
        status: "available",
        trust: "B",
        method: "免费研究账户 / 授权导出",
        note: "个人研究层可人工验证，批量和商业使用需确认许可；不把登录后网页作为自动抓取入口。",
      },
      {
        name: "商业临床与法规数据库",
        serviceGroup: "patent_trial_paid",
        roleTag: "跨注册库 / 里程碑 / 预测",
        status: "paid",
        trust: "A",
        method: "订阅 / API",
        note: "采购前用 ClinicalTrials.gov、jRCT、CTIS 和 PMDA 建立免费基线，再测独有覆盖率和节省的人工时间。",
      },
    ],
  },
];

const pageMeta = {
  overview: ["Market Intelligence Dashboard", "目标公司与行业热点雷达"],
  "overview-metric": ["Dashboard Metric Detail", "总览指标明细"],
  companies: ["Company Pool", "目标公司池"],
  timeline: ["Company Timeline", "公司动态时间线与长期档案"],
  "japan-customers": ["Japan Account Intelligence", "日本客户与潜在账户情报"],
  relationships: ["Relationship Intelligence", "ACRO 企业关系与客户线索"],
  "company-sources": ["Company Sources", "公司数据源档案"],
  signals: ["Intelligence Detail", "情报明细与证据库"],
  sources: ["Source Map", "数据源地图与接入边界"],
  acro: ["Company Profile", "ACRO 运营档案"],
  methodology: ["Rules & Definitions", "规则中心：运行逻辑与指标口径"],
  pipeline: ["System Architecture", "系统链路、五层能力与实施蓝图"],
  questions: ["Product Decisions", "已确定边界与下一阶段决策"],
  "source-health": ["Source Operations", "数据源健康与产出质量"],
};

const overviewApacRegions = new Set(["japan", "china", "korea", "southeast_asia"]);

const overviewMetricDefinitions = {
  critical: {
    label: "重大信号",
    pageTitle: "重大信号明细",
    description: "当前筛选范围内，同时属于“进入日报 / 即时提醒”且 ACRO 相关性为高的信息。这里用于回答哪些事件需要优先核验和安排动作。",
    boundary: "这是优先级入口，不代表每条信息都已由内部确认；进入行动前仍应查看原文证据与业务边界。",
    matches: (item) =>
      ["daily", "immediate"].includes(item.tier) && item.acro_relevance?.level === "high",
  },
  competitor: {
    label: "竞品动态",
    pageTitle: "竞品动态明细",
    description: "当前筛选范围内，命中已确认竞品池公司的产品、技术、合作、区域和组织动态。",
    boundary: "竞品命中来自公司角色配置；同一条新闻可能涉及多家公司，也可能同时计入重大信号或亚太地区动态。",
    matches: (item, companyRoles) => getItemRole(item, companyRoles) === "competitor",
  },
  customer: {
    label: "账户动态信号",
    pageTitle: "账户动态信号明细",
    description: "当前筛选范围内，命中日本客户与潜在账户目录的公开动态，用于销售、BD 和区域市场安排核验与跟进。",
    boundary: "账户目录代表监测对象，不等于已成交客户；公开新闻只能形成跟进线索，不能替代内部 CRM 关系确认。",
    matches: (item, companyRoles) => getItemRole(item, companyRoles) === "customer",
  },
  apac: {
    label: "亚太地区动态",
    pageTitle: "亚太地区动态明细",
    description: "当前筛选范围内，规则识别为日本、中国、韩国或东南亚的信息，用于观察地区市场、监管、活动与合作变化。",
    boundary: "地区由标题、摘要和来源线索识别；“全球 / 未识别”不会进入本指标，边界不清的条目仍需人工核验。",
    matches: (item) => overviewApacRegions.has(inferItemRegion(item)),
  },
};

const companyIdToDisplayName = {
  acro: "ACROBiosystems / 百普赛斯",
  thermo_fisher: "Thermo Fisher Scientific",
  merck_life_science: "Merck KGaA Life Science / MilliporeSigma",
  sartorius: "Sartorius / Sartorius Stedim Biotech",
  miltenyi_biotec: "Miltenyi Biotec / 美天旎",
  abcam: "Abcam",
  promega: "Promega",
  rd_systems: "R&D Systems",
  proteintech: "Proteintech",
  cellgenix: "CellGenix",
  biolegend: "BioLegend",
  sigma_aldrich: "Sigma-Aldrich",
  biotechne: "Bio-Techne",
  peprotech: "PeproTech",
  bd_biosciences: "BD Biosciences",
  medchemexpress: "MedChemExpress / MCE",
  stemcell_technologies: "STEMCELL Technologies",
  sino_biological: "Sino Biological / 义翘神州",
  takara_bio: "Takara Bio / 宝生物",
  cytiva: "Cytiva / 思拓凡",
  fujifilm_wako: "FUJIFILM Wako Pure Chemical / 富士胶片和光纯药",
  nacalai_tesque: "Nacalai Tesque / ナカライテスク",
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
    companies: 13,
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
  overviewMetricGrid: document.querySelector("#overviewMetricGrid"),
  overviewMetricBackButton: document.querySelector("#overviewMetricBackButton"),
  overviewMetricHero: document.querySelector("#overviewMetricHero"),
  overviewMetricBreadcrumbTitle: document.querySelector("#overviewMetricBreadcrumbTitle"),
  overviewMetricTitle: document.querySelector("#overviewMetricTitle"),
  overviewMetricDescription: document.querySelector("#overviewMetricDescription"),
  overviewMetricBoundary: document.querySelector("#overviewMetricBoundary"),
  overviewMetricCount: document.querySelector("#overviewMetricCount"),
  overviewMetricScope: document.querySelector("#overviewMetricScope"),
  overviewMetricFacts: document.querySelector("#overviewMetricFacts"),
  overviewMetricListTitle: document.querySelector("#overviewMetricListTitle"),
  overviewMetricResultCount: document.querySelector("#overviewMetricResultCount"),
  overviewMetricList: document.querySelector("#overviewMetricList"),
  updatedAt: document.querySelector("#updatedAt"),
  signalList: document.querySelector("#signalList"),
  topSignalList: document.querySelector("#topSignalList"),
  detailSignalCount: document.querySelector("#detailSignalCount"),
  sourceCount: document.querySelector("#sourceCount"),
  windowDays: document.querySelector("#windowDays"),
  timeRangeControl: document.querySelector("#timeRangeControl"),
  roleControl: document.querySelector("#roleControl"),
  regionFilter: document.querySelector("#regionFilter"),
  executiveHeadline: document.querySelector("#executiveHeadline"),
  executivePoints: document.querySelector("#executivePoints"),
  assistantMode: document.querySelector("#assistantMode"),
  assistantDisclosure: document.querySelector("#assistantDisclosure"),
  assistantPrompts: document.querySelector(".assistant-prompts"),
  assistantViewLabel: document.querySelector("#assistantViewLabel"),
  assistantViewBasis: document.querySelector("#assistantViewBasis"),
  assistantViewBoundary: document.querySelector("#assistantViewBoundary"),
  customerPriorityScope: document.querySelector("#customerPriorityScope"),
  customerPriorityMatrix: document.querySelector("#customerPriorityMatrix"),
  openJapanAccountsButton: document.querySelector("#openJapanAccountsButton"),
  signalTrendChart: document.querySelector("#signalTrendChart"),
  trendLegend: document.querySelector("#trendLegend"),
  regionBars: document.querySelector("#regionBars"),
  companyTopicMatrix: document.querySelector("#companyTopicMatrix"),
  categoryBars: document.querySelector("#categoryBars"),
  metricCompetitorNote: document.querySelector("#metricCompetitorNote"),
  metricCustomerNote: document.querySelector("#metricCustomerNote"),
  openSignalDetailButton: document.querySelector("#openSignalDetailButton"),
  tierFilter: document.querySelector("#tierFilter"),
  relevanceFilter: document.querySelector("#relevanceFilter"),
  signalTypeFilter: document.querySelector("#signalTypeFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  companyFilter: document.querySelector("#companyFilter"),
  searchInput: document.querySelector("#searchInput"),
  translationToggles: document.querySelectorAll(".translation-toggle"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  refreshButton: document.querySelector("#refreshButton"),
  healthStatus: document.querySelector("#healthStatus"),
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
  pageEyebrow: document.querySelector("#pageEyebrow"),
  pageTitle: document.querySelector("#pageTitle"),
  toolbar: document.querySelector(".toolbar"),
  ruleGrid: document.querySelector("#ruleGrid"),
  sourceViewControl: document.querySelector("#sourceViewControl"),
  sourceViewMetrics: document.querySelector("#sourceViewMetrics"),
  sourceViewTitle: document.querySelector("#sourceViewTitle"),
  sourceLibraryIntro: document.querySelector("#sourceLibraryIntro"),
  sourceExperimentSummary: document.querySelector("#sourceExperimentSummary"),
  sourceExperimentPrinciple: document.querySelector("#sourceExperimentPrinciple"),
  sourceExperimentGrid: document.querySelector("#sourceExperimentGrid"),
  sourceStageFilter: document.querySelector("#sourceStageFilter"),
  sourceStageCount: document.querySelector("#sourceStageCount"),
  companyPoolTimestamp: document.querySelector("#companyPoolTimestamp"),
  companyRoleSummary: document.querySelector("#companyRoleSummary"),
  companyPoolGroups: document.querySelector("#companyPoolGroups"),
  companyTimelineTimestamp: document.querySelector("#companyTimelineTimestamp"),
  companyTimelineSelect: document.querySelector("#companyTimelineSelect"),
  timelineScopeControl: document.querySelector("#timelineScopeControl"),
  companyTimelineMetrics: document.querySelector("#companyTimelineMetrics"),
  companyLivingProfile: document.querySelector("#companyLivingProfile"),
  companyTimelineList: document.querySelector("#companyTimelineList"),
  competitorLaneCount: document.querySelector("#competitorLaneCount"),
  opportunityLaneCount: document.querySelector("#opportunityLaneCount"),
  partnerLaneCount: document.querySelector("#partnerLaneCount"),
  competitorActionList: document.querySelector("#competitorActionList"),
  opportunityActionList: document.querySelector("#opportunityActionList"),
  partnerActionList: document.querySelector("#partnerActionList"),
  openRelationshipsButton: document.querySelector("#openRelationshipsButton"),
  relationshipUpdatedAt: document.querySelector("#relationshipUpdatedAt"),
  relationshipConfirmedCount: document.querySelector("#relationshipConfirmedCount"),
  relationshipDisclosedCount: document.querySelector("#relationshipDisclosedCount"),
  relationshipCandidateCount: document.querySelector("#relationshipCandidateCount"),
  relationshipCustomerCount: document.querySelector("#relationshipCustomerCount"),
  relationshipJapanCustomerCount: document.querySelector("#relationshipJapanCustomerCount"),
  relationshipSegmentCount: document.querySelector("#relationshipSegmentCount"),
  relationshipGraph: document.querySelector("#relationshipGraph"),
  relationshipFocusPanel: document.querySelector("#relationshipFocusPanel"),
  relationshipLayerControl: document.querySelector("#relationshipLayerControl"),
  relationshipResultCount: document.querySelector("#relationshipResultCount"),
  relationshipTypeFilter: document.querySelector("#relationshipTypeFilter"),
  relationshipEvidenceFilter: document.querySelector("#relationshipEvidenceFilter"),
  relationshipList: document.querySelector("#relationshipList"),
  customerSegmentList: document.querySelector("#customerSegmentList"),
  japanCustomerTimestamp: document.querySelector("#japanCustomerTimestamp"),
  japanCustomerCount: document.querySelector("#japanCustomerCount"),
  japanPublicRelationshipCount: document.querySelector("#japanPublicRelationshipCount"),
  japanIndustryCount: document.querySelector("#japanIndustryCount"),
  japanLinkedCount: document.querySelector("#japanLinkedCount"),
  japanCustomerSearch: document.querySelector("#japanCustomerSearch"),
  japanCustomerTypeFilter: document.querySelector("#japanCustomerTypeFilter"),
  japanCustomerSapFilter: document.querySelector("#japanCustomerSapFilter"),
  japanCustomerSignalFilter: document.querySelector("#japanCustomerSignalFilter"),
  japanCustomerResultCount: document.querySelector("#japanCustomerResultCount"),
  japanCustomerList: document.querySelector("#japanCustomerList"),
  japanCustomerDetail: document.querySelector("#japanCustomerDetail"),
  acroProfileTimestamp: document.querySelector("#acroProfileTimestamp"),
  acroProfileSourceCount: document.querySelector("#acroProfileSourceCount"),
  acroProfileSourceDetail: document.querySelector("#acroProfileSourceDetail"),
  acroProfileCoverageCount: document.querySelector("#acroProfileCoverageCount"),
  acroProfileSignalCount: document.querySelector("#acroProfileSignalCount"),
  acroProfileSignalDetail: document.querySelector("#acroProfileSignalDetail"),
  acroProfileHealth: document.querySelector("#acroProfileHealth"),
  acroProfileHealthDetail: document.querySelector("#acroProfileHealthDetail"),
  openAcroSourcesButton: document.querySelector("#openAcroSourcesButton"),
  companyCoverageTitle: document.querySelector("#companyCoverageTitle"),
  companyCoverageTimestamp: document.querySelector("#companyCoverageTimestamp"),
  companyCoverageDescription: document.querySelector("#companyCoverageDescription"),
  companyCoverageSelect: document.querySelector("#companyCoverageSelect"),
  companyCoverageMetrics: document.querySelector("#companyCoverageMetrics"),
  companyCoverageGrid: document.querySelector("#companyCoverageGrid"),
  companySourceCrosswalk: document.querySelector("#companySourceCrosswalk"),
  companyDockCount: document.querySelector("#companyDockCount"),
  companyDockList: document.querySelector("#companyDockList"),
  structuredRuleVersion: document.querySelector("#structuredRuleVersion"),
  structuredGroupCount: document.querySelector("#structuredGroupCount"),
  structuredTermCount: document.querySelector("#structuredTermCount"),
  structuredHitCount: document.querySelector("#structuredHitCount"),
  structuredRuleGrid: document.querySelector("#structuredRuleGrid"),
  methodologyDetailBar: document.querySelector("#methodologyDetailBar"),
  methodologyBackButton: document.querySelector("#methodologyBackButton"),
  methodologyBreadcrumbFamily: document.querySelector("#methodologyBreadcrumbFamily"),
  methodologyBreadcrumbTitle: document.querySelector("#methodologyBreadcrumbTitle"),
  methodologyIndexBlocks: document.querySelectorAll(".methodology-index-only"),
  methodologyDetailList: document.querySelector("#methodologyDetailList"),
  methodologyDetails: document.querySelectorAll("[data-methodology-detail]"),
  methodologyVersion: document.querySelector("#methodologyVersion"),
  methodologyVerifiedAt: document.querySelector("#methodologyVerifiedAt"),
  ruleCatalogCardVersion: document.querySelector("#ruleCatalogCardVersion"),
  methodologyTrendCount: document.querySelector("#methodologyTrendCount"),
  methodologyTrendExample: document.querySelector("#methodologyTrendExample"),
  methodologyScopedCount: document.querySelector("#methodologyScopedCount"),
  methodologyHealthySources: document.querySelector("#methodologyHealthySources"),
  methodologyNewsExample: document.querySelector("#methodologyNewsExample"),
  methodologyRelevanceExample: document.querySelector("#methodologyRelevanceExample"),
  methodologyPriorityExample: document.querySelector("#methodologyPriorityExample"),
  methodologyDensityExample: document.querySelector("#methodologyDensityExample"),
  summaryStrategyStatus: document.querySelector("#summaryStrategyStatus"),
  summaryPipelineDetail: document.querySelector("#summaryPipelineDetail"),
  storageLatestSnapshot: document.querySelector("#storageLatestSnapshot"),
  storageHistorySize: document.querySelector("#storageHistorySize"),
  storageDedupeCount: document.querySelector("#storageDedupeCount"),
  storageSourceState: document.querySelector("#storageSourceState"),
  storagePipelineSnapshot: document.querySelector("#storagePipelineSnapshot"),
  storagePipelineHistory: document.querySelector("#storagePipelineHistory"),
  pagePanels: document.querySelectorAll("[data-page]"),
  pageButtons: document.querySelectorAll("[data-page-target]"),
};

function liveDataUrl(path) {
  const url = new URL(path, window.location.href);
  url.searchParams.set("_refresh", Date.now().toString());
  return url.toString();
}

async function fetchJson(path) {
  const response = await fetch(liveDataUrl(path), {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function renderLoadedData() {
  hydrateFilters();
  renderCompanyDock();
  renderCompanyPools();
  renderJapanAccountIntelligence();
  renderCompanyRelationships();
  renderCompanySourceCoverage();
  renderAcroOperationalProfile();
  renderStructuredRules();
  renderMethodology();
  render();
  renderSourceHealth();
  renderSourceHealthPage();
}

function hydrateCompanyMetadata(payload) {
  const embeddedCompanies = window.AIHOT_EMBEDDED_PAYLOAD?.companies || [];
  const metadataById = new Map(embeddedCompanies.map((company) => [company.id, company]));
  return {
    ...payload,
    companies: (payload.companies || []).map((company) => ({
      ...(metadataById.get(company.id) || {}),
      ...company,
    })),
  };
}

const companyRoleDockMeta = {
  self: { label: "本公司", empty: "尚未设置本公司" },
  competitor: { label: "竞品 / 对标池", empty: "尚未设置竞品" },
  customer: { label: "客户 / 账户", empty: "账户目录待导入" },
};

function compactCompanyName(company) {
  if (company.id === "acro") return "ACRO";
  return (company.display_name || company.id).split(" / ")[0];
}

function getCompetitiveRank(company) {
  const rank = Number(company?.competitive_relevance_rank);
  return Number.isFinite(rank) && rank > 0 ? rank : Number.POSITIVE_INFINITY;
}

function formatCompetitiveRank(company) {
  const rank = getCompetitiveRank(company);
  return Number.isFinite(rank) ? String(rank).padStart(2, "0") : "--";
}

function sortCompaniesForDisplay(companies) {
  const roleOrder = { self: 0, competitor: 1, customer: 2 };
  return [...companies].sort((a, b) => {
    const roleDelta = (roleOrder[a.business_role] ?? 9) - (roleOrder[b.business_role] ?? 9);
    if (roleDelta) return roleDelta;
    const rankDelta = getCompetitiveRank(a) - getCompetitiveRank(b);
    if (rankDelta) return rankDelta;
    return String(a.display_name || a.id).localeCompare(String(b.display_name || b.id), "en");
  });
}

function renderCompanyDock() {
  if (!els.companyDockList || !els.companyDockCount) return;
  const companies = state.payload?.companies || [];
  els.companyDockCount.textContent = `${companies.length} 家公司已接入`;
  const allButton = `
    <button class="company-chip ${state.company === "all" ? "active" : ""}" type="button" data-filter-company="all">
      <span class="company-chip-main"><i class="company-dot all"></i><strong>全部公司</strong></span>
      <small>本公司 + 竞品 + 客户联合情报流</small>
    </button>
  `;
  const groups = Object.entries(companyRoleDockMeta).map(([role, meta]) => {
    const members = sortCompaniesForDisplay(
      companies.filter((company) => company.business_role === role),
    );
    const rows = members.length
      ? members.map((company) => `
          <button class="company-chip ${state.company === company.display_name ? "active" : ""}" type="button" data-filter-company="${escapeHtml(company.id)}">
            <span class="company-chip-main"><i class="company-dot role-${role}"></i><strong>${escapeHtml(compactCompanyName(company))}</strong></span>
            <small>${role === "competitor" && Number.isFinite(getCompetitiveRank(company)) ? `#${formatCompetitiveRank(company)} · ` : ""}${escapeHtml(company.role_label || meta.label)}</small>
          </button>
        `).join("")
      : `<div class="company-dock-empty">${escapeHtml(meta.empty)}</div>`;
    return `
      <details class="company-dock-group" data-dock-role="${escapeHtml(role)}" ${state.dockOpenRoles.has(role) ? "open" : ""}>
        <summary class="company-dock-summary">
          <span>${escapeHtml(meta.label)}</span>
          <b>${members.length}</b>
          <i aria-hidden="true">⌄</i>
        </summary>
        <div class="company-dock-group-list">${rows}</div>
      </details>
    `;
  }).join("");
  els.companyDockList.innerHTML = allButton + groups;
}

function getJapanAccountData() {
  const data = window.AIHOT_JAPAN_ACCOUNTS || window.AIHOT_JAPAN_CUSTOMERS;
  if (data?.accounts) return data;
  if (data) return { ...data, accounts: data.customers || [] };
  return {
    imported_at: "--",
    source: "Global Data-日本客户列表.xlsx",
    semantics: "这是日本市场账户目录，不自动等于已成交客户。",
    privacy_note: "内部销售状态不进入公开页面。",
    import_summary: { source_rows: 0, unique_accounts: 0, duplicate_rows_merged: 0, public_relationships: 0 },
    accounts: [],
  };
}

function normalizeCustomerMatchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[^a-z0-9一-鿿぀-ヿ&+.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCustomerCompanySuffix(value) {
  return normalizeCustomerMatchText(value)
    .replace(/[, .-]+(?:co\.?|company|corporation|inc\.?|incorporated|ltd\.?|limited)(?:[, .-]+(?:co\.?|inc\.?|ltd\.?))*$/i, "")
    .trim();
}

function isStrongCustomerMatchTerm(value) {
  const compact = value.replace(/[^a-z0-9一-鿿぀-ヿ]/g, "");
  const cjkCount = (compact.match(/[一-鿿぀-ヿ]/g) || []).length;
  if (cjkCount >= 3) return true;
  if (compact.length < 5) return false;
  const tokens = value.split(/[^a-z0-9]+/).filter(Boolean);
  const genericTokens = new Set([
    "bio", "biotech", "biotechnology", "cell", "chemical", "diagnostics", "institute",
    "lab", "laboratory", "medical", "pharma", "pharmaceutical", "research", "science",
    "stem", "technology", "therapeutics",
  ]);
  if (tokens.length && tokens.every((token) => genericTokens.has(token))) return false;
  return !new Set(["unknown", "institute", "university", "laboratory", "hospital", "research"]).has(compact);
}

function getAccountMatchTerms(account) {
  const values = [account.name, account.parent_company, ...(account.aliases || [])];
  const terms = new Set();
  for (const value of values) {
    const normalized = normalizeCustomerMatchText(value);
    const simplified = stripCustomerCompanySuffix(value);
    if (isStrongCustomerMatchTerm(normalized)) terms.add(normalized);
    if (simplified !== normalized && isStrongCustomerMatchTerm(simplified)) terms.add(simplified);
  }
  return [...terms];
}

function findAccountForCompany(company, accounts = getJapanAccountData().accounts || []) {
  if (company.account_origin_id) {
    const linked = accounts.find((account) => account.id === company.account_origin_id);
    if (linked) return linked;
  }
  const companyTerms = new Set(
    [company.display_name, ...(company.aliases || [])]
      .flatMap((value) => [normalizeCustomerMatchText(value), stripCustomerCompanySuffix(value)])
      .filter(isStrongCustomerMatchTerm),
  );
  return accounts.find((account) =>
    getAccountMatchTerms(account).some((term) => companyTerms.has(term)),
  ) || null;
}

function getVerifiedPublicRelationshipEvidence(account) {
  return (account?.public_evidence || []).filter(
    (evidence) => Boolean(evidence.source_url && evidence.summary),
  );
}

let japanAccountSignalCache = { payload: null, data: null, index: new Map() };

function getJapanAccountSignalIndex() {
  const data = getJapanAccountData();
  if (japanAccountSignalCache.payload === state.payload && japanAccountSignalCache.data === data) {
    return japanAccountSignalCache.index;
  }
  const items = state.payload?.items || [];
  const itemText = items.map((item) => normalizeCustomerMatchText([
    item.title,
    item.summary,
    item.ai_summary,
    item.company,
    ...(item.matched_companies || []),
  ].filter(Boolean).join(" ")));
  const index = new Map();
  for (const account of data.accounts || []) {
    const terms = getAccountMatchTerms(account);
    const matches = items.filter((item, itemIndex) => terms.some((term) => itemText[itemIndex].includes(term)));
    index.set(account.id, [...matches].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)));
  }
  japanAccountSignalCache = { payload: state.payload, data, index };
  return index;
}

function getJapanAccountMatchedItemIds() {
  const ids = new Set();
  for (const matches of getJapanAccountSignalIndex().values()) {
    for (const item of matches) ids.add(item.id || item.url);
  }
  return ids;
}

function accountStageMarkup(account) {
  const className = account.account_stage === "public_relationship" ? "public-relationship" : "market-account";
  return `<b class="account-stage-badge ${className}">${escapeHtml(account.account_stage_label || "市场账户")}</b>`;
}

function customerDetailField(label, value) {
  if (!value) return "";
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderJapanAccountIntelligence() {
  if (!els.japanCustomerList || !els.japanCustomerDetail) return;
  const data = getJapanAccountData();
  const accounts = data.accounts || [];
  const signalIndex = getJapanAccountSignalIndex();
  const linkedAccounts = accounts.filter((account) => (signalIndex.get(account.id) || []).length);
  const publicRelationshipCount = accounts.filter((account) => account.account_stage === "public_relationship").length;
  const pharmaCount = accounts.filter((account) => account.organization_type === "pharma_biotech").length;

  els.japanCustomerTimestamp.textContent = `更新 ${data.imported_at || "--"} · ${data.import_summary?.source_rows || accounts.length} 条源记录`;
  els.japanCustomerCount.textContent = accounts.length;
  els.japanPublicRelationshipCount.textContent = publicRelationshipCount;
  els.japanIndustryCount.textContent = pharmaCount;
  els.japanLinkedCount.textContent = linkedAccounts.length;

  const stageOptions = [...new Map(accounts.map((account) => [account.account_stage, account.account_stage_label])).entries()];
  const organizationOptions = [...new Map(accounts.map((account) => [account.organization_type, account.organization_label])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "zh-CN"));
  els.japanCustomerTypeFilter.innerHTML = '<option value="all">全部账户状态</option>' + stageOptions
    .map(([value, label]) => `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`).join("");
  els.japanCustomerSapFilter.innerHTML = '<option value="all">全部机构类型</option>' + organizationOptions
    .map(([value, label]) => `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`).join("");
  els.japanCustomerTypeFilter.value = stageOptions.some(([value]) => value === state.accountStage) ? state.accountStage : "all";
  els.japanCustomerSapFilter.value = organizationOptions.some(([value]) => value === state.accountOrganizationType)
    ? state.accountOrganizationType
    : "all";

  const query = state.accountQuery.toLowerCase().trim();
  const matchingAccounts = accounts.filter((account) => {
    const matches = signalIndex.get(account.id) || [];
    const haystack = `${account.name} ${(account.aliases || []).join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query)) &&
      (state.accountStage === "all" || account.account_stage === state.accountStage) &&
      (state.accountOrganizationType === "all" || account.organization_type === state.accountOrganizationType) &&
      (state.accountSignalStatus === "all" ||
        (state.accountSignalStatus === "linked" && matches.length > 0) ||
        (state.accountSignalStatus === "unlinked" && matches.length === 0));
  }).sort((a, b) => {
    const stageDelta = Number(b.account_stage === "public_relationship") - Number(a.account_stage === "public_relationship");
    const signalDelta = (signalIndex.get(b.id) || []).length - (signalIndex.get(a.id) || []).length;
    return stageDelta || signalDelta || a.name.localeCompare(b.name);
  });
  const renderedAccounts = matchingAccounts.slice(0, state.accountLimit);
  els.japanCustomerResultCount.textContent = `匹配 ${matchingAccounts.length} 个 · 当前显示 ${renderedAccounts.length} 个`;
  if (!matchingAccounts.some((account) => account.id === state.selectedAccountId)) {
    state.selectedAccountId = matchingAccounts[0]?.id || null;
  }

  const accountRows = renderedAccounts.map((account) => {
    const matches = signalIndex.get(account.id) || [];
    return `
      <button class="customer-directory-row ${account.id === state.selectedAccountId ? "active" : ""}" type="button" data-japan-account-id="${escapeAttr(account.id)}">
        <span class="customer-name-cell"><strong>${escapeHtml(account.name)}</strong></span>
        <span class="customer-type-tags">${accountStageMarkup(account)}</span>
        <span class="customer-parent-cell">${escapeHtml(account.organization_label || "待分类")}</span>
        <span class="customer-signal-count ${matches.length ? "has-signal" : ""}">${matches.length ? `${matches.length} 条候选` : "暂无"}</span>
      </button>`;
  }).join("");
  const loadMore = renderedAccounts.length < matchingAccounts.length
    ? `<button class="customer-load-more" type="button" data-load-more-accounts>继续显示 ${Math.min(40, matchingAccounts.length - renderedAccounts.length)} 个</button>`
    : "";
  els.japanCustomerList.innerHTML = matchingAccounts.length
    ? accountRows + loadMore
    : '<div class="customer-directory-empty">当前筛选范围内没有账户记录。</div>';

  const selected = accounts.find((account) => account.id === state.selectedAccountId);
  if (!selected) {
    els.japanCustomerDetail.innerHTML = '<div class="customer-directory-empty">请选择一个账户锚点。</div>';
    return;
  }
  const matches = signalIndex.get(selected.id) || [];
  const aliases = (selected.aliases || []).join(" / ");
  const fields = [
    customerDetailField("账户状态", selected.account_stage_label),
    customerDetailField("机构类型", selected.organization_label),
    customerDetailField("总部", selected.headquarters),
    customerDetailField("地区", selected.region),
    customerDetailField("别名", aliases),
  ].filter(Boolean).join("");
  const publicEvidence = selected.public_evidence || [];
  const evidenceMarkup = publicEvidence.length ? `
    <div class="customer-signal-list account-public-evidence"><span>公开关系依据</span>${publicEvidence.map((evidence) => `
      <a href="${escapeAttr(evidence.source_url)}" target="_blank" rel="noreferrer">
        <strong>${escapeHtml(evidence.summary)}</strong>
        <span>${escapeHtml(evidence.source_title)}</span>
      </a>`).join("")}</div>` : "";
  const signalMarkup = matches.length ? matches.slice(0, 5).map((item) => `
    <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(getDisplayTitle(item))}</strong>
      <span>${escapeHtml(getItemDateLabel(item))} · ${escapeHtml(labelBusinessEvent(getBusinessEventType(item), true))}</span>
    </a>`).join("") : '<p>当前抓取结果没有可靠名称命中，继续保留在账户观察池。</p>';
  const isRelationship = selected.account_stage === "public_relationship";
  const opportunityClass = isRelationship ? "relationship" : matches.length ? "candidate" : "quiet";
  const opportunityTitle = isRelationship
    ? "关系账户：判断需求与跟进时机"
    : matches.length
      ? `${matches.length} 条动态：进入潜客判断`
      : "市场账户：等待有效外部动态";
  const opportunityCopy = isRelationship
    ? "公开关系已经存在；后续重点不是重复证明身份，而是结合动态判断需求、时机和下一步沟通。"
    : matches.length
      ? "先核对主体和事件，再判断是否存在 ACRO 产品需求、技术切入点或活动跟进机会。"
      : "名单只负责建立公司锚点；没有外部信号时，不自动生成商业机会。";
  els.japanCustomerDetail.innerHTML = `
    <header><span>账户情报锚点</span><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(data.semantics || "")}</p></header>
    <div class="customer-detail-fields">${fields}</div>
    <div class="customer-opportunity-state ${opportunityClass}">
      <span>建议动作</span>
      <strong>${escapeHtml(opportunityTitle)}</strong>
      <p>${escapeHtml(opportunityCopy)}</p>
    </div>
    ${evidenceMarkup}
    <div class="customer-signal-list"><span>关联外部动态</span>${signalMarkup}</div>
    <footer>${escapeHtml(data.privacy_note || "内部销售状态不进入公开页面。")}</footer>`;
}

const structuredRuleMeta = {
  targets: {
    question: "这条信息在谈什么生物靶点？",
    use: "用于把管线、合作和技术新闻归并到同一靶点趋势。",
  },
  modalities: {
    question: "公司在推进哪种疗法或技术路线？",
    use: "用于识别 ADC、细胞治疗、基因治疗、类器官等技术方向。",
  },
  product_needs: {
    question: "这个动作可能带来什么 ACRO 产品需求？",
    use: "将信息映射到重组蛋白、抗体、细胞因子、GMP 原料和功能分析等机会。",
  },
  development_stages: {
    question: "该项目处在发现、临床前、临床还是上市阶段？",
    use: "阶段决定需求紧迫度，也帮助 BD 选择介入时机。",
  },
  business_actions: {
    question: "公司正在采取什么商业行动？",
    use: "区分合作、授权、融资、并购、产品发布、扩产和市场进入。",
  },
  event_signals: {
    question: "是什么活动，存在哪种参与机会？",
    use: "仅对已确认的活动内容提取，用于评估报名、参展、登台、赞助和 Partnering。",
  },
};

function renderStructuredRules() {
  if (!els.structuredRuleGrid) return;
  const rules = window.AIHOT_INTELLIGENCE_RULES || { version: "--", groups: {} };
  const groups = Object.entries(rules.groups || {});
  const termCount = groups.reduce((sum, [, group]) => sum + (group.items || []).length, 0);
  const hitCount = (state.payload?.items || []).filter((item) =>
    Object.values(item.intelligence || {}).some((values) => values.length),
  ).length;
  els.structuredRuleVersion.textContent = `规则版本 v${rules.version || "--"}`;
  els.structuredGroupCount.textContent = groups.length;
  els.structuredTermCount.textContent = termCount;
  els.structuredHitCount.textContent = hitCount;
  els.structuredRuleGrid.innerHTML = groups.map(([groupId, group], index) => {
    const meta = structuredRuleMeta[groupId] || {};
    const rows = (group.items || []).map((item) => `
      <li>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml((item.aliases || []).join(" / "))}</span>
      </li>
    `).join("");
    return `
      <article class="structured-rule-group">
        <header>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div><h3>${escapeHtml(group.label)}</h3><p>${escapeHtml(meta.question || "")}</p></div>
          <b>${(group.items || []).length} 个标准标签</b>
        </header>
        <p class="structured-rule-use">${escapeHtml(meta.use || "")}</p>
        <ul>${rows}</ul>
      </article>
    `;
  }).join("");
}

function renderMethodologyView() {
  const meta = methodologyDetailMeta[state.methodologyDetail];
  const isDetailView = Boolean(meta);
  els.methodologyIndexBlocks.forEach((block) => {
    block.hidden = isDetailView;
  });
  els.methodologyDetailBar.hidden = !isDetailView;
  els.methodologyDetailList.hidden = !isDetailView;
  els.methodologyDetails.forEach((detail) => {
    const isCurrent = isDetailView && detail.dataset.methodologyDetail === state.methodologyDetail;
    detail.hidden = !isCurrent;
    if (isCurrent) {
      detail.setAttribute("aria-current", "page");
    } else {
      detail.removeAttribute("aria-current");
    }
  });
  if (meta) {
    els.methodologyBreadcrumbFamily.textContent = meta.family;
    els.methodologyBreadcrumbTitle.textContent = meta.title;
  }
}

function formatStorageBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMethodology() {
  renderMethodologyView();
  if (!els.methodologyScopedCount || !state.payload) return;
  const catalog = window.AIHOT_RULE_CATALOG || {};
  const storageProfile = window.AIHOT_STORAGE_PROFILE || {};
  const summaryPipeline = state.payload.summary_pipeline || {};
  if (els.methodologyVersion) {
    els.methodologyVersion.textContent = `Rules v${catalog.version || "--"}`;
  }
  if (els.ruleCatalogCardVersion) {
    els.ruleCatalogCardVersion.textContent = `v${catalog.version || "--"}`;
  }
  if (els.methodologyVerifiedAt) {
    els.methodologyVerifiedAt.textContent = catalog.verified_at
      ? `代码与口径核验于 ${catalog.verified_at}`
      : "等待规则契约校验";
  }
  if (els.summaryStrategyStatus) {
    const manualCount = Number(summaryPipeline.manual_imported) || 0;
    els.summaryStrategyStatus.textContent = manualCount
      ? `规则自动处理 + ${manualCount} 条 AI 情报精读`
      : "规则自动处理；重点信息按需进行 AI 情报精读";
  }
  if (els.summaryPipelineDetail) {
    const status = summaryPipeline.status || "rules_only";
    const statusLabel = {
      rules_only: "仅规则提要",
      rules_plus_manual: "规则提要 + AI 情报精读",
      policy_disabled: "自动 LLM API 按策略关闭",
      configuration_error: "模型配置异常",
      request_error: "模型请求异常",
      limit_reached: "模型摘要达到本轮上限",
      complete: "模型摘要完成",
    }[status] || status;
    const manualCount = Number(summaryPipeline.manual_imported) || 0;
    els.summaryPipelineDetail.textContent =
      `本轮状态：${statusLabel}；人工回填 ${manualCount} 条；自动 LLM API：${catalog.strategy?.automatic_llm_api ? "已启用" : "未启用"}。`;
  }
  if (els.storageLatestSnapshot) {
    els.storageLatestSnapshot.textContent = `${storageProfile.latest_item_count || 0} 条 · ${formatStorageBytes(storageProfile.latest_snapshot_bytes)}`;
  }
  if (els.storageHistorySize) {
    els.storageHistorySize.textContent = `${storageProfile.history_file_count || 0} 份 · ${formatStorageBytes(storageProfile.history_total_bytes)}`;
  }
  if (els.storageDedupeCount) {
    els.storageDedupeCount.textContent = `${storageProfile.deduplication_url_count || 0} 个 URL · ${formatStorageBytes(storageProfile.deduplication_index_bytes)}`;
  }
  if (els.storageSourceState) {
    els.storageSourceState.textContent = formatStorageBytes(storageProfile.source_snapshot_bytes);
  }
  if (els.storagePipelineSnapshot) {
    els.storagePipelineSnapshot.textContent = `${storageProfile.latest_item_count || 0} 条 / ${formatStorageBytes(storageProfile.latest_snapshot_bytes)}`;
  }
  if (els.storagePipelineHistory) {
    els.storagePipelineHistory.textContent = `${storageProfile.history_file_count || 0} 份历史 / ${formatStorageBytes(storageProfile.history_total_bytes)}`;
  }
  const allItems = state.payload.items || [];
  const scopedItems = getFilteredItems();
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  const trendItems = scopedItems.filter((item) => {
    const age = getTrendAge(item);
    return age !== null && age < state.timeRange;
  });
  const selfCount = trendItems.filter((item) => getItemRole(item, companyRoles) === "self").length;
  els.methodologyTrendCount.textContent = "本公司 " + selfCount;
  if (els.methodologyTrendExample) {
    els.methodologyTrendExample.textContent = `例如“本公司 ${selfCount}”表示：在当前筛选和观察周期内，有 ${selfCount} 条可定位到走势日期且被识别为“本公司”的信息。`;
  }
  els.methodologyScopedCount.textContent = scopedItems.length + " 条";

  const healthRows = (state.payload.source_health || []).filter((row) => row.enabled !== false);
  const reachableRows = healthRows.filter((row) =>
    row.operational_status === "reachable" || ["productive", "archive_only", "quiet"].includes(row.status),
  );
  els.methodologyHealthySources.textContent = healthRows.length
    ? reachableRows.length + "/" + healthRows.length
    : "未接入";

  const topNews = [...allItems].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0),
  )[0];
  if (topNews) {
    const reasons = (topNews.reasons || []).slice(0, 4);
    els.methodologyNewsExample.innerHTML =
      "<span>当前数据示例 · " + (Number(topNews.score) || 0) + " 分</span>" +
      "<p><strong>" + escapeHtml(firstReadableSentence(getDisplayTitle(topNews), 96)) + "</strong></p>" +
      "<div>" + (reasons.length
        ? reasons.map((reason) => "<i>" + escapeHtml(reason) + "</i>").join("")
        : "<i>该记录未保留逐项加分原因。</i>") + "</div>";
  } else {
    els.methodologyNewsExample.innerHTML = "<span>当前数据示例</span><p>当前数据集暂无可用新闻。</p>";
  }

  const topRelevance = [...allItems].sort(
    (a, b) => (Number(b.acro_relevance?.score) || 0) - (Number(a.acro_relevance?.score) || 0),
  )[0];
  if (topRelevance) {
    const relevance = topRelevance.acro_relevance || {};
    els.methodologyRelevanceExample.innerHTML =
      "<span>当前数据示例 · " + (Number(relevance.score) || 0) + " 分 · " +
        escapeHtml(relevance.label || "待分析") + "</span>" +
      "<p><strong>" + escapeHtml(firstReadableSentence(getDisplayTitle(topRelevance), 96)) + "</strong></p>" +
      "<div>" + (relevance.reasons || []).map(
        (reason) => "<i>" + escapeHtml(reason) + "</i>",
      ).join("") + "</div>";
  } else {
    els.methodologyRelevanceExample.innerHTML = "<span>当前数据示例</span><p>当前数据集暂无相关性结果。</p>";
  }

  const priorities = buildCustomerAccountPriorities();
  const priorityExample = priorities.find((entry) => entry.items.length);
  if (priorityExample) {
    els.methodologyPriorityExample.innerHTML =
      "<span>当前数据示例 · " + escapeHtml(shortCompanyName(priorityExample.company.display_name)) + "</span>" +
      "<p><strong>优先指数 " + priorityExample.priorityScore + "</strong>：" +
        priorityExample.selectedItems.length + " 条进入日报，" +
        priorityExample.highCount + " 条高相关，密度 " + priorityExample.density + "%，" +
        priorityExample.sourceCount + " 个去重来源。</p>";
  } else {
    els.methodologyPriorityExample.innerHTML = "<span>当前数据示例</span><p>持续监测账户当前还没有可计算的公开信号。</p>";
  }

  const densityExample = [...priorities]
    .filter((entry) => entry.items.length)
    .sort((a, b) => b.density - a.density || b.items.length - a.items.length)[0];
  if (densityExample) {
    els.methodologyDensityExample.innerHTML =
      "<span>当前数据示例 · " + escapeHtml(shortCompanyName(densityExample.company.display_name)) + "</span>" +
      "<p><strong>(" + densityExample.highCount + " 高 + " + densityExample.mediumCount +
        " 中 × 0.55) ÷ " + densityExample.items.length + " 条 = " + densityExample.density + "%</strong></p>";
  } else {
    els.methodologyDensityExample.innerHTML = "<span>当前数据示例</span><p>持续监测账户当前还没有可计算的公开信号。</p>";
  }
}

function renderCompanyPools() {
  const companies = state.payload?.companies || [];
  if (!els.companyPoolGroups || !els.companyRoleSummary) return;

  const relationshipData = getRelationshipData();
  const relationshipRecords = relationshipData.records || [];
  const accountData = getJapanAccountData();
  const accounts = accountData.accounts || [];
  const publicRelationshipCount = accounts.filter(
    (account) => getVerifiedPublicRelationshipEvidence(account).length > 0,
  ).length;
  const monitoredCustomerCompanies = sortCompaniesForDisplay(
    companies.filter((company) => company.business_role === "customer"),
  );
  const monitoredPublicRelationshipCount = monitoredCustomerCompanies.filter((company) => {
    const account = findAccountForCompany(company, accounts);
    return getVerifiedPublicRelationshipEvidence(account).length > 0;
  }).length;
  const monitoredMarketAccountCount = Math.max(
    0,
    monitoredCustomerCompanies.length - monitoredPublicRelationshipCount,
  );
  const selfCount = companies.filter((company) => company.business_role === "self").length;
  const competitorCount = companies.filter((company) => company.business_role === "competitor").length;
  const monitoringScope = document.querySelector("#decisionMonitoringScope");
  if (monitoringScope) {
    monitoringScope.textContent = `${selfCount} 家本公司 + ${competitorCount} 家竞品 + ${accounts.length} 家日本账户目录（${monitoredCustomerCompanies.length} 家已持续监测）；合作伙伴和生态平台分层管理。`;
  }
  const asRelationshipMember = (record) => ({
    id: record.id,
    display_name: record.organization,
    role_label: record.relationship_label,
    role_reason: record.classification_note,
    monitoring_focus: record.summary,
    entity_kind: "relationship",
    relationship_id: record.id,
  });
  const asSegmentMember = (segment, index) => ({
    id: `customer-segment-${index}`,
    display_name: segment.label,
    role_label: segment.status === "listed_pool" ? "客户名单 / 关系待补" : "客户群 / 具体名单待发现",
    role_reason: segment.note,
    monitoring_focus: segment.status === "listed_pool"
      ? "以公司名称为锚点匹配官网、新闻和人工证据，不自动推断采购或合作。"
      : "从官方案例、合作公告、产品引用和会议演讲中逐条确认。",
    entity_kind: "segment",
    customer_pool: segment.status === "listed_pool",
  });

  const roleDefinitions = [
    {
      id: "self",
      title: "本公司",
      description: "作为系统标本验证全链路，单独统计，不占用竞品或客户名额。",
      empty: "尚未设置本公司。",
      members: companies.filter((company) => company.business_role === "self"),
    },
    {
      id: "competitor",
      title: "竞品池",
      description: "核心竞品依照已确认的业务相关性排序；其余公司保留在扩展观察池。",
      empty: "尚未确认竞品公司。",
      members: sortCompaniesForDisplay(
        companies.filter((company) => company.business_role === "competitor"),
      ),
    },
    {
      id: "customer",
      title: "客户与潜在账户",
      description: `与竞品分开管理：${accounts.length} 家账户用于市场发现，${monitoredCustomerCompanies.length} 家已接入持续监测（${monitoredPublicRelationshipCount} 家公开关系，${monitoredMarketAccountCount} 家关系待确认）。这里关注需求、跟进时机和潜客资格。`,
      empty: "尚未接入客户与潜在账户目录。",
      count: accounts.length,
      countLabel: `${accounts.length} 家目录 · ${monitoredCustomerCompanies.length} 家监测`,
      members: [
        ...monitoredCustomerCompanies,
        ...(accounts.length ? [{
          id: "japan-account-directory",
          display_name: `日本账户总目录 · ${accounts.length} 家`,
          role_label: `${publicRelationshipCount} 家公开关系 · ${accounts.length - publicRelationshipCount} 家市场账户`,
          role_reason: "销售名单已建立公司锚点；内部关系状态保留在公司内部，不发布到公开站点。",
          monitoring_focus: "关系账户关注需求与跟进时机，市场账户关注外部动态与潜客资格。",
          customer_pool: true,
        }] : []),
      ],
    },
    {
      id: "partner",
      title: "已确认合作伙伴",
      description: "双方具名公告、MOU 或明确项目构成合作证据，但不自动等同于客户。",
      empty: "尚无已确认合作伙伴。",
      members: relationshipRecords.filter((record) => record.evidence_level === "confirmed").map(asRelationshipMember),
    },
    {
      id: "disclosed",
      title: "官网披露关系",
      description: "公司官网披露存在合作，但缺少具体项目、时间或采购证据。",
      empty: "尚无官网披露但待核对的关系。",
      members: relationshipRecords.filter((record) => record.evidence_level === "disclosed").map(asRelationshipMember),
    },
    {
      id: "customer-segment",
      title: "客户发现方向",
      description: "已知 ACRO 服务哪些类型客群，但具体公司需要逐条发现和确认。",
      empty: "尚未建立客户发现方向。",
      members: getRelationshipSegments(relationshipData)
        .filter((segment) => segment.status !== "listed_pool")
        .map(asSegmentMember),
    },
  ];

  const counts = Object.fromEntries(roleDefinitions.map((role) => [role.id, role.count ?? role.members.length]));

  els.companyPoolTimestamp.textContent = `${companies.length} 家监测公司 · ${relationshipRecords.length} 条关系证据`;
  els.companyRoleSummary.innerHTML = `
    <article><span>本公司</span><strong>${counts.self}</strong><small>系统标本</small></article>
    <article><span>竞品池</span><strong>${counts.competitor}</strong><small>行业对标</small></article>
    <article><span>客户与潜在账户</span><strong>${counts.customer}</strong><small>跟进与机会判断</small></article>
    <article><span>合作伙伴</span><strong>${counts.partner}</strong><small>具名公告 / MOU</small></article>
    <article class="needs-review"><span>披露待核对</span><strong>${counts.disclosed}</strong><small>不直接当客户</small></article>
    <article><span>客户发现方向</span><strong>${counts["customer-segment"]}</strong><small>逐条补公司名单</small></article>
  `;

  els.companyPoolGroups.innerHTML = roleDefinitions
    .map((role) => {
      const members = role.members;
      const rows = members.length
        ? members.map((company) => `
            <article class="company-profile-row">
              <div class="company-profile-title">
                <strong>${Number.isFinite(getCompetitiveRank(company)) ? `<i class="competitor-rank-badge">${formatCompetitiveRank(company)}</i>` : ""}${escapeHtml(company.display_name)}</strong>
                <span>${escapeHtml(company.role_label || role.title)}</span>
              </div>
              <div>
                <small>判断依据</small>
                <p>${escapeHtml(company.role_reason || "已由公司档案确定业务角色。")}</p>
              </div>
              <div>
                <small>监测重点</small>
                <p>${escapeHtml(company.monitoring_focus || (company.strategic_topics || []).slice(0, 5).join("、"))}</p>
              </div>
              ${company.entity_kind === "relationship"
                ? `<button class="company-profile-source-button" type="button" data-relationship-card-id="${escapeAttr(company.relationship_id)}">查看关系证据</button>`
                : company.customer_pool
                  ? '<button class="company-profile-source-button" type="button" data-open-japan-customers>查看账户情报</button>'
                : company.entity_kind === "segment"
                  ? '<span class="company-profile-state">名单发现中</span>'
                  : `<button class="company-profile-source-button" type="button" data-company-coverage-id="${escapeHtml(company.id)}">查看数据源</button>`}
            </article>
          `).join("")
        : `<div class="company-pool-empty"><strong>0 家</strong><p>${escapeHtml(role.empty)}</p></div>`;

      return `
        <section class="company-pool-block role-${role.id}">
          <header>
            <div><span>${escapeHtml(role.title)}</span><strong>${escapeHtml(role.countLabel || `${role.count ?? members.length} 家`)}</strong></div>
            <p>${escapeHtml(role.description)}</p>
          </header>
          <div class="company-profile-list">${rows}</div>
        </section>
      `;
    })
    .join("");
}

function getRelationshipData() {
  return window.AIHOT_COMPANY_RELATIONSHIPS || {
    updated_at: "--",
    records: [],
    customer_segments: [],
  };
}

function getRelationshipSegments(data = getRelationshipData()) {
  const segments = [...(data.customer_segments || [])];
  const accountData = getJapanAccountData();
  const count = accountData.accounts?.length || 0;
  if (count) {
    segments.unshift({
      label: `日本账户情报 · ${count} 家`,
      status: "listed_pool",
      count,
      note: "已作为公司锚点导入；公开关系与市场账户分开显示，内部销售状态不进入公开页面。",
    });
  }
  return segments;
}

const relationshipEvidenceMeta = {
  confirmed: { label: "已确认", className: "confirmed" },
  disclosed: { label: "已披露待核对", className: "disclosed" },
  candidate: { label: "候选线索", className: "candidate" },
};

function normalizeEntityText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿぀-ヿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRelationshipEntity(value) {
  return String(value || "")
    .replace(/^[\s:|、,-]+|[\s:|、,-]+$/g, "")
    .replace(/\b(?:announces?|launches?|signs?|enters?|extends?|forms?|establishes?)\b.*$/i, "")
    .replace(/\b(?:strengthens?|partners?|collaborates?|teams? up)\b.*$/i, "")
    .trim()
    .slice(0, 72);
}

function isPlausibleRelationshipEntity(value) {
  const normalized = normalizeEntityText(value);
  if (normalized.length < 2) return false;
  const blocked = new Set([
    "strategic", "partnership", "partnerships", "collaboration", "collaborations",
    "agreement", "agreements", "research", "technology", "technologies", "company",
  ]);
  return !blocked.has(normalized);
}

function extractRelationshipCounterparty(item, sourceOrganization) {
  const title = String(item.title || "").replace(/\s+-\s+[^-]{2,45}$/, "").trim();
  if (/^(?:how|why|what|when)\b/i.test(title)) return "";
  const source = normalizeEntityText(sourceOrganization);
  const chooseOtherSide = (left, right) => {
    const cleanLeft = cleanRelationshipEntity(left);
    const cleanRight = cleanRelationshipEntity(right);
    const leftNorm = normalizeEntityText(cleanLeft);
    const rightNorm = normalizeEntityText(cleanRight);
    if (leftNorm && (source.includes(leftNorm) || leftNorm.includes(source))) return cleanRight;
    if (rightNorm && (source.includes(rightNorm) || rightNorm.includes(source))) return cleanLeft;
    return cleanLeft || cleanRight;
  };

  const andMatch = title.match(/^(.{2,80}?)\s+(?:and|&)\s+(.{2,80}?)\s+(?:partner|collaborat|sign|team|expand)/i);
  if (andMatch) return chooseOtherSide(andMatch[1], andMatch[2]);

  const actionWithMatch = title.match(/^(.{2,80}?)\s+(?:launches|announces|enters|signs|extends|forms|establishes)[^.!?]{0,55}?\s+with\s+(.{2,80}?)(?:\s+to\b|\s+for\b|,|$)/i);
  if (actionWithMatch) return chooseOtherSide(actionWithMatch[1], actionWithMatch[2]);

  const generalWithMatch = title.match(/^(.{2,80}?)\s+(?:partners?|collaborates?|teams? up|signs?)[^.!?]{0,35}?\s+with\s+(.{2,80}?)(?:\s+to\b|\s+for\b|,|$)/i);
  if (generalWithMatch) return chooseOtherSide(generalWithMatch[1], generalWithMatch[2]);

  const japaneseMatch = title.match(/^(.{2,60}?)と(.{2,60}?)[、,]/);
  if (japaneseMatch) return chooseOtherSide(japaneseMatch[1], japaneseMatch[2]);
  return "";
}

function getDynamicRelationshipCandidates() {
  const companiesById = new Map((state.payload?.companies || []).map((company) => [company.id, company]));
  const candidates = [];
  for (const item of state.payload?.items || []) {
    const actions = item.intelligence?.business_actions || [];
    const isRelationship = item.category === "partnership" || actions.some((action) =>
      ["合作 / 共同开发", "授权 / 引进", "并购 / 交易"].includes(action),
    );
    if (!isRelationship || !["daily", "immediate"].includes(item.tier) || !itemIsWithinRange(item, 90)) continue;
    const sourceCompany = companiesById.get(item.matched_company_ids?.[0]);
    if (!sourceCompany) continue;
    const sourceOrganization = sourceCompany?.display_name || item.matched_companies?.[0] || item.company || "";
    const normalizedTitle = normalizeEntityText(item.title);
    const sourceAliases = [sourceCompany.display_name, ...(sourceCompany.aliases || [])]
      .map(normalizeEntityText)
      .filter((alias) => alias.length >= 4);
    if (!sourceAliases.some((alias) => normalizedTitle.includes(alias) || alias.includes(normalizedTitle))) continue;
    const counterparty = extractRelationshipCounterparty(item, sourceOrganization);
    if (!sourceOrganization || !counterparty || !isPlausibleRelationshipEntity(counterparty)) continue;
    if (normalizeEntityText(sourceOrganization).includes(normalizeEntityText(counterparty))) continue;
    const sourceTrust = String(item.source_trust || "").toLowerCase();
    const confidence = sourceTrust.includes("official") ? 82 : sourceTrust.includes("wire") ? 72 : 62;
    candidates.push({
      id: `dynamic-${item.id}`,
      source_organization: sourceOrganization,
      source_company_id: sourceCompany?.id || "",
      organization: counterparty,
      relationship_type: "dynamic_candidate",
      relationship_label: actions[0] || "动态合作候选",
      evidence_level: "candidate",
      evidence_label: "新闻规则识别",
      confidence_score: confidence,
      status: "candidate",
      status_label: "待人工确认",
      source_date: item.published || null,
      topics: [...new Set([
        ...(item.intelligence?.modalities || []),
        ...(item.intelligence?.targets || []),
        ...(item.intelligence?.product_needs || []),
      ])].slice(0, 4),
      summary: `系统从新闻中识别到 ${shortCompanyName(sourceOrganization)} 与 ${counterparty} 可能存在关系事件。`,
      classification_note: "这是自动识别候选，只有核对双方官方公告或明确项目后，才能升级为已确认关系。",
      source_title: item.title,
      source_url: item.url,
      source_item: item,
    });
  }

  const deduped = new Map();
  for (const candidate of candidates.sort((a, b) => (b.source_item?.score || 0) - (a.source_item?.score || 0))) {
    const key = `${normalizeEntityText(candidate.source_organization)}|${normalizeEntityText(candidate.organization)}`;
    if (!deduped.has(key)) deduped.set(key, candidate);
  }
  return [...deduped.values()].slice(0, 8);
}

function graphNodeId(prefix, value) {
  return `${prefix}-${normalizeEntityText(value).replace(/\s+/g, "-").slice(0, 48)}`;
}

function splitGraphLabel(value, maxLength = 15) {
  const text = String(value || "");
  if (text.length <= maxLength) return [text];
  const words = text.split(/\s+/);
  if (words.length === 1) return [text.slice(0, maxLength), text.slice(maxLength, maxLength * 2)];
  const lines = [""];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (!current || `${current} ${word}`.length <= maxLength) {
      lines[lines.length - 1] = current ? `${current} ${word}` : word;
    } else if (lines.length < 2) {
      lines.push(word);
    }
  }
  return lines.slice(0, 2);
}

function buildRelationshipGraphModel(records, dynamicCandidates, segments) {
  const nodes = new Map();
  const edges = [];
  const addNode = (node) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    return nodes.get(node.id);
  };
  const addEdge = (from, to, type, label = "") => {
    if (!edges.some((edge) => edge.from === from && edge.to === to && edge.type === type)) {
      edges.push({ id: `${from}|${to}|${type}`, from, to, type, label });
    }
  };

  addNode({ id: "acro", label: "ACRO", category: "hub", description: "企业关系与客户线索中心" });
  for (const record of records) {
    const nodeId = `record-${record.id}`;
    addNode({
      id: nodeId,
      label: record.organization,
      category: "organization",
      evidence: record.evidence_level,
      description: record.summary,
      record,
    });
    addEdge("acro", nodeId, record.evidence_level, record.relationship_label);
    for (const topic of record.topics || []) {
      const topicId = graphNodeId("topic", topic);
      addNode({ id: topicId, label: topic, category: "topic", description: "关联技术与产品主题" });
      addEdge(nodeId, topicId, "topic", topic);
    }
  }

  for (const candidate of dynamicCandidates) {
    const sourceId = candidate.source_company_id === "acro"
      ? "acro"
      : graphNodeId("company", candidate.source_organization);
    if (sourceId !== "acro") {
      addNode({
        id: sourceId,
        label: shortCompanyName(candidate.source_organization),
        category: "competitor",
        description: "监测公司，其合作动作已进入关系候选。",
      });
      addEdge("acro", sourceId, "competitor_context", "竞品监测");
    }
    const candidateId = `candidate-${candidate.id}`;
    addNode({
      id: candidateId,
      label: candidate.organization,
      category: "candidate",
      evidence: "candidate",
      description: candidate.summary,
      record: candidate,
    });
    addEdge(sourceId, candidateId, "candidate", candidate.relationship_label);
    for (const topic of candidate.topics || []) {
      const topicId = graphNodeId("topic", topic);
      addNode({ id: topicId, label: topic, category: "topic", description: "关联技术与产品主题" });
      addEdge(candidateId, topicId, "topic", topic);
    }
  }

  segments.forEach((segment, index) => {
    const segmentId = `segment-${index}`;
    addNode({ id: segmentId, label: segment.label, category: "segment", description: segment.note });
    addEdge("acro", segmentId, "segment", segment.status === "listed_pool" ? "客户名单锚点" : "客户发现方向");
  });
  return { nodes: [...nodes.values()], edges };
}

function renderRelationshipGraph(records, dynamicCandidates, segments) {
  if (!els.relationshipGraph || !els.relationshipFocusPanel) return;
  const model = buildRelationshipGraphModel(records, dynamicCandidates, segments);
  const layer = state.relationshipGraphLayer;
  const isVisible = (node) => {
    if (layer === "organization") return ["hub", "organization", "competitor", "candidate"].includes(node.category);
    if (layer === "technology") return node.category !== "segment";
    if (layer === "customer") return ["hub", "segment"].includes(node.category);
    return true;
  };
  const visibleNodes = model.nodes.filter(isVisible);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = model.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  if (!visibleIds.has(state.relationshipGraphFocus)) state.relationshipGraphFocus = "acro";

  const center = { x: 500, y: 292 };
  const organizationNodes = visibleNodes.filter((node) => ["organization", "competitor", "candidate"].includes(node.category));
  const topicNodes = visibleNodes.filter((node) => node.category === "topic");
  const segmentNodes = visibleNodes.filter((node) => node.category === "segment");
  const positions = new Map([["acro", center]]);
  organizationNodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(organizationNodes.length, 1);
    positions.set(node.id, { x: center.x + Math.cos(angle) * 188, y: center.y + Math.sin(angle) * 178 });
  });
  topicNodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(topicNodes.length, 1) + 0.18;
    positions.set(node.id, { x: center.x + Math.cos(angle) * 292, y: center.y + Math.sin(angle) * 255 });
  });
  segmentNodes.forEach((node, index) => {
    const spacing = 720 / Math.max(segmentNodes.length, 1);
    positions.set(node.id, { x: 140 + spacing * (index + 0.5), y: 598 });
  });

  const focusId = state.relationshipGraphFocus;
  const connected = new Set([focusId]);
  for (const edge of visibleEdges) {
    if (edge.from === focusId) connected.add(edge.to);
    if (edge.to === focusId) connected.add(edge.from);
  }
  const isFocused = focusId !== "acro";
  const edgeMarkup = visibleEdges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return "";
    const active = !isFocused || edge.from === focusId || edge.to === focusId;
    return `<line class="graph-edge edge-${escapeAttr(edge.type)} ${active ? "is-active" : "is-muted"}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"><title>${escapeHtml(edge.label || edge.type)}</title></line>`;
  }).join("");
  const nodeMarkup = visibleNodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return "";
    const lines = splitGraphLabel(node.label, node.category === "hub" ? 12 : 16);
    const radius = node.category === "hub" ? 54 : node.category === "topic" ? 25 : node.category === "segment" ? 32 : 34;
    const active = !isFocused || connected.has(node.id);
    const textStart = lines.length === 1 ? 4 : -4;
    return `
      <g class="graph-node node-${escapeAttr(node.category)} evidence-${escapeAttr(node.evidence || "none")} ${node.id === focusId ? "is-selected" : ""} ${active ? "is-active" : "is-muted"}" data-graph-node-id="${escapeAttr(node.id)}" role="button" tabindex="0" transform="translate(${position.x} ${position.y})">
        <circle r="${radius}"></circle>
        <text text-anchor="middle" y="${textStart}">${lines.map((line, lineIndex) => `<tspan x="0" dy="${lineIndex ? 13 : 0}">${escapeHtml(line)}</tspan>`).join("")}</text>
        <title>${escapeHtml(node.label)}：${escapeHtml(node.description || "")}</title>
      </g>
    `;
  }).join("");
  els.relationshipGraph.innerHTML = `<g class="graph-edges">${edgeMarkup}</g><g class="graph-nodes">${nodeMarkup}</g>`;
  renderRelationshipFocusPanel(model, focusId);
}

function renderRelationshipFocusPanel(model, focusId) {
  const node = model.nodes.find((entry) => entry.id === focusId) || model.nodes[0];
  const linkedNodes = model.edges
    .filter((edge) => edge.from === node.id || edge.to === node.id)
    .map((edge) => model.nodes.find((entry) => entry.id === (edge.from === node.id ? edge.to : edge.from)))
    .filter(Boolean);
  if (node.category === "hub") {
    const organizationCount = model.nodes.filter((entry) => ["organization", "competitor", "candidate"].includes(entry.category)).length;
    const topicCount = model.nodes.filter((entry) => entry.category === "topic").length;
    els.relationshipFocusPanel.innerHTML = `
      <span>当前中心</span><h3>ACRO 关系网络</h3>
      <p>这张图不是“公司名单”，而是公司、技术主题和客户方向之间的可回溯关系。</p>
      <div class="focus-metrics"><b>${organizationCount}<small>公司节点</small></b><b>${topicCount}<small>技术节点</small></b><b>${linkedNodes.length}<small>直接连接</small></b></div>
      <ul><li>实线：官方或具名证据</li><li>点线：新闻识别候选</li><li>客户节点：只表示发现方向</li></ul>
    `;
    return;
  }
  const record = node.record;
  const evidence = record ? relationshipEvidenceMeta[record.evidence_level] || relationshipEvidenceMeta.candidate : null;
  els.relationshipFocusPanel.innerHTML = `
    <span>${escapeHtml(node.category === "topic" ? "技术主题" : node.category === "segment" ? "客户发现方向" : evidence?.label || "监测公司")}</span>
    <h3>${escapeHtml(node.label)}</h3>
    <p>${escapeHtml(node.description || "暂无详细说明。")}</p>
    <div class="focus-linked"><strong>直接关联 ${linkedNodes.length}</strong>${linkedNodes.slice(0, 6).map((entry) => `<b>${escapeHtml(entry.label)}</b>`).join("")}</div>
    ${record ? `<div class="focus-evidence"><small>${escapeHtml(record.status_label || "待确认")}${record.confidence_score ? ` · 置信 ${record.confidence_score}%` : ""}</small><a href="${escapeAttr(record.source_url)}" target="_blank" rel="noreferrer">查看证据</a></div>` : ""}
  `;
}

function renderCompanyRelationships() {
  if (!els.relationshipList) return;
  const data = getRelationshipData();
  const records = data.records || [];
  const segments = getRelationshipSegments(data);
  const japanAccounts = getJapanAccountData().accounts || [];
  const japanCustomerCount = japanAccounts.length;
  const publicRelationshipCount = japanAccounts.filter((account) => account.account_stage === "public_relationship").length;
  const dynamicCandidates = getDynamicRelationshipCandidates();
  const allRecords = [...records, ...dynamicCandidates];
  const confirmed = records.filter((record) => record.evidence_level === "confirmed");
  const disclosed = records.filter((record) => record.evidence_level === "disclosed");
  const visible = allRecords.filter(
    (record) =>
      (state.relationshipType === "all" || record.relationship_type === state.relationshipType) &&
      (state.relationshipEvidence === "all" || record.evidence_level === state.relationshipEvidence),
  );

  els.relationshipUpdatedAt.textContent = `证据库更新：${data.updated_at || "--"}`;
  els.relationshipConfirmedCount.textContent = confirmed.length;
  els.relationshipDisclosedCount.textContent = disclosed.length;
  els.relationshipCandidateCount.textContent = dynamicCandidates.length;
  els.relationshipCustomerCount.textContent = publicRelationshipCount;
  els.relationshipJapanCustomerCount.textContent = japanCustomerCount;
  els.relationshipSegmentCount.textContent = segments.length;
  els.relationshipResultCount.textContent = `显示 ${visible.length} / ${allRecords.length} 条`;
  renderRelationshipGraph(records, dynamicCandidates, segments);

  els.relationshipList.innerHTML = visible.length ? visible.map((record) => {
    const evidence = relationshipEvidenceMeta[record.evidence_level] || relationshipEvidenceMeta.candidate;
    const topics = (record.topics || []).map((topic) => `<b>${escapeHtml(topic)}</b>`).join("");
    const sourceOrganization = record.source_organization || "ACRO";
    return `
      <article class="relationship-card" id="relationship-card-${escapeAttr(record.id)}">
        <header>
          <div><span>${escapeHtml(shortCompanyName(sourceOrganization))} ↔</span><strong>${escapeHtml(record.organization)}</strong></div>
          <div class="relationship-badges">
            <b class="relationship-type">${escapeHtml(record.relationship_label)}</b>
            <b class="evidence-badge ${evidence.className}">${escapeHtml(evidence.label)}</b>
            ${record.confidence_score ? `<b class="confidence-badge">置信 ${record.confidence_score}%</b>` : ""}
          </div>
        </header>
        <p class="relationship-summary">${escapeHtml(record.summary)}</p>
        <div class="relationship-topics">${topics}</div>
        <div class="relationship-proof">
          <div><span>分类说明</span><p>${escapeHtml(record.classification_note)}</p></div>
          <div><span>公开状态</span><p>${escapeHtml(record.status_label || "待核对")}${record.source_date ? ` · ${escapeHtml(record.source_date)}` : ""}</p></div>
          <a href="${escapeAttr(record.source_url)}" target="_blank" rel="noreferrer">${record.evidence_level === "candidate" ? "查看新闻证据" : "查看官方证据"}</a>
        </div>
      </article>
    `;
  }).join("") : '<div class="empty">当前筛选条件下没有关系证据。</div>';

  els.customerSegmentList.innerHTML = segments.map((segment) => `
    <article>
      <strong>${escapeHtml(segment.label)}</strong>
      <p>${escapeHtml(segment.note)}</p>
      <span>${segment.status === "listed_pool" ? "名单已导入 · 关系与机会待识别" : "客户群已确认 · 具体公司待发现"}</span>
    </article>
  `).join("");
}

const coverageStatusMeta = {
  active: { label: "入口已配置", className: "active" },
  covered: { label: "入口已配置", className: "covered" },
  pending: { label: "入口待验证", className: "pending" },
  planned: { label: "尚未配置", className: "planned" },
  manual: { label: "仅人工记录", className: "manual" },
};

const coverageModeLabels = {
  dedicated: "公司专属",
  shared: "共享来源",
  mixed: "专属 + 共享",
  none: "尚未配置",
};

function getCompanyCoverageProfile(companyId) {
  return (state.payload?.company_source_coverage?.profiles || [])
    .find((profile) => profile.company_id === companyId);
}

function getCoverageSourceIds(profile) {
  return [...new Set(
    Object.values(profile?.slots || {}).flatMap((slot) => slot.source_ids || []),
  )];
}

function summarizeCoverageSlot(slot, companyId) {
  const rowsById = new Map(getSourceHealthRows().map((row) => [row.source_id, row]));
  const rows = (slot.source_ids || []).map((id) => rowsById.get(id)).filter(Boolean);
  const sourceIds = new Set(slot.source_ids || []);
  const items = (state.payload?.items || []).filter((item) =>
    (item.matched_company_ids || []).includes(companyId) &&
    (item.source_ids || [item.source_id]).some((id) => sourceIds.has(id)),
  );
  return {
    rows,
    total: items.length,
    selected: items.filter((item) => ["immediate", "daily"].includes(item.tier)).length,
    producing: new Set(items.flatMap((item) => item.source_ids || [item.source_id])).size,
  };
}

function inferSourceMethodCategory(sourceId, row = {}) {
  const id = String(sourceId).toLowerCase();
  const value = `${id} ${row.source_label || ""} ${row.source_type || ""}`.toLowerCase();
  let layer = "official";
  if (/google_news|bing_news|news_search|aggregat/.test(id)) layer = "aggregator";
  else if (/crossref|pubmed|clinical|pmda|amed|openfda|patent|research|trial|regulat/.test(id)) layer = "research_regulatory";
  else if (/youtube|multimedia|video|linkedin|wechat|twitter|social/.test(id)) layer = "social_content";
  else if (/linkj|ispark|kinki|firm_|conference|exhibition|channel_event/.test(id)) layer = "market_channel";
  else if (/businesswire|prnewswire|globenewswire|prtimes|nikkei|pharmcube|fierce|biospace|gen_|selectscience|bioprocess|newswire|media/.test(id)) layer = "wire_media";
  else if (!/_official_|official_/.test(id) && /social|media|video/.test(value)) layer = "social_content";
  return sourceInventory.find((category) => category.layer === layer) || null;
}

function getSourceMethodRecord(sourceId, row = {}) {
  for (const category of sourceInventory) {
    const method = category.sources.find((source) => (source.sourceIds || []).includes(sourceId));
    if (method) return { category, method };
  }
  const category = inferSourceMethodCategory(sourceId, row);
  return category ? { category, method: null } : null;
}

function summarizeCoverageSource(row, companyId) {
  const items = (state.payload?.items || []).filter((item) =>
    (item.matched_company_ids || []).includes(companyId) &&
    (item.source_ids || [item.source_id]).includes(row.source_id),
  );
  const immediate = items.filter((item) => item.tier === "immediate").length;
  const daily = items.filter((item) => item.tier === "daily").length;
  const archive = items.filter((item) => item.tier === "archive").length;
  const selected = immediate + daily;
  const status = ["error", "pending"].includes(row.status)
    ? row.status
    : selected
      ? "productive"
      : items.length
        ? "archive_only"
        : "quiet";
  return {
    total: items.length,
    selected,
    archive,
    status,
    lastPublished: items.map((item) => item.published_at || item.published).filter(Boolean).sort().at(-1) || "",
  };
}

function renderCoverageSourceRow(row, companyId) {
  const result = summarizeCoverageSource(row, companyId);
  const methodRecord = getSourceMethodRecord(row.source_id, row);
  const scopeLabel = row.company_id === companyId ? "公司专属" : "跨公司共享";
  const methodLabel = methodRecord
    ? `${methodRecord.category.number} ${methodRecord.category.title}`
    : "来源方法待归类";
  const sourceLabel = row.source_label || row.source_id;
  const outputDisabled = result.total ? "" : " disabled";
  const sourceUrl = methodRecord?.method?.url
    ? (/^https?:\/\//i.test(methodRecord.method.url) ? methodRecord.method.url : `https://${methodRecord.method.url}`)
    : "";
  return `
    <article class="coverage-source-row status-${escapeAttr(result.status)}">
      <header>
        <div>
          <strong>${escapeHtml(sourceLabel)}</strong>
          <small>${escapeHtml(row.source_id)}</small>
        </div>
        <span class="health-state ${escapeAttr(result.status)}">${escapeHtml(healthStatusLabel(result.status))}</span>
      </header>
      <div class="coverage-source-route">
        <span>${escapeHtml(scopeLabel)}</span>
        <span>${escapeHtml(labelSignalType(row.signal_type || "news"))}</span>
        <span>${escapeHtml(row.source_type || "unknown")}</span>
        <b>${escapeHtml(methodLabel)}</b>
      </div>
      <div class="coverage-source-metrics">
        <span><b>${result.total}</b>候选</span>
        <span><b>${result.selected}</b>日报</span>
        <span><b>${result.archive}</b>归档</span>
        <span><b>${escapeHtml(result.lastPublished || "—")}</b>最后内容</span>
      </div>
      <div class="coverage-source-actions">
        <button type="button" data-view-source-output-id="${escapeAttr(row.source_id)}" data-source-label="${escapeAttr(sourceLabel)}"${outputDisabled}>
          ${result.total ? `查看 ${result.total} 条产出` : "暂无产出"}
        </button>
        ${sourceUrl ? `<a href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">打开来源</a>` : ""}
        <button type="button" data-locate-source-id="${escapeAttr(row.source_id)}"${methodRecord ? "" : " disabled"}>在来源方法库定位</button>
      </div>
    </article>`;
}

function renderCompanySourceCoverage() {
  if (!els.companyCoverageSelect || !els.companyCoverageGrid) return;
  const companies = sortCompaniesForDisplay(state.payload?.companies || []);
  const coverage = state.payload?.company_source_coverage || {};
  const definitions = coverage.slot_definitions || [];
  if (els.companyCoverageTimestamp) {
    els.companyCoverageTimestamp.textContent = `${companies.length} 家公司 · ${definitions.length} 类公司监测板块`;
  }
  const validIds = new Set(companies.map((company) => company.id));
  if (!validIds.has(state.coverageCompany)) state.coverageCompany = companies[0]?.id || "";

  els.companyCoverageSelect.innerHTML = companies.map((company) => `
    <option value="${escapeHtml(company.id)}" ${company.id === state.coverageCompany ? "selected" : ""}>${escapeHtml(company.display_name)}</option>
  `).join("");

  const company = companies.find((row) => row.id === state.coverageCompany);
  const profile = getCompanyCoverageProfile(state.coverageCompany) || { slots: {} };
  const rowsById = new Map(getSourceHealthRows().map((row) => [row.source_id, row]));
  const allSourceIds = getCoverageSourceIds(profile);
  const dedicatedIds = allSourceIds.filter((id) => rowsById.get(id)?.company_id === state.coverageCompany);
  const sharedIds = allSourceIds.filter((id) => rowsById.get(id)?.company_id !== state.coverageCompany);
  const coveredSlots = definitions.filter((definition) =>
    ["active", "covered"].includes(profile.slots?.[definition.id]?.status),
  ).length;
  const gapSlots = Math.max(0, definitions.length - coveredSlots);
  const companyItems = (state.payload?.items || []).filter((item) =>
    (item.matched_company_ids || []).includes(state.coverageCompany),
  );
  const companySelected = companyItems.filter((item) => ["immediate", "daily"].includes(item.tier));

  els.companyCoverageTitle.textContent = company
    ? `${company.display_name} · ${definitions.length} 类公司监测板块`
    : "公司监测档案";
  els.companyCoverageDescription.textContent = company?.monitoring_focus
    ? `监测重点：${company.monitoring_focus}。点开任一监测板块，可查看它实际使用的具体入口、所属来源方法和本轮产出。`
    : "监测板块回答看什么，实际入口回答具体用了哪些 RSS、官网和检索规则。";
  els.companyCoverageMetrics.innerHTML = `
    <article><span>专属配置入口</span><strong>${dedicatedIds.length}</strong><small>已登记，不代表有产出</small></article>
    <article><span>共享配置入口</span><strong>${sharedIds.length}</strong><small>可检索该公司，不代表命中</small></article>
    <article><span>已覆盖监测板块</span><strong>${coveredSlots}<b> / ${definitions.length}</b></strong><small>${gapSlots} 个监测板块尚未配置</small></article>
    <article class="${companyItems.length ? "has-output" : "needs-review"}"><span>本轮实际命中</span><strong>${companyItems.length}</strong><small>真正关联到该公司</small></article>
    <article class="${companySelected.length ? "has-output" : "needs-review"}"><span>进入日报</span><strong>${companySelected.length}</strong><small>通过相关性与动作门槛</small></article>
  `;

  els.companyCoverageGrid.innerHTML = definitions.map((definition) => {
    const slot = profile.slots?.[definition.id] || {
      status: "planned",
      mode: "none",
      source_ids: [],
      note: `尚未为 ${company?.display_name || "该公司"} 建立这一类稳定入口。`,
    };
    const status = coverageStatusMeta[slot.status] || coverageStatusMeta.planned;
    const configurationLabel = ["active", "covered"].includes(slot.status)
      ? {
          dedicated: "专属入口已配置",
          shared: "共享入口已配置",
          mixed: "专属 + 共享已配置",
        }[slot.mode] || status.label
      : status.label;
    const summary = summarizeCoverageSlot(slot, state.coverageCompany);
    const sourceRows = (slot.source_ids || []).map((sourceId) => rowsById.get(sourceId) || {
      source_id: sourceId,
      source_label: sourceId,
      company_id: "",
      source_type: "unknown",
      signal_type: "news",
      status: "pending",
    });
    const hasConfiguredEntry = Boolean(slot.source_ids?.length) && ["active", "covered"].includes(slot.status);
    const hasRuntimeError = summary.rows.some((row) => row.status === "error");
    const runtimeClass = !hasConfiguredEntry
      ? "not-configured"
      : hasRuntimeError
        ? "error"
        : summary.selected
          ? "selected"
          : summary.total
            ? "archive"
            : "quiet";
    const runtimeLabel = !hasConfiguredEntry
      ? "未接入，不统计"
      : hasRuntimeError
      ? "抓取异常"
      : summary.selected
        ? "有日报产出"
        : summary.total
          ? "仅归档产出"
          : "本轮零命中";
    const result = hasConfiguredEntry
      ? summary.total
        ? `实际命中 ${summary.total} 条 · ${summary.selected} 条进入日报`
        : `${slot.source_ids.length} 个入口已登记，但没有命中该公司`
      : "当前没有经过验证的自动入口";
    return `
      <details class="company-coverage-slot status-${status.className}">
        <summary>
          <span>${escapeHtml(definition.number)}</span>
          <div><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(coverageModeLabels[slot.mode || "none"] || coverageModeLabels.none)} · ${slot.source_ids?.length || 0} 个实际入口</small></div>
          <b class="coverage-status ${status.className}">${escapeHtml(configurationLabel)}</b>
          <i class="coverage-expand-indicator" aria-hidden="true"></i>
        </summary>
        <div class="company-coverage-slot-body">
          <p>${escapeHtml(definition.description)}</p>
          <div class="company-coverage-note">${escapeHtml(slot.note || "")}</div>
          <div class="company-coverage-result runtime-${runtimeClass}"><b>${escapeHtml(runtimeLabel)}</b><strong>${escapeHtml(result)}</strong></div>
          <div class="coverage-source-list-head"><strong>该公司实际使用的来源</strong><span>${sourceRows.length} 个入口</span></div>
          <div class="coverage-source-list">
            ${sourceRows.length
              ? sourceRows.map((row) => renderCoverageSourceRow(row, state.coverageCompany)).join("")
              : '<div class="coverage-source-empty">这个监测板块还没有配置具体采集入口。</div>'}
          </div>
        </div>
      </details>
    `;
  }).join("");
}

function renderAcroOperationalProfile() {
  if (!els.acroProfileSourceCount || !state.payload) return;
  const coverage = state.payload.company_source_coverage || {};
  const definitions = coverage.slot_definitions || [];
  const profile = getCompanyCoverageProfile("acro") || { slots: {} };
  const sourceIds = getCoverageSourceIds(profile);
  const rowsById = new Map(getSourceHealthRows().map((row) => [row.source_id, row]));
  const sourceRows = sourceIds.map((id) => rowsById.get(id)).filter(Boolean);
  const dedicated = sourceRows.filter((row) => row.company_id === "acro").length;
  const shared = sourceRows.length - dedicated;
  const coveredSlots = definitions.filter((definition) =>
    ["active", "covered"].includes(profile.slots?.[definition.id]?.status),
  ).length;
  const acroItems = (state.payload.items || []).filter((item) =>
    (item.matched_company_ids || []).includes("acro"),
  );
  const selectedItems = acroItems.filter((item) => ["daily", "immediate"].includes(item.tier));
  const producingSources = sourceRows.filter((row) => Number(row.total) > 0).length;
  const selectedSources = sourceRows.filter((row) => Number(row.immediate) + Number(row.daily) > 0).length;
  const errors = sourceRows.filter((row) => row.operational_status === "error" || row.status === "error").length;

  els.acroProfileTimestamp.textContent = `本轮运行 ${formatDateTime(state.payload.generated_at)}`;
  els.acroProfileSourceCount.textContent = `${sourceRows.length} 个入口`;
  els.acroProfileSourceDetail.textContent = `${dedicated} 个公司专属 · ${shared} 个跨公司共享；均来自本轮真实运行配置。`;
  els.acroProfileCoverageCount.textContent = `${coveredSlots} / ${definitions.length} 类`;
  els.acroProfileSignalCount.textContent = `${selectedItems.length} 条日报`;
  els.acroProfileSignalDetail.textContent = `当前数据窗口累计命中 ${acroItems.length} 条，其中 ${selectedItems.length} 条通过日报门槛。`;
  els.acroProfileHealth.textContent = errors ? `${errors} 个异常` : "运行正常";
  els.acroProfileHealthDetail.textContent = `${producingSources} 个入口有产出 · ${selectedSources} 个贡献日报 · ${errors} 个异常。`;
}

async function loadData() {
  const canLoadLiveData = ["http:", "https:"].includes(window.location.protocol);
  const previousPayload = state.payload;
  let syncFailed = false;
  els.refreshButton.disabled = true;
  els.refreshButton.classList.add("is-loading");
  els.refreshButton.setAttribute("aria-busy", "true");
  if (previousPayload) {
    els.updatedAt.textContent = "正在同步最新抓取结果...";
    els.healthGeneratedAt.textContent = "正在同步本轮数据源健康...";
  }

  try {
    if (canLoadLiveData) {
      state.payload = hydrateCompanyMetadata(await fetchJson("../data/latest_run.json"));
    } else if (window.AIHOT_EMBEDDED_PAYLOAD) {
      state.payload = window.AIHOT_EMBEDDED_PAYLOAD;
    } else {
      state.payload = fallbackPayload;
    }
  } catch (error) {
    syncFailed = true;
    state.payload = previousPayload || window.AIHOT_EMBEDDED_PAYLOAD || fallbackPayload;
  }

  if (!canLoadLiveData) {
    state.history = window.AIHOT_EMBEDDED_HISTORY || null;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = yesterday.toISOString().slice(0, 10);
    try {
      state.history = await fetchJson(`../data/history/${ymd}.json`);
    } catch {
      state.history = null;
    }
  }

  renderLoadedData();
  if (syncFailed) {
    const previousRun = formatDateTime(state.payload.generated_at);
    els.updatedAt.textContent = `同步失败，仍显示 ${previousRun}`;
    els.healthGeneratedAt.textContent = `同步失败，仍显示本轮 ${previousRun}`;
  }
  els.refreshButton.disabled = !canLoadLiveData;
  els.refreshButton.classList.remove("is-loading");
  els.refreshButton.removeAttribute("aria-busy");
  if (!canLoadLiveData) {
    els.refreshButton.title = "当前是本地文件快照；请使用 localhost 或在线地址同步最新结果";
    els.refreshButton.setAttribute("aria-label", els.refreshButton.title);
  }
}

function hydrateFilters() {
  const categories = [...new Set(state.payload.items.map(getBusinessEventType))].sort();
  const companies = (state.payload.companies || [])
    .map((company) => company.display_name)
    .sort();
  const current = els.categoryFilter.value;
  const currentCompany = els.companyFilter.value;
  els.categoryFilter.innerHTML = '<option value="all">全部商业事件</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = labelBusinessEvent(category);
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
  els.windowDays.textContent = state.sourceOutputId !== "all" ? "来源全量" : `${state.timeRange} 天`;
  els.updatedAt.textContent = `更新于 ${formatDateTime(payload.generated_at)}`;

  renderTranslationToggle();
  renderOverviewScope();
  renderCompanyTimeline();
  renderRules();
  renderPage();
}

function renderTranslationToggle() {
  els.translationToggles.forEach((toggle) => {
    toggle.querySelectorAll("[data-translation-language]").forEach((button) => {
      const active = button.dataset.translationLanguage === state.translationLanguage;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });
}

function getSignalTypeItems() {
  return state.payload.items.filter(
    (item) => state.signalType === "all" || (item.signal_type || "news") === state.signalType,
  );
}

const businessEventDefinitions = {
  product_platform: { label: "产品与平台", short: "产品平台", en: "Product and platform", shortEn: "Product" },
  target_therapy: { label: "靶点与治疗方向", short: "靶点疗法", en: "Targets and therapy areas", shortEn: "Targets" },
  clinical_regulatory: { label: "临床与监管", short: "临床监管", en: "Clinical and regulatory", shortEn: "Clinical" },
  partnership_deal: { label: "合作、授权与交易", short: "合作交易", en: "Partnerships, licensing and deals", shortEn: "Deals" },
  customer_demand: { label: "客户需求与潜在机会", short: "客户需求", en: "Customer demand and opportunities", shortEn: "Demand" },
  market_activity: { label: "市场活动与渠道", short: "市场活动", en: "Market activities and channels", shortEn: "Events" },
  regional_expansion: { label: "地区扩张与市场进入", short: "地区扩张", en: "Regional expansion and market entry", shortEn: "Region" },
  quality_supply: { label: "质量、GMP 与供应链", short: "质量供应", en: "Quality, GMP and supply chain", shortEn: "Quality" },
  corporate_strategy: { label: "公司战略与组织动作", short: "公司战略", en: "Corporate strategy and organization", shortEn: "Strategy" },
};

function getBusinessEventType(item) {
  if (item.business_event_type && businessEventDefinitions[item.business_event_type]) {
    return item.business_event_type;
  }
  const intelligence = item.intelligence || {};
  const actions = intelligence.business_actions || [];
  const text = `${item.title || ""} ${item.summary || ""} ${item.ai_summary || ""}`;
  if (/\b(?:GMP|quality|supply chain|ISO 13485|ISO 17025|material suitability|raw material)\b|质量|供应链|原料合规/i.test(text)) {
    return "quality_supply";
  }
  if (item.recommended_action?.type === "lead") return "customer_demand";
  if (item.category === "partnership" || actions.some((action) =>
    ["合作 / 共同开发", "授权 / 引进", "并购 / 交易"].includes(action),
  )) return "partnership_deal";
  if (item.category === "regulatory" || (intelligence.development_stages || []).length ||
      actions.includes("临床里程碑") || actions.includes("注册 / 监管动作")) {
    return "clinical_regulatory";
  }
  if (item.signal_type === "event" || item.category === "event" || item.category === "video" ||
      (intelligence.event_signals || []).length) return "market_activity";
  if (item.category === "market" || actions.includes("市场进入") || actions.includes("扩产 / 新设施")) {
    return "regional_expansion";
  }
  if (item.category === "product" || actions.includes("产品发布")) return "product_platform";
  if ((intelligence.targets || []).length || (intelligence.modalities || []).length || item.category === "research") {
    return "target_therapy";
  }
  if ((intelligence.product_needs || []).length && getItemRole(item) === "industry") return "customer_demand";
  return "corporate_strategy";
}

function labelBusinessEvent(eventType, short = false) {
  const definition = businessEventDefinitions[eventType];
  return definition ? (short ? definition.short : definition.label) : eventType;
}

function labelBusinessEventLanguage(eventType, short = false, language = state.translationLanguage) {
  const definition = businessEventDefinitions[eventType];
  if (!definition) return eventType;
  if (language === "en") return short ? definition.shortEn || definition.en : definition.en;
  return short ? definition.short : definition.label;
}

function getOverviewMetricItems(metricKey, scopedItems, companyRoles) {
  const definition = overviewMetricDefinitions[metricKey] || overviewMetricDefinitions.critical;
  return scopedItems.filter((item) => definition.matches(item, companyRoles));
}

function getOverviewScopeLabel() {
  const tierLabels = {
    all: "全部分层",
    immediate: "即时提醒",
    daily: "进入日报",
    archive: "归档观察",
  };
  const relevanceLabels = {
    high: "ACRO 高相关",
    medium: "ACRO 中相关",
    low: "ACRO 低相关",
  };
  const parts = [
    state.sourceOutputId !== "all" ? "来源全量" : `${state.timeRange} 天`,
    tierLabels[state.tier] || "全部分层",
  ];
  if (state.role !== "all") parts.push(labelRole(state.role));
  if (state.region !== "all") parts.push(labelRegion(state.region));
  if (state.relevance !== "all") parts.push(relevanceLabels[state.relevance] || state.relevance);
  if (state.signalType !== "all") parts.push(labelSignalType(state.signalType));
  if (state.category !== "all") parts.push(labelBusinessEvent(state.category));
  if (state.company !== "all") parts.push(state.company);
  if (state.searchQuery) parts.push(`搜索：${state.searchQuery}`);
  return parts.join(" · ");
}

function renderOverviewMetricDetail(scopedItems, companyRoles) {
  if (!els.overviewMetricList) return;
  const metricKey = overviewMetricDefinitions[state.overviewMetric]
    ? state.overviewMetric
    : "critical";
  const definition = overviewMetricDefinitions[metricKey];
  const items = getOverviewMetricItems(metricKey, scopedItems, companyRoles);
  const companies = [...new Set(items.flatMap((item) => {
    const matched = item.matched_companies || [];
    return matched.length ? matched : [item.company];
  }).filter(Boolean))];
  const sources = new Set(items.flatMap((item) => {
    const ids = item.source_ids || [];
    return ids.length ? ids : [item.source_id || item.source_label];
  }).filter(Boolean));
  const eventCounts = items.reduce((acc, item) => {
    const eventType = getBusinessEventType(item);
    acc[eventType] = (acc[eventType] || 0) + 1;
    return acc;
  }, {});
  const [topEventType, topEventCount = 0] = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])[0] || ["", 0];
  const latestDate = items
    .map((item) => item.published_at || item.published || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "暂无";

  els.overviewMetricHero.dataset.metric = metricKey;
  els.overviewMetricBreadcrumbTitle.textContent = definition.label;
  els.overviewMetricTitle.textContent = definition.pageTitle;
  els.overviewMetricDescription.textContent = definition.description;
  els.overviewMetricBoundary.textContent = definition.boundary;
  els.overviewMetricCount.textContent = items.length;
  els.overviewMetricScope.textContent = getOverviewScopeLabel();
  els.overviewMetricListTitle.textContent = `${definition.label}包含哪些信息`;
  els.overviewMetricResultCount.textContent = `${items.length} 条结果`;
  els.overviewMetricFacts.innerHTML = `
    <div>
      <span>涉及公司</span>
      <strong>${companies.length} 家</strong>
      <small>${escapeHtml(companies.slice(0, 3).join(" / ") || "当前没有命中公司")}</small>
    </div>
    <div>
      <span>主要业务动向</span>
      <strong>${escapeHtml(topEventType ? labelBusinessEvent(topEventType) : "暂无")}</strong>
      <small>${topEventCount ? `${topEventCount} 条，占当前结果 ${Math.round((topEventCount / items.length) * 100)}%` : "当前没有可统计事件"}</small>
    </div>
    <div>
      <span>来源与时效</span>
      <strong>${sources.size} 个来源</strong>
      <small>最新发布 ${escapeHtml(latestDate)}</small>
    </div>
  `;
  renderSignalCards(els.overviewMetricList, items, false);
}

function renderOverviewScope() {
  const scoped = getFilteredItems();
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  const customerCompanyCount = getJapanAccountData().accounts?.length || (state.payload.companies || []).filter(
    (company) => company.business_role === "customer",
  ).length;
  const criticalCount = getOverviewMetricItems("critical", scoped, companyRoles).length;
  const competitorCount = getOverviewMetricItems("competitor", scoped, companyRoles).length;
  const customerCount = getOverviewMetricItems("customer", scoped, companyRoles).length;
  const apacCount = getOverviewMetricItems("apac", scoped, companyRoles).length;

  els.metricCandidates.textContent = criticalCount;
  els.metricDaily.textContent = competitorCount;
  els.metricImmediate.textContent = customerCompanyCount ? customerCount : "未接入";
  els.metricArchive.textContent = apacCount;
  els.metricCompetitorNote.textContent = `${
    (state.payload.companies || []).filter((company) => company.business_role === "competitor").length
  } 家已确认竞品`;
  els.metricCustomerNote.textContent = customerCompanyCount
    ? `${customerCompanyCount} 家日本市场账户`
    : "账户目录尚未导入";
  els.sourceCount.textContent = `${scoped.length} 条`;
  els.windowDays.textContent = state.sourceOutputId !== "all" ? "来源全量" : `${state.timeRange} 天`;

  const customerPriorities = buildCustomerAccountPriorities();
  renderCustomerPriorityMatrix(customerPriorities);
  renderExecutiveBrief(scoped, companyRoles, customerCompanyCount, customerCount, customerPriorities);
  renderSignalTrend(scoped, companyRoles);
  renderRegionDistribution(scoped);
  renderCompanyTopicMatrix();
  renderCategoryDistribution(scoped);
  renderBusinessLanes(scoped, companyRoles);
  renderSignals();
  renderMethodology();
  if (state.page === "overview-metric") {
    renderOverviewMetricDetail(scoped, companyRoles);
  }
}

function renderBusinessLanes(items, companyRoles) {
  if (!els.competitorActionList) return;
  const competitorItems = items.filter(
    (item) => getItemRole(item, companyRoles) === "competitor",
  );
  const opportunityItems = items.filter((item) => {
    const role = getItemRole(item, companyRoles);
    const productNeeds = item.intelligence?.product_needs || [];
    return role === "customer" ||
      item.recommended_action?.type === "lead" ||
      (item.acro_relevance?.level === "high" && role !== "competitor") ||
      (productNeeds.length && role === "industry");
  });
  const partnerItems = items.filter((item) =>
    item.category === "partnership" ||
    (item.intelligence?.business_actions || []).some((action) =>
      ["合作 / 共同开发", "授权 / 引进"].includes(action),
    ),
  );

  els.competitorLaneCount.textContent = competitorItems.length;
  els.opportunityLaneCount.textContent = opportunityItems.length;
  els.partnerLaneCount.textContent = partnerItems.length;
  renderBusinessLaneItems(els.competitorActionList, competitorItems, "当前范围内没有竞品行动。", "competitor");
  renderBusinessLaneItems(els.opportunityActionList, opportunityItems, "尚无达到门槛的 ACRO 机会。", "opportunity");
  renderBusinessLaneItems(els.partnerActionList, partnerItems, "当前范围内没有新合作信号。", "partner");
}

function renderBusinessLaneItems(container, items, emptyText, laneType) {
  const topItems = [...items].sort((a, b) => b.score - a.score).slice(0, 3);
  if (!topItems.length) {
    container.innerHTML = `<div class="business-lane-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  container.innerHTML = topItems.map((item) => {
    const company = item.matched_companies?.[0] || item.company || "行业信号";
    const intelligence = item.intelligence || {};
    const context = laneType === "opportunity"
      ? (intelligence.product_needs || [])[0] || item.recommended_action?.label || "待评估"
      : laneType === "partner"
        ? (intelligence.business_actions || [])[0] || labelBusinessEvent(getBusinessEventType(item), true)
        : (intelligence.modalities || [])[0] || labelBusinessEvent(getBusinessEventType(item), true);
    const action = item.recommended_action || { label: "人工判断", owner: "待分派" };
    const workflow = signalWorkflowDefinitions[getSignalWorkflowStatus(item)] || signalWorkflowDefinitions.new;
    return `
      <a class="business-lane-item" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">
        <span><b>${escapeHtml(shortCompanyName(company))}</b><i>${escapeHtml(context)}</i></span>
        <strong>${escapeHtml(getDisplayTitle(item))}</strong>
        <small>${escapeHtml(getItemDateLabel(item))} · ${Number(item.score) || 0} 分</small>
        <div class="business-lane-action"><span>${escapeHtml(action.label || "人工判断")}</span><b>${escapeHtml(action.owner || "待分派")}</b><i>${escapeHtml(workflow.label)}</i></div>
      </a>
    `;
  }).join("");
}

const regionDefinitions = [
  { id: "japan", label: "日本" },
  { id: "china", label: "中国" },
  { id: "korea", label: "韩国" },
  { id: "southeast_asia", label: "东南亚" },
  { id: "north_america", label: "北美" },
  { id: "europe", label: "欧洲" },
  { id: "global", label: "全球 / 未识别" },
];

const regionPatterns = [
  ["japan", /\b(japan|japanese|tokyo|osaka|kobe|kyoto|yokohama|biojapan)\b|日本|東京|东京|大阪|神戸|神户|京都|横浜|横滨|近畿|湘南/i],
  ["china", /\b(china|chinese|beijing|shanghai|shenzhen|suzhou|guangzhou)\b|中国|北京|上海|深圳|苏州|广州/i],
  ["korea", /\b(korea|korean|seoul|bio korea)\b|韩国|韓国|首尔|ソウル/i],
  ["southeast_asia", /\b(singapore|malaysia|thailand|indonesia|vietnam|philippines)\b|新加坡|马来西亚|泰国|印度尼西亚|越南|菲律宾/i],
  ["north_america", /\b(united states|u\.s\.|usa|canada|boston|california|san diego|new york)\b|美国|加拿大/i],
  ["europe", /\b(europe|european|germany|france|uk|united kingdom|switzerland|netherlands|belgium)\b|欧洲|德国|法国|英国|瑞士|荷兰|比利时/i],
];

function inferItemRegion(item) {
  const text = `${item.title || ""} ${item.summary || ""} ${item.ai_summary || ""} ${
    (item.source_labels || [item.source_label]).join(" ")
  }`;
  return regionPatterns.find(([, pattern]) => pattern.test(text))?.[0] || "global";
}

function labelRegion(region) {
  return regionDefinitions.find((entry) => entry.id === region)?.label || region;
}

function getItemRole(item, companyRoles = null) {
  const roles = companyRoles || new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  const matchedRoles = (item.matched_company_ids || []).map((id) => roles.get(id)).filter(Boolean);
  for (const role of ["customer", "competitor", "self"]) {
    if (matchedRoles.includes(role)) return role;
  }
  if (getJapanAccountMatchedItemIds().has(item.id || item.url)) return "customer";
  return "industry";
}

function labelRole(role) {
  return {
    self: "本公司",
    competitor: "竞品",
    customer: "客户 / 潜在账户",
    industry: "行业观察",
  }[role] || role;
}

function buildCustomerAccountPriorities(days = null) {
  const priorityRule = window.AIHOT_RULE_CATALOG?.account_priority || {};
  const densityRule = window.AIHOT_RULE_CATALOG?.relevance_density || {};
  const windowDays = Number(days) || Number(priorityRule.window_days) || 90;
  const densityWeights = densityRule.weights || { high: 1, medium: 0.55, low: 0 };
  const freshnessRule = priorityRule.freshness || { within_7_days: 12, within_30_days: 7, older: 2 };
  const thresholds = priorityRule.thresholds || {
    priority_check: 76,
    priority_check_minimum_selected: 2,
    follow_this_week: 54,
    follow_this_week_minimum_selected: 1,
  };
  const companies = (state.payload.companies || []).filter(
    (company) => company.business_role === "customer",
  );
  const allItems = state.payload.items || [];
  const accounts = getJapanAccountData().accounts || [];
  return companies.map((company) => {
    const items = allItems.filter((item) =>
      itemIsWithinRange(item, windowDays) && (item.matched_company_ids || []).includes(company.id),
    ).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    const selectedItems = items.filter((item) => ["daily", "immediate"].includes(item.tier));
    const highItems = items.filter((item) => item.acro_relevance?.level === "high");
    const mediumItems = items.filter((item) => item.acro_relevance?.level === "medium");
    const recent7 = items.filter((item) => itemIsWithinRange(item, 7));
    const recent30 = items.filter((item) => itemIsWithinRange(item, 30));
    const sourceIds = new Set(items.flatMap((item) => item.source_ids || [item.source_id]).filter(Boolean));
    const eventCounts = {};
    const eventBasis = selectedItems.length ? selectedItems : highItems.length ? highItems : items;
    for (const item of eventBasis) {
      const eventType = getBusinessEventType(item);
      eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
    }
    const dominantEvent = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "corporate_strategy";
    const density = items.length
      ? Math.round(((highItems.length * densityWeights.high + mediumItems.length * densityWeights.medium) / items.length) * 100)
      : 0;
    const account = findAccountForCompany(company, accounts);
    const publicRelationshipEvidence = getVerifiedPublicRelationshipEvidence(account);
    const publicRelationship = publicRelationshipEvidence.length > 0;
    const freshnessScore = recent7.length
      ? freshnessRule.within_7_days
      : recent30.length
        ? freshnessRule.within_30_days
        : items.length
          ? freshnessRule.older
          : 0;
    const priorityScore = Math.min(Number(priorityRule.maximum) || 99, Math.round(
      Math.log2(1 + selectedItems.length) * (Number(priorityRule.selected_log_weight) || 6) +
      Math.log2(1 + highItems.length) * (Number(priorityRule.high_relevance_log_weight) || 4) +
      density * (Number(priorityRule.density_weight) || 0.14) +
      freshnessScore +
      Math.log2(1 + sourceIds.size) * (Number(priorityRule.source_diversity_log_weight) || 2.5) +
      Math.min(Object.keys(eventCounts).length, Number(priorityRule.event_diversity_maximum) || 4) +
      (publicRelationship ? Number(priorityRule.verified_public_relationship_bonus) || 3 : 0),
    ));
    const keyItem = selectedItems[0] || items[0] || null;
    const action = buildCustomerPriorityAction(dominantEvent, publicRelationship, selectedItems.length);
    const urgency = priorityScore >= thresholds.priority_check && selectedItems.length >= thresholds.priority_check_minimum_selected
      ? { label: "优先核验", className: "urgent" }
      : priorityScore >= thresholds.follow_this_week && selectedItems.length >= thresholds.follow_this_week_minimum_selected
        ? { label: "本周跟进", className: "active" }
        : { label: "持续观察", className: "watch" };
    return {
      company,
      items,
      selectedItems,
      highCount: highItems.length,
      mediumCount: mediumItems.length,
      recent30Count: recent30.length,
      sourceCount: sourceIds.size,
      density,
      priorityScore,
      dominantEvent,
      publicRelationship,
      publicRelationshipEvidenceCount: publicRelationshipEvidence.length,
      keyItem,
      action,
      urgency,
    };
  }).sort((a, b) =>
    b.priorityScore - a.priorityScore ||
    b.density - a.density ||
    b.selectedItems.length - a.selectedItems.length,
  );
}

function buildCustomerPriorityAction(eventType, publicRelationship, selectedCount) {
  const actions = {
    product_platform: ["匹配产品与平台需求", "产品市场 + 销售"],
    target_therapy: ["按靶点和疗法匹配产品", "产品市场 + BD"],
    clinical_regulatory: ["核对管线阶段与实验需求", "销售 + 技术支持"],
    partnership_deal: ["核验合作方与外包机会", "BD + 销售"],
    customer_demand: ["调取账户记录并确认需求", "销售 / BD"],
    market_activity: ["安排活动触达或参会跟进", "区域市场 + 销售"],
    regional_expansion: ["核对日本团队与渠道触点", "区域市场"],
    quality_supply: ["评估 GMP 原料与供应机会", "销售 + 质量团队"],
    corporate_strategy: ["观察组织变化并寻找联系人", "销售运营"],
  };
  const [label, owner] = actions[eventType] || actions.corporate_strategy;
  if (!selectedCount) return { label: "继续采集，暂不触达", owner: "市场情报" };
  if (publicRelationship) return { label: `调取内部记录，${label}`, owner };
  return { label: `先核验关系，再${label}`, owner };
}

function renderCustomerPriorityMatrix(priorities) {
  if (!els.customerPriorityMatrix) return;
  const withSignals = priorities.filter((entry) => entry.items.length).length;
  els.customerPriorityScope.textContent = `近 90 天 · ${priorities.length} 家持续监测 · ${withSignals} 家已有信号`;
  if (!priorities.length) {
    els.customerPriorityMatrix.innerHTML = '<div class="empty">尚未配置持续监测的客户或市场账户。</div>';
    return;
  }
  const header = `
    <div class="customer-priority-row customer-priority-header">
      <span>账户（优先级高 → 低）</span>
      <span>优先指数 <button class="column-help" type="button" data-methodology-target="priority-index" aria-label="查看优先指数规则">i</button></span>
      <span>ACRO 相关密度 <button class="column-help" type="button" data-methodology-target="relevance-density" aria-label="查看 ACRO 相关密度规则">i</button></span>
      <span>近 30 天</span><span>主要动向</span><span>建议下一步</span>
    </div>`;
  const rows = priorities.map((entry, index) => {
    const relationship = entry.publicRelationship ? "公开关系证据" : "关系待确认";
    const keyTitle = entry.keyItem ? getDisplayTitle(entry.keyItem) : "暂无可用原文";
    return `
      <div class="customer-priority-row" role="button" tabindex="0" data-customer-priority-company="${escapeAttr(entry.company.display_name)}" title="查看 ${escapeAttr(keyTitle)}">
        <span class="customer-priority-company">
          <b>${String(index + 1).padStart(2, "0")}</b>
          <i><strong>${escapeHtml(shortCompanyName(entry.company.display_name))}</strong><small>${escapeHtml(relationship)} · ${entry.sourceCount} 个来源</small></i>
        </span>
        <span class="customer-priority-score"><button class="customer-priority-value" type="button" data-methodology-target="priority-index" aria-label="优先指数 ${entry.priorityScore}，查看计算规则"><strong>${entry.priorityScore}</strong></button><i><b style="width:${entry.priorityScore}%"></b></i><small>${entry.urgency.label}</small></span>
        <span class="customer-priority-density"><button class="customer-priority-value" type="button" data-methodology-target="relevance-density" aria-label="ACRO 相关密度 ${entry.density}%，查看计算规则"><strong>${entry.density}%</strong></button><small>${entry.highCount} 高 / ${entry.mediumCount} 中</small></span>
        <span class="customer-priority-count"><strong>${entry.recent30Count}</strong><small>${entry.selectedItems.length} 条进入日报</small></span>
        <span class="customer-priority-topic"><strong>${escapeHtml(labelBusinessEvent(entry.dominantEvent, true))}</strong><small>${escapeHtml(keyTitle)}</small></span>
        <span class="customer-priority-action"><b class="${entry.urgency.className}">${entry.urgency.label}</b><strong>${escapeHtml(entry.action.label)}</strong><small>${escapeHtml(entry.action.owner)}</small></span>
      </div>`;
  }).join("");
  els.customerPriorityMatrix.innerHTML = `<div class="customer-priority-scroll">${header}${rows}</div>`;
}

function groupCompanyActivity(items, role) {
  const companies = (state.payload.companies || []).filter((company) => company.business_role === role);
  return companies.map((company) => {
    const matches = items.filter((item) => (item.matched_company_ids || []).includes(company.id));
    const eventCounts = {};
    for (const item of matches) {
      const eventType = getBusinessEventType(item);
      eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
    }
    const dominantEvent = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "corporate_strategy";
    return {
      company,
      items: matches,
      selectedCount: matches.filter((item) => ["daily", "immediate"].includes(item.tier)).length,
      highCount: matches.filter((item) => item.acro_relevance?.level === "high").length,
      dominantEvent,
      keyItem: [...matches].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0] || null,
    };
  }).filter((entry) => entry.items.length).sort((a, b) =>
    b.selectedCount - a.selectedCount || b.highCount - a.highCount || b.items.length - a.items.length,
  );
}

function topEventEntries(items, limit = 3) {
  const counts = {};
  for (const item of items) {
    const eventType = getBusinessEventType(item);
    counts[eventType] = (counts[eventType] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const assistantViewMeta = {
  action: {
    label: "今日优先",
    basis: "优先指数、相关密度、近期信号与日报门槛",
    boundary: "跨账户、竞品与市场主题的相对排序",
  },
  account: {
    label: "重点账户",
    basis: "账户信号量、ACRO 中高相关密度与事件紧迫度",
    boundary: "公开信号不等于已确认需求或客户意向",
  },
  competitor: {
    label: "竞品动作",
    basis: "竞品入选信号、高相关事件与主导商业动作",
    boundary: "用于确定对标顺序，不直接判断市场输赢",
  },
  market: {
    label: "日本市场",
    basis: "日本地区信号量、商业事件分类与代表事件",
    boundary: "反映当前来源覆盖，不代表完整市场规模",
  },
  source: {
    label: "来源运行",
    basis: "来源请求状态、候选产出、日报入选与归档数量",
    boundary: "单轮安静不等于来源失效，需要连续观察",
  },
};

function buildAssistantResponse(intent, items, customerPriorities) {
  const competitorActivity = groupCompanyActivity(items, "competitor");
  const japanItems = items.filter((item) => inferItemRegion(item) === "japan");
  const accountEntries = customerPriorities.filter((entry) => entry.items.length).slice(0, 3);
  const actionForAccount = (entry) => ({
    label: entry.urgency.label,
    title: `${shortCompanyName(entry.company.display_name)}：${entry.action.label}`,
    detail: `优先指数 ${entry.priorityScore}，ACRO 中高相关密度 ${entry.density}%，近 30 天 ${entry.recent30Count} 条，${entry.selectedItems.length} 条进入日报。`,
    owner: entry.action.owner,
    company: entry.company.display_name,
    category: entry.dominantEvent,
  });
  const actionForCompetitor = (entry) => ({
    label: "竞品应对",
    title: `${shortCompanyName(entry.company.display_name)}：${labelBusinessEvent(entry.dominantEvent)}`,
    detail: `${entry.items.length} 条相关动态，其中 ${entry.selectedCount} 条进入日报、${entry.highCount} 条 ACRO 高相关；先对比产品定位、话术和区域覆盖。`,
    owner: "产品市场",
    company: entry.company.display_name,
    category: entry.dominantEvent,
  });
  if (intent === "account") {
    return {
      headline: accountEntries.length ? "销售与市场优先核验这 3 家账户" : "当前没有足够的账户行动证据",
      actions: accountEntries.map(actionForAccount),
    };
  }
  if (intent === "competitor") {
    return {
      headline: competitorActivity.length ? "这些竞品动作最值得产品市场回应" : "当前范围内没有明确竞品动作",
      actions: competitorActivity.slice(0, 3).map(actionForCompetitor),
    };
  }
  if (intent === "market") {
    const marketBase = japanItems.length ? japanItems : items;
    return {
      headline: japanItems.length ? `日本市场的 ${japanItems.length} 条信号集中在这些方向` : "当前范围的地区热点尚未形成日本样本",
      actions: topEventEntries(marketBase).map(([eventType, count]) => {
        const keyItem = marketBase.find((item) => getBusinessEventType(item) === eventType);
        return {
          label: "市场主题",
          title: labelBusinessEvent(eventType),
          detail: `${count} 条相关信号。代表事件：${keyItem ? getDisplayTitle(keyItem) : "暂无代表事件"}`,
          owner: eventType === "market_activity" ? "区域市场" : "产品市场",
          company: keyItem?.matched_companies?.[0] || "",
          category: eventType,
        };
      }),
    };
  }
  if (intent === "source") {
    const rows = getSourceHealthRows().filter((row) => row.enabled !== false);
    const productive = rows.filter((row) => row.status === "productive").length;
    const quiet = rows.filter((row) => row.status === "quiet").length;
    const errors = rows.filter((row) => row.status === "error").length;
    return {
      headline: `${rows.length} 个运行来源中，${productive} 个本轮有有效产出`,
      actions: [
        { label: "可用产出", title: `${productive} 个来源正在产生有效信号`, detail: "优先保留连续产出且能命中日报的来源。", owner: "系统" },
        { label: "低产观察", title: `${quiet} 个来源本轮安静`, detail: "安静不等于失效，需要结合发布频率连续观察。", owner: "数据运营" },
        { label: errors ? "需要修复" : "链路正常", title: errors ? `${errors} 个来源抓取异常` : "本轮没有抓取错误", detail: errors ? "进入数据源健康页查看错误和替代入口。" : "继续观察下一轮连续性。", owner: "数据运营" },
      ],
    };
  }
  const actions = [];
  if (accountEntries[0]) actions.push(actionForAccount(accountEntries[0]));
  if (competitorActivity[0]) actions.push(actionForCompetitor(competitorActivity[0]));
  const topMarketEvent = topEventEntries(japanItems.length ? japanItems : items, 1)[0];
  if (topMarketEvent) {
    actions.push({
      label: "市场内容",
      title: `围绕“${labelBusinessEvent(topMarketEvent[0])}”准备本周内容或活动判断`,
      detail: `${japanItems.length ? "日本" : "当前范围"}共有 ${topMarketEvent[1]} 条该主题信号，可用代表事件校准选题和销售话术。`,
      owner: "市场运营",
      category: topMarketEvent[0],
    });
  }
  return {
    headline: actions.length ? "今天建议先做这 3 件事" : "当前筛选范围暂时没有可执行信号",
    actions,
  };
}

function renderExecutiveBrief(items, companyRoles, customerCompanyCount, customerSignalCount = 0, customerPriorities = []) {
  const activeView = assistantViewMeta[state.assistantView] ? state.assistantView : "action";
  const viewMeta = assistantViewMeta[activeView];
  const response = buildAssistantResponse(activeView, items, customerPriorities);
  const summaryPipeline = state.payload.summary_pipeline || {};
  const hasModelSummaries = summaryPipeline.status === "complete" && Number(summaryPipeline.generated) > 0;
  const manualSummaryCount = Number(summaryPipeline.manual_imported) || 0;
  els.executiveHeadline.textContent = response.headline;
  els.assistantMode.textContent = manualSummaryCount
    ? `已核验精读 ${manualSummaryCount} 条 · 规则决策`
    : hasModelSummaries
    ? `模型摘要 ${summaryPipeline.generated} 条 · 规则决策`
    : "规则计算 · 可追溯";
  els.assistantViewLabel.textContent = viewMeta.label;
  els.assistantViewBasis.textContent = viewMeta.basis;
  els.assistantViewBoundary.textContent = viewMeta.boundary;
  els.assistantPrompts.querySelectorAll("[data-assistant-view]").forEach((button) => {
    const isActive = button.dataset.assistantView === activeView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  els.assistantDisclosure.textContent = manualSummaryCount
    ? `${manualSummaryCount} 条重点内容已完成人工 AI 精读与原文核验；当前行动建议由固定规则计算，不调用模型 API。`
    : hasModelSummaries
    ? `当前信号包含 ${summaryPipeline.generated} 条模型摘要；行动建议仍由结构化规则计算并链接原文证据。`
    : `已计算 ${items.length} 条信号、${customerCompanyCount} 家日本账户目录和 ${customerSignalCount} 条账户动态；当前不调用模型 API。`;
  els.executivePoints.innerHTML = response.actions.length
    ? response.actions.map((action, index) => `
        <li>
          <button type="button" data-assistant-company="${escapeAttr(action.company || "")}" data-assistant-category="${escapeAttr(action.category || "")}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <i><small>${escapeHtml(action.label)}</small><strong>${escapeHtml(action.title)}</strong><em>${escapeHtml(action.detail)}</em><b>${escapeHtml(action.owner)}</b></i>
          </button>
        </li>`).join("")
    : '<li class="assistant-empty">调整观察周期或筛选条件后再试。</li>';
}

function getTrendAge(item) {
  if (item.event_start_at) {
    const until = Number(item.days_until_event);
    if (!Number.isFinite(until) || until > 0) return null;
    return Math.abs(Math.floor(until));
  }
  if (item.age_days === null || item.age_days === undefined || item.age_days === "") return null;
  const age = Number(item.age_days);
  return Number.isFinite(age) && age >= 0 ? Math.floor(age) : null;
}

function renderSignalTrend(items, companyRoles) {
  const days = state.timeRange;
  const seriesDefinitions = [
    { id: "self", label: "本公司", color: "#087f8c" },
    { id: "competitor", label: "竞品", color: "#c95d42" },
    { id: "customer", label: "客户 / 账户", color: "#345f9f" },
    { id: "industry", label: "行业", color: "#7b8790" },
  ].filter((series) => state.role === "all" || state.role === series.id);
  const values = Object.fromEntries(seriesDefinitions.map((series) => [series.id, Array(days).fill(0)]));
  for (const item of items) {
    const age = getTrendAge(item);
    if (age === null || age >= days) continue;
    const role = getItemRole(item, companyRoles);
    if (values[role]) values[role][days - age - 1] += 1;
  }
  const maxValue = Math.max(1, ...Object.values(values).flat());
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 18, right: 14, bottom: 34, left: 32 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const xFor = (index) => padding.left + (index / Math.max(days - 1, 1)) * plotWidth;
  const yFor = (value) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const grid = [0, 0.5, 1].map((ratio) => {
    const y = padding.top + plotHeight * ratio;
    const label = Math.round(maxValue * (1 - ratio));
    return `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" class="chart-grid-line" />
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${label}</text>`;
  }).join("");
  const lines = seriesDefinitions.map((series) => {
    const points = values[series.id].map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join("");
  const runDate = new Date(state.payload.generated_at);
  const dateLabel = (daysAgo) => {
    const date = new Date(runDate);
    date.setDate(date.getDate() - daysAgo);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  const xLabels = [
    [padding.left, dateLabel(days - 1), "start"],
    [padding.left + plotWidth / 2, dateLabel(Math.floor(days / 2)), "middle"],
    [chartWidth - padding.right, dateLabel(0), "end"],
  ].map(([x, label, anchor]) => `<text x="${x}" y="${chartHeight - 8}" text-anchor="${anchor}" class="chart-axis-label">${label}</text>`).join("");
  els.signalTrendChart.innerHTML = `<svg class="trend-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${state.timeRange} 天信号趋势">${grid}${lines}${xLabels}</svg>`;
  els.trendLegend.innerHTML = seriesDefinitions.map((series) => {
    const total = values[series.id].reduce((sum, value) => sum + value, 0);
    const hasCustomerPool = (getJapanAccountData().accounts || []).length > 0;
    const suffix = series.id === "customer" && !total && !hasCustomerPool ? "未接入" : total;
    return `<button class="trend-legend-item" type="button" data-methodology-target="trend-counts" aria-label="${series.label} ${suffix} 条，查看统计口径"><i style="background:${series.color}"></i>${series.label} ${suffix}</button>`;
  }).join("");
}

function renderRegionDistribution(items) {
  const counts = Object.fromEntries(regionDefinitions.map((region) => [region.id, 0]));
  for (const item of items) counts[inferItemRegion(item)] += 1;
  const entries = regionDefinitions.map((region) => [region, counts[region.id]]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  els.regionBars.innerHTML = entries.map(([region, count]) => `
    <div class="region-row">
      <div><span>${escapeHtml(region.label)}</span><strong>${count}</strong></div>
      <div class="region-track"><i style="width:${Math.max(count ? 7 : 0, Math.round((count / max) * 100))}%"></i></div>
    </div>
  `).join("");
}

function renderCompanyTopicMatrix() {
  const matrixRule = window.AIHOT_RULE_CATALOG?.competitor_matrix || {};
  const matrixDays = Number(matrixRule.window_days) || 90;
  const maximumColumns = Number(matrixRule.maximum_columns) || 5;
  const competitorCompanies = (state.payload.companies || []).filter(
    (company) => company.business_role === "competitor",
  );
  const primaryCompetitors = competitorCompanies.filter(
    (company) => company.competitive_relevance_scope === "primary" && Number.isFinite(Number(company.competitive_relevance_rank)),
  );
  const companies = sortCompaniesForDisplay(primaryCompetitors.length ? primaryCompetitors : competitorCompanies);
  const matrixCompanyById = new Map(companies.map((company) => [company.id, company]));
  const items = (state.payload.items || []).filter((item) =>
    itemIsWithinRange(item, matrixDays) &&
    (item.matched_company_ids || []).some((id) => matrixCompanyById.has(id)),
  );
  const resolveCompanyId = (item) => {
    const matchedIds = (item.matched_company_ids || []).filter((id) => matrixCompanyById.has(id));
    if (!matchedIds.length) return "";
    const brandId = matchedIds.find((id) => matchedIds.includes(matrixCompanyById.get(id)?.parent_company_id));
    return brandId || [...matchedIds].sort(
      (a, b) => getCompetitiveRank(matrixCompanyById.get(a)) - getCompetitiveRank(matrixCompanyById.get(b)),
    )[0];
  };
  const categoryTotals = {};
  for (const item of items) {
    const eventType = getBusinessEventType(item);
    categoryTotals[eventType] = (categoryTotals[eventType] || 0) + 1;
  }
  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, maximumColumns).map(([category]) => category);
  if (!categories.length) {
    els.companyTopicMatrix.innerHTML = `<div class="empty">近 ${matrixDays} 天没有可形成矩阵的核心竞品信号。</div>`;
    return;
  }
  const matrix = {};
  const selectedMatrix = {};
  const companyTotals = {};
  for (const company of companies) {
    matrix[company.id] = Object.fromEntries(categories.map((category) => [category, 0]));
    selectedMatrix[company.id] = Object.fromEntries(categories.map((category) => [category, 0]));
    companyTotals[company.id] = 0;
  }
  for (const item of items) {
    const eventType = getBusinessEventType(item);
    const primaryId = resolveCompanyId(item);
    if (!primaryId) continue;
    companyTotals[primaryId] += 1;
    if (!categories.includes(eventType)) continue;
    matrix[primaryId][eventType] += 1;
    if (["daily", "immediate"].includes(item.tier)) selectedMatrix[primaryId][eventType] += 1;
  }
  let max = 0;
  for (const company of companies) {
    for (const category of categories) {
      max = Math.max(max, matrix[company.id][category]);
    }
  }
  const columns = `minmax(178px, 1.65fr) repeat(${categories.length}, minmax(72px, 1fr))`;
  const header = `<div class="matrix-row matrix-header" style="grid-template-columns:${columns}"><span>相关竞品（高 → 低）</span>${categories.map((category) => `<span>${escapeHtml(labelBusinessEvent(category, true))}</span>`).join("")}</div>`;
  const rows = companies.map((company) => `
    <div class="matrix-row" style="grid-template-columns:${columns}">
      <span class="matrix-company"><b class="matrix-rank">${formatCompetitiveRank(company)}</b><span>${escapeHtml(shortCompanyName(company.display_name))}<small>${companyTotals[company.id]} 条监测信号</small></span></span>
      ${categories.map((category) => {
        const count = matrix[company.id][category];
        const selected = selectedMatrix[company.id][category];
        const intensity = count ? Math.max(1, Math.ceil((count / Math.max(max, 1)) * 4)) : 0;
        if (!count) return '<span class="matrix-cell intensity-0">–</span>';
        return `<button class="matrix-cell intensity-${intensity}" type="button" data-matrix-company="${escapeAttr(company.display_name)}" data-matrix-category="${escapeAttr(category)}" title="查看 ${count} 条监测信号，其中 ${selected} 条进入日报">${count}</button>`;
      }).join("")}
    </div>
  `).join("");
  els.companyTopicMatrix.innerHTML = `<div class="matrix-scroll">${header}${rows}</div>`;
}

function renderCategoryDistribution(items) {
  const counts = {};
  for (const item of items) {
    const eventType = getBusinessEventType(item);
    counts[eventType] = (counts[eventType] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  els.categoryBars.innerHTML = entries.length ? entries.map(([category, count]) => `
    <div class="category-row">
      <div><span>${escapeHtml(labelBusinessEvent(category))}</span><strong>${count}</strong></div>
      <div class="category-track"><i style="width:${Math.round((count / max) * 100)}%"></i></div>
    </div>
  `).join("") : '<div class="empty">当前范围内没有商业事件数据。</div>';
}

function shortCompanyName(name) {
  return String(name).split(" / ")[0].replace(" Scientific", "");
}

function renderSourceLibrary() {
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
        <section class="rule-lane ${cat.layer}${state.sourceFocusLayer === cat.layer ? " source-lane-focus" : ""}" data-source-layer="${escapeAttr(cat.layer)}">
          <div class="rule-lane-head">
            <div class="rule-lane-title">
              <span class="lane-number">${cat.number}</span>
              <h3>${escapeHtml(cat.title)}</h3>
              <span class="lane-summary">${summaryForCategory(visibleSources)}</span>
            </div>
            <p>${escapeHtml(cat.subtitle)}</p>
          </div>
          ${
            cat.layer === "official"
              ? renderOfficialSourceGroups(visibleSources)
              : cat.layer === "wire_media"
                ? renderWireMediaGroups(visibleSources)
                : cat.layer === "social_content"
                  ? renderSocialContentGroups(visibleSources)
                : cat.layer === "market_channel"
                  ? renderMarketChannelGroups(visibleSources)
                  : cat.layer === "research_regulatory"
                    ? renderResearchSignalGroups(visibleSources)
                    : cat.layer === "restricted"
                      ? renderRestrictedSourceGroups(visibleSources)
                      : cat.layer === "paid_later"
                        ? renderCommercialServiceGroups(visibleSources)
                : `<div class="source-grid">${visibleSources.map(renderSourceCard).join("")}</div>`
          }
        </section>
      `;
    })
    .join("");
}

const sourceViewFilters = {
  effective: [
    ["all", "全部有效来源"],
    ["dedicated", "公司专属入口"],
    ["shared", "跨公司共享入口"],
  ],
  connected: [
    ["all", "全部已接入入口"],
    ["productive", "有效产出"],
    ["archive_only", "仅归档"],
    ["quiet", "暂无内容"],
    ["pending", "待配置"],
    ["error", "抓取异常"],
  ],
  library: [
    ["all", "全部来源方法"],
    ["active", "现在在用"],
    ["available", "可用待接"],
    ["planned", "未来开发"],
    ["manual", "人工观察"],
    ["covered", "已被其他入口覆盖"],
    ["blocked", "高风险 / 不接入"],
    ["paid", "付费候选"],
  ],
};

function hydrateSourceStageFilter() {
  const options = sourceViewFilters[state.sourceView] || sourceViewFilters.effective;
  if (!options.some(([value]) => value === state.sourceStage)) state.sourceStage = "all";
  els.sourceStageFilter.innerHTML = options.map(([value, label]) =>
    `<option value="${value}"${value === state.sourceStage ? " selected" : ""}>${label}</option>`,
  ).join("");
}

function renderSourceViewMetrics(healthRows, allMethods) {
  const count = (status) => healthRows.filter((row) => row.status === status).length;
  const pendingAndErrors = count("pending") + count("error");
  els.sourceViewMetrics.innerHTML = `
    <article class="productive"><span>日报有效入口</span><strong>${count("productive")}</strong><small>本轮真正贡献了日报</small></article>
    <article><span>仅归档</span><strong>${count("archive_only")}</strong><small>有内容，但未达日报门槛</small></article>
    <article><span>暂无内容</span><strong>${count("quiet")}</strong><small>已运行，时效窗口内零产出</small></article>
    <article class="${pendingAndErrors ? "attention" : ""}"><span>待配置 / 异常</span><strong>${pendingAndErrors}</strong><small>${count("pending")} 待配置 · ${count("error")} 异常</small></article>
    <article><span>方法库方案</span><strong>${allMethods.length}</strong><small>可能性全集，不等于已运行</small></article>
  `;
}

function renderRuntimeSourceCard(row) {
  const selected = (row.immediate || 0) + (row.daily || 0);
  const scope = row.company_id ? (row.scope || row.company || "公司专属") : "跨公司共享";
  const detail = row.error || row.note || "";
  return `
    <article class="source-card runtime-source-card status-${escapeAttr(row.status)}" data-runtime-source-id="${escapeAttr(row.source_id)}">
      <div class="source-card-top">
        <strong>${escapeHtml(row.source_label)}</strong>
        <span class="health-state ${escapeAttr(row.status)}">${escapeHtml(healthStatusLabel(row.status))}</span>
      </div>
      <div class="source-card-meta">
        <span class="company-source-tag">${escapeHtml(scope)}</span>
        <span class="role-source-tag">${escapeHtml(labelSignalType(row.signal_type || "news"))}</span>
        <span class="method-tag">${escapeHtml(row.source_type || "unknown")}</span>
      </div>
      <div class="runtime-source-stats">
        <span><b>${selected}</b>日报</span>
        <span><b>${row.archive || 0}</b>归档</span>
        <span><b>${row.total || 0}</b>候选</span>
      </div>
      <div class="source-card-result"><span>最后内容</span>${escapeHtml(row.last_published || "本轮暂无")}</div>
      ${detail ? `<p class="source-card-note">${escapeHtml(detail)}</p>` : ""}
    </article>`;
}

function renderRuntimeSourceBoard(rows) {
  const sorted = [...rows].sort((a, b) => {
    const selectedA = (a.immediate || 0) + (a.daily || 0);
    const selectedB = (b.immediate || 0) + (b.daily || 0);
    return selectedB - selectedA || (b.total || 0) - (a.total || 0) ||
      String(a.source_label).localeCompare(String(b.source_label));
  });
  const groups = [
    {
      id: "dedicated",
      title: "公司专属入口",
      description: "为某一家公司配置的官网、搜索、新闻或研究入口",
      rows: sorted.filter((row) => Boolean(row.company_id)),
    },
    {
      id: "shared",
      title: "跨公司共享入口",
      description: "一个入口同时覆盖多家公司，再通过公司别名和主题规则归档",
      rows: sorted.filter((row) => !row.company_id),
    },
  ].filter((group) => group.rows.length);

  if (!groups.length) {
    els.ruleGrid.innerHTML = '<div class="empty runtime-source-empty">当前筛选下没有真实运行入口。</div>';
    return;
  }

  els.ruleGrid.innerHTML = groups.map((group) => `
    <section class="runtime-source-lane ${group.id}">
      <header>
        <div><h3>${group.title}</h3><p>${group.description}</p></div>
        <strong>${group.rows.length} 个</strong>
      </header>
      <div class="source-grid">${group.rows.map(renderRuntimeSourceCard).join("")}</div>
    </section>
  `).join("");
}

function renderRules() {
  if (!els.ruleGrid || !els.sourceStageFilter) return;
  const healthRows = getSourceHealthRows().filter((row) => row.enabled !== false);
  const allMethods = sourceInventory.flatMap((category) => category.sources);
  renderSourceExperiments();
  hydrateSourceStageFilter();
  renderSourceViewMetrics(healthRows, allMethods);
  els.sourceLibraryIntro.hidden = state.sourceView !== "library";
  els.sourceViewControl.querySelectorAll("[data-source-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sourceView === state.sourceView);
  });

  if (state.sourceView === "library") {
    els.sourceViewTitle.textContent = `来源方法库 · ${sourceInventory.length} 类板块`;
    renderSourceLibrary();
    return;
  }

  let visible = state.sourceView === "effective"
    ? healthRows.filter((row) => row.status === "productive")
    : [...healthRows];

  if (state.sourceView === "effective" && state.sourceStage !== "all") {
    visible = visible.filter((row) =>
      state.sourceStage === "dedicated" ? Boolean(row.company_id) : !row.company_id,
    );
  }
  if (state.sourceView === "connected" && state.sourceStage !== "all") {
    visible = visible.filter((row) => row.status === state.sourceStage);
  }

  if (state.sourceView === "effective") {
    const dedicatedCount = visible.filter((row) => Boolean(row.company_id)).length;
    const sharedCount = visible.length - dedicatedCount;
    els.sourceViewTitle.textContent = "本轮有效来源";
    els.sourceStageCount.textContent = `显示 ${visible.length} 个日报贡献入口 · ${dedicatedCount} 专属 / ${sharedCount} 共享`;
  } else {
    els.sourceViewTitle.textContent = "系统已接入入口";
    els.sourceStageCount.textContent = `显示 ${visible.length} / ${healthRows.length} 个真实运行入口`;
  }
  renderRuntimeSourceBoard(visible);
}

function renderSourceExperiments() {
  if (!els.sourceExperimentGrid) return;
  const payload = state.payload?.source_experiments || {};
  const experiments = payload.experiments || [];
  const statusMeta = {
    blocked_public_demo: { label: "公共实例受限", className: "blocked" },
    replaced_by_direct: { label: "已有直连替代", className: "replaced" },
    active_alternative: { label: "替代方案运行中", className: "active" },
    deferred_server: { label: "需服务器，暂缓", className: "deferred" },
  };
  const running = experiments.filter((item) => item.status === "active_alternative").length;
  const replaced = experiments.filter((item) => item.status === "replaced_by_direct").length;
  const blocked = experiments.filter((item) => item.status === "blocked_public_demo").length;
  els.sourceExperimentSummary.textContent = `${experiments.length} 项 · ${running + replaced} 项已有可运行方案`;
  els.sourceExperimentPrinciple.innerHTML = `
    <strong>接入结论</strong>
    <span>${escapeHtml(payload.principle || "试验来源与生产来源分开记录。")}</span>
    <small>${blocked ? `${blocked} 项公共服务受限，未计入运行来源` : "没有未说明的阻断项"}</small>
  `;
  els.sourceExperimentGrid.innerHTML = experiments.map((experiment) => {
    const meta = statusMeta[experiment.status] || { label: experiment.status, className: "deferred" };
    const replacementCount = experiment.replacement_source_ids?.length || 0;
    return `
      <article class="source-experiment-card status-${escapeAttr(meta.className)}">
        <header>
          <div><span>${escapeHtml(experiment.provider)}</span><strong>${escapeHtml(experiment.capability)}</strong></div>
          <b>${escapeHtml(meta.label)}</b>
        </header>
        <p>${escapeHtml(experiment.result)}</p>
        <div class="source-experiment-decision"><span>处理决定</span><strong>${escapeHtml(experiment.decision)}</strong></div>
        <footer><span>${escapeHtml(experiment.target)}</span><small>${escapeHtml(experiment.tested_at || "")}${replacementCount ? ` · ${replacementCount} 个替代入口` : ""}</small></footer>
      </article>
    `;
  }).join("");
}

function renderOfficialSourceGroups(sources) {
  return renderGroupedSources(
    sources,
    officialContentGroups,
    "contentGroup",
    `
      <div><span>主分类</span><strong>内容是什么</strong><small>新闻、产品、活动、技术、视频</small></div>
      <div><span>辅助标签</span><strong>从哪里获得</strong><small>公司、地区、直接 RSS 或索引 RSS</small></div>
    `,
  );
}

function renderWireMediaGroups(sources) {
  return renderGroupedSources(
    sources,
    wireMediaGroups,
    "mediaGroup",
    `
      <div><span>主分类</span><strong>来源扮演什么角色</strong><small>新闻稿平台、行业编辑媒体、技术媒体</small></div>
      <div><span>辅助标签</span><strong>监控谁与怎么获取</strong><small>公司、竞品、地区、RSS 或定向查询</small></div>
    `,
  );
}

function renderMarketChannelGroups(sources) {
  return renderGroupedSources(
    sources,
    marketChannelGroups,
    "marketGroup",
    `
      <div><span>发现层</span><strong>从哪里发现活动与公司</strong><small>行业生态平台、展会官网、合作网络</small></div>
      <div><span>匹配层</span><strong>平台不是公司</strong><small>抓取后再匹配公司池中的公司别名</small></div>
      <div><span>去重层</span><strong>多个链接合并成一个事件</strong><small>标题、日期、报名 URL 与 Webinar ID</small></div>
    `,
  );
}

function renderSocialContentGroups(sources) {
  return renderGroupedSources(
    sources,
    socialContentGroups,
    "socialGroup",
    `
      <div><span>内容用途</span><strong>这个平台提供什么信号</strong><small>视频、活动、合作、招聘或地区传播</small></div>
      <div><span>获取边界</span><strong>公开可看不等于可自动抓取</strong><small>只自动接入稳定公开页面或 Feed</small></div>
      <div><span>推送规则</span><strong>社交内容不直接当新闻</strong><small>视频归档；重大合作与新活动经核对后升级</small></div>
    `,
  );
}

function renderResearchSignalGroups(sources) {
  return renderGroupedSources(
    sources,
    researchSignalGroups,
    "researchGroup",
    `
      <div><span>事实类型</span><strong>论文、试验、监管、申报分开展示</strong><small>不同事实不能用同一套新闻评分</small></div>
      <div><span>公司关系</span><strong>确认公司在记录中的角色</strong><small>作者机构、Sponsor、Collaborator 或申报主体</small></div>
      <div><span>推送边界</span><strong>研究数据默认归档</strong><small>只有新的监管风险或关键里程碑才升级</small></div>
    `,
  );
}

function renderRestrictedSourceGroups(sources) {
  return renderGroupedSources(
    sources,
    restrictedSourceGroups,
    "restrictedGroup",
    `
      <div><span>判断顺序</span><strong>先看权限，再看技术</strong><small>账号、版权、robots 和服务条款优先</small></div>
      <div><span>记录方式</span><strong>保留来源档案但不发起任务</strong><small>写清阻断原因、可接受替代和复评条件</small></div>
      <div><span>红线</span><strong>不绕过平台限制</strong><small>不共享 Cookie、不破验证码、不抓私域与个人数据</small></div>
    `,
  );
}

function renderCommercialServiceGroups(sources) {
  return renderGroupedSources(
    sources,
    commercialServiceGroups,
    "serviceGroup",
    `
      <div><span>第一阶段</span><strong>开放数据先覆盖基础事实</strong><small>Crossref、ClinicalTrials.gov、PMDA、openFDA</small></div>
      <div><span>采购条件</span><strong>缺口可量化后再买</strong><small>覆盖率、延迟、授权、导出和维护成本</small></div>
      <div><span>预算结果</span><strong>买稳定能力，不买重复数据</strong><small>先小范围试用，再按业务场景评估续费</small></div>
    `,
  );
}

function renderGroupedSources(sources, groupDefinitions, groupKey, axisContent) {
  const groups = groupDefinitions
    .map((group) => ({
      ...group,
      sources: sources.filter((source) => source[groupKey] === group.id),
    }))
    .filter((group) => group.sources.length);

  return `
    <div class="official-axis-note">
      ${axisContent}
    </div>
    <div class="official-source-groups">
      ${groups
        .map(
          (group) => `
            <section class="official-source-group${group.secondary ? " secondary" : ""}">
              <div class="official-source-group-head">
                <span>${group.number}</span>
                <div>
                  <h4>${escapeHtml(group.title)}</h4>
                  <p>${escapeHtml(group.description)}</p>
                </div>
                <small>${group.sources.length} 个入口</small>
              </div>
              <div class="source-grid">
                ${group.sources.map(renderSourceCard).join("")}
              </div>
            </section>`,
        )
        .join("")}
    </div>`;
}

function renderSourceCard(src) {
  const result = liveSourceResult(src);
  const sourceIds = src.sourceIds || [];
  const focused = state.sourceFocusId && sourceIds.includes(state.sourceFocusId);
  return `
    <article class="source-card${focused ? " source-card-focus" : ""}"${sourceIds.length ? ` data-library-source-ids="${escapeAttr(sourceIds.join(" "))}"` : ""}>
      <div class="source-card-top">
        <strong>${escapeHtml(src.name)}</strong>
        <span class="status-pill ${src.status}">${labelStatus(src.status)}</span>
      </div>
      <div class="source-card-meta">
        ${src.companyTag ? `<span class="company-source-tag">${escapeHtml(src.companyTag)}</span>` : ""}
        ${src.roleTag ? `<span class="role-source-tag">${escapeHtml(src.roleTag)}</span>` : ""}
        ${src.regionTag ? `<span class="region-source-tag">${escapeHtml(src.regionTag)}</span>` : ""}
        <span class="trust-badge trust-${src.trust.toLowerCase().replace(/[^a-e]/g, "")}">可信 ${src.trust}</span>
        <span class="method-tag">${escapeHtml(src.method)}</span>
        ${src.url ? `<span class="url-hint">${escapeHtml(src.url)}</span>` : ""}
      </div>
      <p class="source-card-note">${escapeHtml(src.note)}</p>
      ${result ? `<div class="source-card-result"><span>${src.status === "active" ? "本轮" : "依据"}</span>${escapeHtml(result)}</div>` : ""}
    </article>`;
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
  const sitemapRow = rows.find((row) => row.snapshot_count);
  if (!total && sitemapRow?.initial_snapshot) {
    return `基线已建立 · 监控 ${sitemapRow.snapshot_count} 个 URL · 本轮新增 0`;
  }
  if (!total && sitemapRow) {
    return `持续监控 ${sitemapRow.snapshot_count} 个 URL · 本轮新增 ${sitemapRow.new_urls || 0}`;
  }
  if (!total) return `监控正在运行，时效窗口内 0 条，最后内容：${latest}`;
  return `候选 ${total} 条 · 日报 ${selected} 条 · 归档 ${archive} 条 · 最后内容 ${latest}`;
}

const signalWorkflowDefinitions = {
  new: { label: "新发现", className: "new" },
  reviewed: { label: "已阅读", className: "reviewed" },
  confirmed: { label: "已核验", className: "confirmed" },
  actioned: { label: "已分配行动", className: "actioned" },
  archived: { label: "已归档", className: "archived" },
};

function getSignalWorkflowStatus(item) {
  const stored = state.signalWorkflow[item.id]?.status;
  return signalWorkflowDefinitions[stored] ? stored : item.workflow_status || "new";
}

function getTimelineProfile(companyId) {
  const profile = (state.payload?.company_timelines || []).find(
    (row) => row.company_id === companyId,
  );
  if (profile) return profile;
  const items = (state.payload?.items || []).filter((item) =>
    (item.matched_company_ids || []).includes(companyId),
  );
  return {
    company_id: companyId,
    item_count: items.length,
    selected_count: items.filter((item) => ["daily", "immediate"].includes(item.tier)).length,
    high_relevance_count: items.filter((item) => item.acro_relevance?.level === "high").length,
    source_count: new Set(items.flatMap((item) => item.source_ids || [item.source_id])).size,
    latest_activity: items.map((item) => item.published || item.event_start_at || "").sort().at(-1) || "",
    event_mix: {},
    top_topics: [],
    top_actions: [],
    item_ids: items.map((item) => item.id),
  };
}

function renderCompanyTimeline() {
  if (!els.companyTimelineSelect || !state.payload) return;
  const companies = sortCompaniesForDisplay(state.payload.companies || []);
  if (!companies.some((company) => company.id === state.timelineCompany)) {
    state.timelineCompany = companies[0]?.id || "acro";
  }
  const previousOptions = [...els.companyTimelineSelect.options].map((option) => option.value);
  const currentOptions = companies.map((company) => company.id);
  if (previousOptions.join("|") !== currentOptions.join("|")) {
    els.companyTimelineSelect.innerHTML = companies.map((company) => `
      <option value="${escapeAttr(company.id)}">${escapeHtml(compactCompanyName(company))}</option>
    `).join("");
  }
  els.companyTimelineSelect.value = state.timelineCompany;
  els.timelineScopeControl.querySelectorAll("[data-timeline-scope]").forEach((button) => {
    button.classList.toggle("active", button.dataset.timelineScope === state.timelineScope);
  });

  const company = companies.find((row) => row.id === state.timelineCompany) || companies[0];
  if (!company) return;
  const profile = getTimelineProfile(company.id);
  const itemMap = new Map((state.payload.items || []).map((item) => [item.id, item]));
  let items = (profile.item_ids || []).map((id) => itemMap.get(id)).filter(Boolean);
  if (state.timelineScope === "selected") {
    items = items.filter((item) => ["daily", "immediate"].includes(item.tier));
  }
  items.sort((a, b) => {
    const dateDelta = String(b.event_start_at || b.published_at || b.published || "")
      .localeCompare(String(a.event_start_at || a.published_at || a.published || ""));
    return dateDelta || (Number(b.score) || 0) - (Number(a.score) || 0);
  });
  const visibleItems = items.slice(0, 80);
  const sourceBacked = items.filter((item) => item.evidence?.verification_status === "source_backed").length;
  els.companyTimelineTimestamp.textContent = `${compactCompanyName(company)} · 更新 ${formatDateTime(state.payload.generated_at)}`;
  els.companyTimelineMetrics.innerHTML = `
    <article><span>累计信号</span><strong>${profile.item_count || 0}</strong><small>当前数据窗口全部记录</small></article>
    <article><span>进入日报</span><strong>${profile.selected_count || 0}</strong><small>通过相关性与动作门槛</small></article>
    <article><span>运行来源</span><strong>${profile.source_count || 0}</strong><small>实际命中过该公司的入口</small></article>
    <article><span>本页证据充分</span><strong>${sourceBacked}</strong><small>摘要包含独立原始信息</small></article>
  `;

  const topicMarkup = profile.top_topics?.length
    ? profile.top_topics.map((topic) => `<span>${escapeHtml(topic.label)} <b>${topic.count}</b></span>`).join("")
    : "<small>当前还没有稳定形成的结构化主题。</small>";
  const actionMarkup = profile.top_actions?.length
    ? profile.top_actions.map((action) => `<li><span>${escapeHtml(action.label)}</span><b>${action.count}</b></li>`).join("")
    : "<li><span>暂无建议动作统计</span><b>0</b></li>";
  els.companyLivingProfile.innerHTML = `
    <header><span>${escapeHtml(company.role_label || "公司档案")}</span><h3>${escapeHtml(company.display_name)}</h3></header>
    <div class="living-profile-block"><span>监测重点</span><p>${escapeHtml(company.monitoring_focus || "尚未配置监测重点。")}</p></div>
    <div class="living-profile-block"><span>持续出现的主题</span><div class="living-topic-list">${topicMarkup}</div></div>
    <div class="living-profile-block"><span>建议动作分布</span><ul>${actionMarkup}</ul></div>
    <footer><span>最近动态</span><strong>${escapeHtml(profile.latest_activity || "暂无日期")}</strong></footer>
  `;

  if (!visibleItems.length) {
    els.companyTimelineList.innerHTML = `<div class="empty">${state.timelineScope === "selected" ? "该公司暂时没有达到日报门槛的信号，可切换到“全部记录”查看归档。" : "该公司当前没有命中记录。"}</div>`;
    return;
  }
  els.companyTimelineList.innerHTML = visibleItems.map((item) => {
    const evidence = item.evidence || {};
    const workflow = signalWorkflowDefinitions[getSignalWorkflowStatus(item)] || signalWorkflowDefinitions.new;
    const date = item.event_start_at || item.published_at || item.published || "日期待核对";
    return `
      <article class="timeline-entry">
        <div class="timeline-rail"><i></i><time>${escapeHtml(date)}</time></div>
        <div class="timeline-entry-body">
          <header>
            <div><span>${escapeHtml(labelBusinessEventLanguage(getBusinessEventType(item), true))}</span><b>${item.score} 分</b></div>
            <small class="workflow-badge status-${escapeAttr(workflow.className)}">${escapeHtml(workflow.label)}</small>
          </header>
          <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(getDisplayTitle(item))}</a>
          <p>${escapeHtml(firstReadableSentence(getDisplaySummary(item), 150))}</p>
          <footer>
            <span class="evidence-quality ${escapeAttr(evidence.verification_status || "needs_original_check")}">${escapeHtml(evidence.verification_label || "需打开原文核验")}</span>
            <span>${escapeHtml(item.recommended_action?.label || "归档观察")} · ${escapeHtml(item.recommended_action?.owner || "系统")}</span>
          </footer>
        </div>
      </article>
    `;
  }).join("");
  if (items.length > visibleItems.length) {
    els.companyTimelineList.insertAdjacentHTML("beforeend", `<div class="timeline-limit-note">当前显示最新 ${visibleItems.length} 条，共 ${items.length} 条。</div>`);
  }
}

function renderPage() {
  const metricDefinition = overviewMetricDefinitions[state.overviewMetric] || overviewMetricDefinitions.critical;
  const [eyebrow, title] = state.page === "overview-metric"
    ? [pageMeta["overview-metric"][0], metricDefinition.pageTitle]
    : pageMeta[state.page] || pageMeta.overview;
  els.pageEyebrow.textContent = eyebrow;
  els.pageTitle.textContent = title;
  els.toolbar.hidden = !["overview", "signals"].includes(state.page);
  els.pagePanels.forEach((panel) => {
    panel.hidden = panel.dataset.page !== state.page;
  });
  els.pageButtons.forEach((button) => {
    const activePage = state.page === "overview-metric" ? "overview" : state.page;
    button.classList.toggle("active", button.dataset.pageTarget === activePage);
  });
  document.querySelectorAll(".nav-cluster").forEach((cluster) => {
    const containsActive = Boolean(cluster.querySelector("[data-page-target].active"));
    cluster.classList.toggle("contains-active", containsActive);
    if (containsActive) cluster.open = true;
  });
}

function overviewMetricTargetFromHash() {
  const target = window.location.hash.match(/^#overview-metric-([a-z-]+)$/)?.[1] || "";
  return overviewMetricDefinitions[target] ? target : "";
}

function updateOverviewMetricUrl(target, historyMode) {
  if (historyMode === "none") return;
  const hash = target ? `#overview-metric-${target}` : "";
  const url = window.location.pathname + window.location.search + hash;
  const mode = historyMode === "replace" || window.location.hash === hash
    ? "replaceState"
    : "pushState";
  window.history?.[mode]?.({ page: target ? "overview-metric" : "overview", target }, "", url);
}

function openOverviewMetric(target, historyMode = "push") {
  const validTarget = overviewMetricDefinitions[target] ? target : "critical";
  state.page = "overview-metric";
  state.overviewMetric = validTarget;
  renderOverviewScope();
  renderPage();
  updateOverviewMetricUrl(validTarget, historyMode);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeOverviewMetric(historyMode = "replace") {
  state.page = "overview";
  renderPage();
  updateOverviewMetricUrl("", historyMode);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function methodologyTargetFromHash() {
  const target = window.location.hash.match(/^#metric-([a-z-]+)$/)?.[1] || "";
  return methodologyDetailMeta[target] ? target : "";
}

function updateMethodologyUrl(target, historyMode) {
  if (historyMode === "none") return;
  const hash = target ? "#metric-" + target : "#methodology";
  const url = window.location.pathname + window.location.search + hash;
  const mode = historyMode === "replace" || window.location.hash === hash
    ? "replaceState"
    : "pushState";
  window.history?.[mode]?.({ page: "methodology", target }, "", url);
}

function openMethodology(target = "", historyMode = "push") {
  const validTarget = methodologyDetailMeta[target] ? target : "";
  state.page = "methodology";
  state.methodologyDetail = validTarget;
  renderMethodology();
  renderPage();
  updateMethodologyUrl(validTarget, historyMode);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSignals() {
  const filtered = getFilteredItems();
  els.detailSignalCount.innerHTML = state.sourceOutputId !== "all"
    ? `${filtered.length} 条结果 · 来源：${escapeHtml(state.sourceOutputLabel)} · 本轮全部记录 <button type="button" data-clear-source-output>清除来源筛选</button>`
    : `${filtered.length} 条结果`;
  renderSignalCards(els.topSignalList, filtered.slice(0, 5), true);
  renderSignalCards(els.signalList, filtered, false);
}

const intelligenceGroupLabels = {
  targets: "靶点",
  modalities: "疗法 / 技术",
  product_needs: "可能产品需求",
  development_stages: "研发阶段",
  business_actions: "业务动作",
  event_signals: "活动信号",
};

function renderIntelligenceFields(item) {
  const intelligence = item.intelligence || {};
  const populated = Object.entries(intelligenceGroupLabels)
    .map(([key, label]) => ({ key, label, values: intelligence[key] || [] }))
    .filter((group) => group.values.length);
  if (!populated.length) {
    return '<div class="intelligence-empty">六组医药字段暂无明确命中，保留原文归档。</div>';
  }
  return `<div class="intelligence-fields">
    ${populated.map((group) => `
      <div class="intelligence-field field-${group.key}">
        <span>${escapeHtml(group.label)}</span>
        <div>${group.values.map((value) => `<b>${escapeHtml(value)}</b>`).join("")}</div>
      </div>`).join("")}
  </div>`;
}

function renderBusinessInsight(item, compact) {
  const relevance = item.acro_relevance || {
    level: "low",
    score: 0,
    label: "待分析",
    explanation: "暂无结构化业务解释。",
  };
  const action = item.recommended_action || {
    label: "归档观察",
    owner: "系统",
    priority: "low",
    text: "暂不发起业务动作。",
  };
  const isEnglish = state.translationLanguage === "en";
  const translatedAction = translateRecommendedAction(action);
  if (compact) {
    const relevanceLabel = isEnglish ? getRelevanceLabel(item) : relevance.label || "待分析";
    const actionLabel = isEnglish ? translatedAction.label : action.label || "归档观察";
    const actionOwner = isEnglish ? translatedAction.owner : action.owner || "待确认";
    const explanation = firstReadableSentence(getRelevanceExplanation(item), 74);
    return `<div class="business-insight-strip relevance-${escapeAttr(relevance.level || "low")}">
      <button class="strip-score" type="button" data-methodology-target="acro-relevance" aria-label="ACRO 相关性 ${Number(relevance.score) || 0} 分，查看计算规则"><strong>${Number(relevance.score) || 0}</strong><span>ACRO ${escapeHtml(relevanceLabel)}</span></button>
      <p>${escapeHtml(explanation)}</p>
      <div class="strip-action"><strong>${escapeHtml(actionLabel)}</strong><span>${escapeHtml(actionOwner)}</span></div>
    </div>`;
  }
  return `<div class="business-insight relevance-${escapeAttr(relevance.level || "low")}${compact ? " is-compact" : ""}">
    <div class="business-insight-copy">
      <div class="business-insight-title">
        <span>${isEnglish ? `ACRO ${escapeHtml(getRelevanceLabel(item))}` : `ACRO ${escapeHtml(relevance.label || "待分析")}`}</span>
        <button class="business-insight-score" type="button" data-methodology-target="acro-relevance" aria-label="ACRO 相关性 ${Number(relevance.score) || 0} 分，查看计算规则">${Number(relevance.score) || 0}</button>
      </div>
      <p>${escapeHtml(getRelevanceExplanation(item))}</p>
    </div>
    <div class="recommended-action priority-${escapeAttr(action.priority || "low")}">
      <span>${isEnglish ? "Suggested action" : "建议动作"}</span>
      <div><strong>${escapeHtml(isEnglish ? translatedAction.label : action.label || "归档观察")}</strong><small>${escapeHtml(isEnglish ? translatedAction.owner : action.owner || "待确认")}</small></div>
      <p>${escapeHtml(isEnglish ? translatedAction.text : action.text || "暂不发起业务动作。")}</p>
    </div>
  </div>`;
}

function normalizeSummaryForCompare(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+-\s+[^-]{2,80}$/g, "")
    .replace(/[^\w一-鿿ぁ-んァ-ン]+/g, "");
}

function isLowInformationSummary(summary, title) {
  const summaryNorm = normalizeSummaryForCompare(summary);
  const titleNorm = normalizeSummaryForCompare(title);
  if (!summaryNorm) return true;
  if (summaryNorm === titleNorm) return true;
  if (titleNorm && (summaryNorm.startsWith(titleNorm) || titleNorm.startsWith(summaryNorm))) return true;
  return summaryNorm.length < 28;
}

function firstReadableSentence(value, maxLength = 120) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+[^-]{2,80}$/g, "")
    .trim();
  if (!text) return "";
  const first = text.split(/(?<=[。.!！？])\s+/)[0].trim();
  return first.length > maxLength ? `${first.slice(0, maxLength).replace(/[，,、；;:：\s]+$/g, "")}...` : first;
}

function getStructuredFocus(item) {
  const intelligence = item.intelligence || {};
  return [
    ...(intelligence.targets || []),
    ...(intelligence.modalities || []),
    ...(intelligence.product_needs || []),
  ].filter(Boolean).slice(0, 4).join("、");
}

function buildChineseSignalTitle(item) {
  const company = item.matched_companies?.length
    ? shortCompanyName(item.matched_companies[0])
    : "行业公开信号";
  const eventLabel = labelBusinessEvent(getBusinessEventType(item), true);
  const focus = getStructuredFocus(item);
  if (focus) return `${company}：${focus}相关${eventLabel}信号`;
  return `${company}：${eventLabel}信号`;
}

function getDisplayTitle(item) {
  if (state.translationLanguage === "zh") {
    return String(item.title_zh || "").trim() || buildChineseSignalTitle(item);
  }
  return item.title || buildClientBusinessSummaryEn(item);
}

function getSourceLabelText(item) {
  const labels = (item.source_labels || [item.source_label]).filter(Boolean);
  const text = labels.join(" + ");
  if (state.translationLanguage !== "zh") return text;
  return text
    .replace(/company pool indexed RSS/gi, "公司池索引 RSS")
    .replace(/indexed RSS/gi, "索引 RSS")
    .replace(/\bbackup\b/gi, "备份")
    .replace(/official news/gi, "官网新闻")
    .replace(/official site/gi, "官网")
    .replace(/official Insights/gi, "官方 Insights")
    .replace(/Google News RSS/g, "Google News RSS")
    .replace(/Bing News RSS/g, "Bing News RSS");
}

function buildClientBusinessSummary(item) {
  if (state.translationLanguage === "en") return buildClientBusinessSummaryEn(item);
  const company = item.matched_companies?.length ? item.matched_companies.slice(0, 2).join(" / ") : "行业公开信号";
  const eventLabel = labelBusinessEvent(getBusinessEventType(item), true);
  const role = getItemRole(item);
  const focus = getStructuredFocus(item);
  let opening = "";
  if (role === "self") {
    opening = `${company}更新了${eventLabel}相关内容`;
  } else if (role === "competitor") {
    opening = `竞品 ${company} 出现${eventLabel}信号`;
  } else if (role === "customer") {
    opening = `客户或潜在账户 ${company} 出现${eventLabel}信号`;
  } else if ((item.signal_type || "news") === "event") {
    opening = "这是一条市场活动或生态平台信号";
  } else {
    opening = `这是一条${eventLabel}类公开信息`;
  }
  opening += focus ? `，重点涉及${focus}。` : `，主题为“${firstReadableSentence(item.title, 90)}”。`;

  const rawPoint = !isLowInformationSummary(item.summary, item.title)
    ? `原始摘要要点：${firstReadableSentence(item.summary, 110)}。`
    : "";
  const relevance = item.acro_relevance?.explanation || "";
  const action = item.recommended_action
    ? `建议按“${item.recommended_action.label || "归档观察"}”处理：${item.recommended_action.text || ""}`
    : "";
  return [opening, rawPoint, relevance, action].filter(Boolean).join(" ").slice(0, 280);
}

function getDisplaySummary(item) {
  if (state.translationLanguage === "en") {
    return item.ai_summary_en || buildClientBusinessSummaryEn(item);
  }
  const aiSummary = String(item.ai_summary || "").trim();
  if (aiSummary) return aiSummary;
  return buildClientBusinessSummary(item) || (
    isLowInformationSummary(item.summary, item.title)
      ? "暂无可用摘要，建议打开原文核对。"
      : item.summary
  );
}

function renderBusinessSummary(item, compact) {
  const isLlm = item.summary_method === "llm";
  const isManual = item.summary_method === "manual_ai";
  const hasManualSummaryInCurrentLanguage = isManual && (
    state.translationLanguage === "zh" || Boolean(String(item.ai_summary_en || "").trim())
  );
  const label = state.translationLanguage === "en"
    ? hasManualSummaryInCurrentLanguage ? "AI intelligence brief" : isLlm ? "API model summary" : "Rule brief"
    : hasManualSummaryInCurrentLanguage ? "AI 情报精读" : isLlm ? "API 模型摘要" : "规则提要";
  const text = getDisplaySummary(item);
  const summaryClass = isLlm || hasManualSummaryInCurrentLanguage ? "ai" : "rule";
  if (!compact) {
    return `<p class="summary business-summary summary-${summaryClass}"><span>${escapeHtml(label)}</span>${escapeHtml(text)}</p>`;
  }
  const preview = firstReadableSentence(text, state.translationLanguage === "en" ? 110 : 72) || text;
  const expandLabel = state.translationLanguage === "en" ? "Details" : "展开";
  return `<details class="business-summary-toggle summary-${summaryClass}">
    <summary><span>${escapeHtml(label)}</span><b>${escapeHtml(preview)}</b><i>${escapeHtml(expandLabel)}</i></summary>
    <p>${escapeHtml(text)}</p>
  </details>`;
}

function renderEvidenceBlock(item) {
  const evidence = item.evidence || {};
  const kind = evidence.kind || "index";
  const verification = evidence.verification_status || "needs_original_check";
  const excerpt = evidence.source_excerpt || "当前来源没有提供独立摘要，页面判断主要来自标题、公司身份和结构化规则。";
  const relatedCount = evidence.related_urls?.length || item.related_urls?.length || 1;
  return `
    <div class="signal-evidence-block">
      <div class="signal-evidence-head">
        <span class="evidence-kind kind-${escapeAttr(kind)}">${escapeHtml(evidence.kind_label || "聚合索引线索")}</span>
        <span class="evidence-quality ${escapeAttr(verification)}">${escapeHtml(evidence.verification_label || "需打开原文核验")}</span>
        <a href="${escapeAttr(evidence.primary_url || item.url)}" target="_blank" rel="noreferrer">打开原文</a>
      </div>
      <p>${escapeHtml(excerpt)}</p>
      <small>${escapeHtml(getSourceLabelText(item))} · ${relatedCount} 个关联入口 · ${escapeHtml(evidence.summary_basis === "source_excerpt" ? "摘要来自原始内容" : "摘要来自标题与规则")}</small>
    </div>
  `;
}

function renderSignalWorkflow(item) {
  const current = getSignalWorkflowStatus(item);
  return `
    <label class="signal-workflow-control">
      <span>本机处理状态<small>仅保存在当前浏览器</small></span>
      <select class="signal-workflow-select" data-signal-workflow-id="${escapeAttr(item.id)}" aria-label="更新信号处理状态">
        ${Object.entries(signalWorkflowDefinitions).map(([status, meta]) => `
          <option value="${escapeAttr(status)}"${status === current ? " selected" : ""}>${escapeHtml(meta.label)}</option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderSignalDecisionDetails(item) {
  return `
    <details class="signal-decision-details">
      <summary><span>证据与结构化字段</span><small>展开查看原文依据、六组字段和处理状态</small><i>⌄</i></summary>
      <div class="signal-decision-body">
        ${renderEvidenceBlock(item)}
        ${renderIntelligenceFields(item)}
        <div class="signal-review-row">
          <div><span>进入当前层级的原因</span><ul class="reason-list">${item.reasons.slice(0, 4).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></div>
          ${renderSignalWorkflow(item)}
        </div>
      </div>
    </details>
  `;
}

function buildClientBusinessSummaryEn(item) {
  const company = item.matched_companies?.length ? item.matched_companies.slice(0, 2).join(" / ") : "an industry signal";
  const eventLabel = labelBusinessEventLanguage(getBusinessEventType(item), false, "en").toLowerCase();
  const role = getItemRole(item);
  const focus = getStructuredFocus(item);
  let opening = "";
  if (role === "self") {
    opening = `${company} has a new ${eventLabel} update`;
  } else if (role === "competitor") {
    opening = `Competitor ${company} shows a ${eventLabel} signal`;
  } else if (role === "customer") {
    opening = `Customer-pool company ${company} shows a ${eventLabel} signal`;
  } else if ((item.signal_type || "news") === "event") {
    opening = "This is a market activity or ecosystem platform signal";
  } else {
    opening = `This is a public ${eventLabel} signal`;
  }
  opening += focus ? `, with focus on ${focus}.` : `, based on the original headline: "${firstReadableSentence(item.title, 110)}."`;

  const rawPoint = !isLowInformationSummary(item.summary, item.title)
    ? `Original-source point: ${firstReadableSentence(item.summary, 130)}.`
    : "";
  const relevance = getRelevanceExplanation(item, "en");
  const action = item.recommended_action ? translateRecommendedAction(item.recommended_action) : null;
  const actionText = action ? `Suggested action: ${action.text}` : "";
  return [opening, rawPoint, relevance, actionText].filter(Boolean).join(" ").slice(0, 360);
}

function getRelevanceLabel(item, language = state.translationLanguage) {
  const level = item.acro_relevance?.level || "low";
  if (language !== "en") return item.acro_relevance?.label || "待分析";
  return {
    high: "high relevance",
    medium: "medium relevance",
    low: "low relevance",
  }[level] || "pending review";
}

function getRelevanceExplanation(item, language = state.translationLanguage) {
  if (language !== "en") return item.acro_relevance?.explanation || "暂无结构化业务解释。";
  const role = getItemRole(item);
  const intelligence = item.intelligence || {};
  const focus = getStructuredFocus(item);
  const needs = (intelligence.product_needs || []).slice(0, 2).join(", ");
  const stages = (intelligence.development_stages || []).slice(0, 1).join(", ");
  if (role === "self") {
    return "This is an ACRO-owned public update. Check the external messaging and decide whether it should be repurposed for secondary promotion or internal alignment.";
  }
  if (role === "customer") {
    return `A customer-pool company shows ${stages || "a new R&D or market"} signal. Review whether it implies demand for ${needs || "ACRO-related products or services"}.`;
  }
  if (role === "competitor") {
    return `A competitor is moving around ${focus || labelBusinessEventLanguage(getBusinessEventType(item), false, "en").toLowerCase()}. Compare product positioning, messaging, and regional coverage.`;
  }
  if (needs && (stages || (intelligence.business_actions || []).length)) {
    return `The signal may imply demand for ${needs}. Confirm the company identity, project stage, and region before treating it as a sales lead.`;
  }
  if ((intelligence.event_signals || []).length) {
    return "This event-related signal may be useful for registration, speaking, sponsorship, or partnering evaluation.";
  }
  if (focus) {
    return `The signal matches ${focus}. It is useful for trend monitoring, but no clear ACRO product demand is confirmed yet.`;
  }
  return "No clear ACRO product demand, customer action, or priority technology signal has been detected. Keep it as archive evidence.";
}

function translateRecommendedAction(action = {}) {
  const byType = {
    content: {
      label: "Messaging follow-up",
      owner: "Marketing operations",
      text: "Verify the official messaging and decide whether to reuse it for LinkedIn, newsletter, or internal sales material.",
    },
    customer: {
      label: "Customer needs follow-up",
      owner: "BD / Sales",
      text: "Review the customer profile and past interactions, then check whether there is a relevant product need or timing window.",
    },
    competitor: {
      label: "Competitor comparison",
      owner: "Product marketing",
      text: "Compare the competitor's product, technology, partnership, and regional moves against ACRO positioning.",
    },
    lead: {
      label: "Prospect identification",
      owner: "BD / Regional marketing",
      text: "Confirm the company identity, pipeline stage, and region, then decide whether to add it to the prospect pool.",
    },
    event: {
      label: "Event value review",
      owner: "Regional marketing",
      text: "Check the date, participating companies, and agenda to assess registration, speaking, sponsorship, or partnering value.",
    },
    regulatory: {
      label: "Regulatory impact check",
      owner: "Product / Regulatory",
      text: "Verify the original regulatory document, scope, and affected products before internal escalation.",
    },
    trend: {
      label: "Technology trend watch",
      owner: "Product marketing",
      text: "Add it to target and technology trend tracking until a clearer pipeline, partnership, or demand signal appears.",
    },
    archive: {
      label: "Archive watch",
      owner: "System",
      text: "No business action is required now. Keep it as evidence for future trend and company-profile analysis.",
    },
  };
  return byType[action.type] || {
    label: action.label || "Review",
    owner: action.owner || "TBD",
    text: action.text || "Review the original source before taking action.",
  };
}

function renderSignalCards(container, items, compact) {
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    const customerEmpty = state.role === "customer" && !(getJapanAccountData().accounts || []).length;
    container.innerHTML = `<div class="empty">${
      customerEmpty
        ? "账户目录尚未导入，因此不能把‘未接入’解释成‘没有客户信号’。"
        : "当前筛选条件下没有需要展示的信号。"
    }</div>`;
    return;
  }
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  for (const item of items) {
    const card = document.createElement("article");
    const workflowStatus = getSignalWorkflowStatus(item);
    card.className = `signal-card${compact ? " compact" : ""} workflow-${escapeAttr(workflowStatus)}`;
    const fb = state.feedback[item.id];
    const fbClass = fb ? `voted-${fb.value}` : "";
    const role = getItemRole(item, companyRoles);
    const region = inferItemRegion(item);
    const displayTitle = getDisplayTitle(item);
    const showOriginalTitle = state.translationLanguage === "zh" && displayTitle !== item.title;
    card.innerHTML = `
      <div class="signal-top">
        <div class="signal-title-stack">
          <a class="signal-title" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(displayTitle)}</a>
          ${showOriginalTitle ? `<p class="original-title"><span>原文标题</span>${escapeHtml(item.title)}</p>` : ""}
        </div>
        <button class="score" type="button" data-methodology-target="news-score" aria-label="信息筛选分 ${item.score}，查看计算规则">${item.score}</button>
      </div>
      <div class="meta-row">
        <span class="tag ${item.tier}">${labelTier(item.tier)}</span>
        <span class="tag role-tag role-${role}">${labelRole(role)}</span>
        <span class="tag region-tag">${escapeHtml(labelRegion(region))}</span>
        <span class="tag type-tag">${labelSignalType(item.signal_type || "news")}</span>
        <span class="tag business-event-tag">${labelBusinessEventLanguage(getBusinessEventType(item), true)}</span>
        <span class="tag company-match ${
          item.matched_companies?.length ? "matched" : "unmatched"
        }">${escapeHtml(
          item.matched_companies?.length
            ? `命中：${item.matched_companies.join(" / ")}`
            : "未命中公司池",
        )}</span>
        <span class="tag date-tag ${item.event_start_at ? "event-date" : "published-date"}">${escapeHtml(getItemDateLabel(item))}</span>
        <span class="tag source-origin">${escapeHtml(getSourceLabelText(item))}</span>
      </div>
      ${renderBusinessSummary(item, compact)}
      ${renderBusinessInsight(item, compact)}
      ${compact ? "" : renderSignalDecisionDetails(item)}
      ${compact ? "" : `
      <div class="feedback-row ${fbClass}">
        <span class="feedback-label">这条有用吗？</span>
        <button class="fb-btn fb-up${fb && fb.value === "up" ? " active" : ""}" data-id="${item.id}" data-action="up" title="有用">有用</button>
        <button class="fb-btn fb-down${fb && fb.value === "down" ? " active" : ""}" data-id="${item.id}" data-action="down" title="无用">无用</button>
        ${fb ? '<span class="fb-thanks">已反馈</span>' : ""}
      </div>`}
    `;
    container.appendChild(card);
  }
  if (compact) return;
  container.querySelectorAll(".fb-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const current = state.feedback[id];
      const newValue = current && current.value === action ? null : action;
      state.feedback = saveFeedback(id, newValue);
      renderSignals();
      if (state.page === "overview-metric") {
        const scoped = getFilteredItems();
        const companyRoles = new Map(
          (state.payload.companies || []).map((company) => [company.id, company.business_role]),
        );
        renderOverviewMetricDetail(scoped, companyRoles);
      }
    });
  });
  container.querySelectorAll(".signal-workflow-select").forEach((select) => {
    select.addEventListener("change", () => {
      state.signalWorkflow = saveSignalWorkflow(select.dataset.signalWorkflowId, select.value);
      renderSignals();
      renderCompanyTimeline();
      if (state.page === "overview-metric") {
        const scoped = getFilteredItems();
        const companyRoles = new Map(
          (state.payload.companies || []).map((company) => [company.id, company.business_role]),
        );
        renderOverviewMetricDetail(scoped, companyRoles);
      }
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
    for (const sourceLabel of item.source_labels || [item.source_label]) {
      sourceMix[sourceLabel] = (sourceMix[sourceLabel] || 0) + 1;
    }
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
    event: "活动 / 生态",
    video: "视频",
    filing: "公司公告",
    regulatory: "监管风险",
    funding: "研发资助 / 政策",
    research: "论文研究",
    clinical_trial: "临床试验",
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
  const rows = getSourceHealthRows();
  const errors = rows.filter((row) => row.status === "error");
  const productiveCount = rows.filter((row) => row.status === "productive").length;
  const archiveCount = rows.filter((row) => row.status === "archive_only").length;
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const quietCount = rows.filter((row) => row.status === "quiet").length;
  els.healthStatus.textContent = `${productiveCount} 有效 · ${archiveCount} 仅归档 · ${quietCount} 无内容 · ${errors.length} 异常${pendingCount ? ` · ${pendingCount} 待配置` : ""}`;

  if (!els.healthList) return;
  if (errors.length === 0) {
    els.healthList.innerHTML = `<div class="health-ok">抓取入口无异常 · ${quietCount} 个本轮暂无内容 · ${pendingCount} 个待配置</div>`;
    return;
  }

  els.healthList.innerHTML = errors
    .map((row) => {
      const sourceId = row.source_id;
      const message = row.error || row.note || "抓取异常";
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
        scope: item.company,
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

function getCompanyScopedHealthRows(rows, company) {
  if (!company) return rows;
  const coverageIds = new Set(getCoverageSourceIds(getCompanyCoverageProfile(company.id)));
  const companyRows = rows.filter((row) =>
    row.company_id === company.id ||
    (row.scope || row.company) === company.display_name ||
    coverageIds.has(row.source_id),
  );

  return companyRows.map((row) => {
    const items = (state.payload.items || []).filter((item) =>
      (item.matched_company_ids || []).includes(company.id) &&
      (item.source_ids || [item.source_id]).includes(row.source_id),
    );
    const immediate = items.filter((item) => item.tier === "immediate").length;
    const daily = items.filter((item) => item.tier === "daily").length;
    const archive = items.filter((item) => item.tier === "archive").length;
    const lastPublished = items.map((item) => item.published).filter(Boolean).sort().at(-1) || "";
    let status = row.status;
    if (!["error", "pending"].includes(status)) {
      status = immediate + daily > 0 ? "productive" : items.length ? "archive_only" : "quiet";
    }
    return {
      ...row,
      scope: company.display_name,
      total: items.length,
      immediate,
      daily,
      archive,
      selected_rate: items.length ? Math.round(((immediate + daily) / items.length) * 100) : 0,
      last_published: lastPublished,
      status,
      note: row.company_id === company.id
        ? row.note
        : `共享来源在 ${company.display_name} 范围内的实际命中。`,
    };
  });
}

function renderSourceHealthPage() {
  const rows = getSourceHealthRows();
  const companies = [...new Set(rows.map((row) => row.scope || row.company).filter(Boolean))].sort();
  const previousCompany = els.healthCompanyFilter.value || state.healthCompany;
  els.healthCompanyFilter.innerHTML = '<option value="all">全部监测范围</option>';
  for (const company of companies) {
    const option = document.createElement("option");
    option.value = company;
    option.textContent = company;
    els.healthCompanyFilter.appendChild(option);
  }
  state.healthCompany = companies.includes(previousCompany) ? previousCompany : "all";
  els.healthCompanyFilter.value = state.healthCompany;

  els.healthGeneratedAt.textContent = `本轮运行 ${formatDateTime(state.payload.generated_at)}`;
  const selectedCompany = (state.payload.companies || [])
    .find((company) => company.display_name === state.healthCompany);
  const metricRows = selectedCompany
    ? getCompanyScopedHealthRows(rows, selectedCompany)
    : rows.filter((row) =>
        state.healthCompany === "all" || (row.scope || row.company) === state.healthCompany,
      );

  const operationalStatus = (row) => row.operational_status || (
    row.status === "error" ? "error" : row.status === "pending" ? "not_running" : "reachable"
  );
  els.healthMetricTracked.textContent = metricRows.filter(
    (row) => operationalStatus(row) !== "not_running",
  ).length;
  els.healthMetricProducing.textContent = metricRows.filter((row) => row.total > 0).length;
  els.healthMetricSelected.textContent = metricRows.filter((row) => row.immediate + row.daily > 0).length;
  const quietCount = metricRows.filter((row) => row.status === "quiet").length;
  const pendingCount = metricRows.filter((row) => row.status === "pending").length;
  const errorCount = metricRows.filter((row) => row.status === "error").length;
  els.healthMetricAttention.textContent = errorCount;
  els.healthAttentionDetail.textContent = `${pendingCount} 个待配置 · ${quietCount} 个无命中不算异常`;

  const visible = metricRows
    .filter((row) => state.healthStatus === "all" || row.status === state.healthStatus)
    .sort((a, b) => {
      const order = { error: 0, pending: 1, quiet: 2, archive_only: 3, productive: 4 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.total - a.total;
    });

  const rangeLabel = selectedCompany ? "专属 + 共享覆盖" : "当前监测范围";
  els.healthRowCount.textContent = `显示 ${visible.length} / ${metricRows.length} 个运行入口 · ${rangeLabel} · 需处理的来源优先排在前面`;
  if (!visible.length) {
    els.healthTableBody.innerHTML = '<div class="health-table-empty">当前筛选下没有数据源。</div>';
    return;
  }

  els.healthTableBody.innerHTML = visible
    .map((row) => {
      const selected = row.immediate + row.daily;
      const detail = row.error || row.note || healthStatusDescription(row.status);
      const operation = operationalStatus(row);
      const checkedLabel = row.last_checked
        ? `检查 ${formatDateTime(row.last_checked)}`
        : detail;
      return `<div class="health-table-row" role="row">
        <span class="health-name"><strong>${escapeHtml(row.source_label)}</strong><small>监测范围：${escapeHtml(row.scope || row.company || "跨公司")}</small></span>
        <span><span class="health-type">${escapeHtml(labelSignalType(row.signal_type))}</span><small>${escapeHtml(row.source_type)}</small></span>
        <strong>${row.total}</strong>
        <strong class="health-selected">${selected}</strong>
        <span>${row.archive}</span>
        <span>${row.selected_rate}%</span>
        <span>${escapeHtml(row.last_published || "—")}</span>
        <span class="health-status-cell">
          <span class="health-state operational-${escapeAttr(operation)}">${escapeHtml(operationalStatusLabel(operation))}</span>
          <span class="health-state ${row.status}">${escapeHtml(healthStatusLabel(row.status))}</span>
          <small title="${escapeAttr(detail)}">${escapeHtml(checkedLabel)}</small>
        </span>
      </div>`;
    })
    .join("");
}

function operationalStatusLabel(status) {
  return {
    reachable: "运行正常",
    error: "请求失败",
    not_running: "未发起请求",
  }[status] || status;
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

  const headers = ["标题", "公司命中", "情报类型", "来源", "发布日期", "活动日期", "分数", "分层", "商业事件", "靶点", "疗法技术", "产品需求", "研发阶段", "业务动作", "活动信号", "ACRO相关性", "相关性解释", "建议动作", "负责人", "理由", "摘要方式", "摘要", "URL"];
  const rows = [headers.join(",")];
  for (const item of filtered) {
    const translatedAction = translateRecommendedAction(item.recommended_action || {});
    rows.push(
      [
        csvCell(item.title),
        csvCell(item.company),
        csvCell(labelSignalType(item.signal_type || "news")),
        csvCell((item.source_labels || [item.source_label]).join(" + ")),
        csvCell(item.published_at || ""),
        csvCell(item.event_start_at || ""),
        item.score,
        csvCell(labelTier(item.tier)),
        csvCell(labelBusinessEventLanguage(getBusinessEventType(item))),
        csvCell((item.intelligence?.targets || []).join("; ")),
        csvCell((item.intelligence?.modalities || []).join("; ")),
        csvCell((item.intelligence?.product_needs || []).join("; ")),
        csvCell((item.intelligence?.development_stages || []).join("; ")),
        csvCell((item.intelligence?.business_actions || []).join("; ")),
        csvCell((item.intelligence?.event_signals || []).join("; ")),
        csvCell(getRelevanceLabel(item)),
        csvCell(getRelevanceExplanation(item)),
        csvCell(state.translationLanguage === "en" ? translatedAction.label : item.recommended_action?.label || ""),
        csvCell(state.translationLanguage === "en" ? translatedAction.owner : item.recommended_action?.owner || ""),
        csvCell(item.reasons.slice(0, 3).join("; ")),
        csvCell(item.summary_method === "manual_ai" ? "AI 情报精读" : item.summary_method === "llm" ? "API 模型摘要" : "规则提要"),
        csvCell(getDisplaySummary(item)),
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

function itemIsWithinRange(item, days) {
  if (item.event_start_at) {
    if (item.days_until_event === null || item.days_until_event === undefined || item.days_until_event === "") return true;
    const until = Number(item.days_until_event);
    return Number.isFinite(until) ? until >= -days && until < days : true;
  }
  if (item.age_days === null || item.age_days === undefined || item.age_days === "") return true;
  const age = Number(item.age_days);
  return Number.isFinite(age) ? age >= 0 && age < days : true;
}

function getItemDateLabel(item) {
  if (item.event_start_at) {
    const hasOffset = item.days_until_event !== null && item.days_until_event !== undefined && item.days_until_event !== "";
    const until = Number(item.days_until_event);
    const suffix = hasOffset && Number.isFinite(until)
      ? until > 0 ? ` · ${until} 天后` : until === 0 ? " · 今天" : ` · ${Math.abs(until)} 天前`
      : "";
    return `活动 ${item.event_start_at}${suffix}`;
  }
  return item.published_at || item.published
    ? `发布 ${item.published_at || item.published}`
    : "日期待核对";
}

function getFilteredItems() {
  const query = state.searchQuery.toLowerCase().trim();
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  return state.payload.items
    .filter((item) =>
      state.sourceOutputId !== "all" || itemIsWithinRange(item, state.timeRange),
    )
    .filter((item) =>
      state.sourceOutputId === "all" ||
      (item.source_ids || [item.source_id]).includes(state.sourceOutputId),
    )
    .filter((item) => state.tier === "all" || item.tier === state.tier)
    .filter(
      (item) => state.relevance === "all" || (item.acro_relevance?.level || "low") === state.relevance,
    )
    .filter((item) => state.signalType === "all" || (item.signal_type || "news") === state.signalType)
    .filter(
      (item) =>
        state.company === "all" ||
        (item.matched_companies || [item.company]).includes(state.company),
    )
    .filter((item) => state.role === "all" || getItemRole(item, companyRoles) === state.role)
    .filter((item) => state.region === "all" || inferItemRegion(item) === state.region)
    .filter((item) => state.category === "all" || getBusinessEventType(item) === state.category)
    .filter((item) => {
      if (!query) return true;
      const intelligenceText = Object.values(item.intelligence || {}).flat().join(" ");
      const haystack = `${item.title} ${item.title_zh || ""} ${item.summary} ${item.ai_summary || ""} ${item.company} ${(item.source_labels || [item.source_label]).join(" ")} ${item.reasons.join(" ")} ${intelligenceText} ${item.acro_relevance?.explanation || ""} ${item.recommended_action?.label || ""} ${item.recommended_action?.text || ""}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.score - a.score);
}

function openSourceLibrary(sourceId = "") {
  const healthRow = getSourceHealthRows().find((row) => row.source_id === sourceId) || {};
  const methodRecord = sourceId ? getSourceMethodRecord(sourceId, healthRow) : null;
  state.sourceFocusId = sourceId;
  state.sourceFocusLayer = methodRecord && !methodRecord.method ? methodRecord.category.layer : "";
  state.sourceView = "library";
  state.sourceStage = "all";
  state.page = "sources";
  renderRules();
  renderPage();
  requestAnimationFrame(() => {
    const target = sourceId
      ? els.ruleGrid.querySelector(`[data-library-source-ids~="${CSS.escape(sourceId)}"]`) ||
        els.ruleGrid.querySelector(`[data-source-layer="${CSS.escape(state.sourceFocusLayer)}"]`)
      : els.sourceViewControl;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function openSourceOutput(sourceId, sourceLabel) {
  const company = (state.payload?.companies || []).find((row) => row.id === state.coverageCompany);
  state.sourceOutputId = sourceId;
  state.sourceOutputLabel = sourceLabel;
  state.searchQuery = "";
  state.tier = "all";
  state.relevance = "all";
  state.signalType = "all";
  state.category = "all";
  state.role = "all";
  state.region = "all";
  state.company = company?.display_name || "all";
  state.page = "signals";

  els.searchInput.value = "";
  els.tierFilter.value = "all";
  els.relevanceFilter.value = "all";
  els.signalTypeFilter.value = "all";
  els.categoryFilter.value = "all";
  els.companyFilter.value = [...els.companyFilter.options].some((option) => option.value === state.company)
    ? state.company
    : "all";
  els.regionFilter.value = "all";
  els.timeRangeControl.querySelectorAll("[data-time-range]").forEach((button) => {
    button.classList.remove("active");
  });
  els.roleControl.querySelectorAll("[data-role-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.roleFilter === "all");
  });

  renderPage();
  renderCompanyDock();
  renderOverviewScope();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearSourceOutput() {
  state.sourceOutputId = "all";
  state.sourceOutputLabel = "";
  els.timeRangeControl.querySelectorAll("[data-time-range]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.timeRange) === state.timeRange);
  });
  renderOverviewScope();
}

// ── Event listeners ──

els.overviewMetricGrid.addEventListener("click", (event) => {
  if (event.target.closest("[data-methodology-target]")) return;
  const card = event.target.closest("[data-overview-metric]");
  if (!card) return;
  openOverviewMetric(card.dataset.overviewMetric);
});

els.overviewMetricBackButton.addEventListener("click", () => {
  closeOverviewMetric("replace");
});

// Sidebar company dock is rendered from companies.json, so one delegated listener
// keeps newly added companies immediately interactive.
els.companyDockList.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter-company]");
  if (!chip) return;
  const companyId = chip.dataset.filterCompany;
  state.page = "overview";
  renderPage();

  if (companyId === "all") {
    state.company = "all";
    els.companyFilter.value = "all";
  } else {
    const companyName =
      state.payload?.companies?.find((company) => company.id === companyId)?.display_name ||
      companyIdToDisplayName[companyId] ||
      companyId;
    const hasOption = [...els.companyFilter.options].some((option) => option.value === companyName);
    state.company = hasOption ? companyName : "all";
    els.companyFilter.value = hasOption ? companyName : "all";
  }
  renderCompanyDock();
  renderOverviewScope();
});

els.companyDockList.addEventListener("toggle", (event) => {
  const group = event.target.closest?.("[data-dock-role]");
  if (!group || event.target !== group) return;
  if (group.open) state.dockOpenRoles.add(group.dataset.dockRole);
  else state.dockOpenRoles.delete(group.dataset.dockRole);
}, true);

els.searchInput.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  renderOverviewScope();
});

els.exportCsvButton.addEventListener("click", exportCsv);

els.translationToggles.forEach((toggle) => {
  toggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-translation-language]");
    if (!button) return;
    state.translationLanguage = button.dataset.translationLanguage === "en" ? "en" : "zh";
    saveTranslationLanguage(state.translationLanguage);
    renderTranslationToggle();
    renderOverviewScope();
    renderCompanyTimeline();
  });
});

els.tierFilter.addEventListener("change", (event) => {
  state.tier = event.target.value;
  renderOverviewScope();
});

els.relevanceFilter.addEventListener("change", (event) => {
  state.relevance = event.target.value;
  renderOverviewScope();
});

els.signalTypeFilter.addEventListener("change", (event) => {
  state.signalType = event.target.value;
  renderOverviewScope();
});

els.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  renderOverviewScope();
});

els.companyFilter.addEventListener("change", (event) => {
  state.company = event.target.value;
  renderCompanyDock();
  renderOverviewScope();
});

els.companyCoverageSelect.addEventListener("change", (event) => {
  state.coverageCompany = event.target.value;
  renderCompanySourceCoverage();
});

els.companyTimelineSelect.addEventListener("change", (event) => {
  state.timelineCompany = event.target.value;
  renderCompanyTimeline();
});

els.timelineScopeControl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-timeline-scope]");
  if (!button) return;
  state.timelineScope = button.dataset.timelineScope === "all" ? "all" : "selected";
  renderCompanyTimeline();
});

els.companySourceCrosswalk.addEventListener("click", (event) => {
  if (!event.target.closest("[data-open-source-library]")) return;
  openSourceLibrary();
});

els.companyCoverageGrid.addEventListener("click", (event) => {
  const outputButton = event.target.closest("[data-view-source-output-id]");
  if (outputButton) {
    openSourceOutput(outputButton.dataset.viewSourceOutputId, outputButton.dataset.sourceLabel);
    return;
  }
  const methodButton = event.target.closest("[data-locate-source-id]");
  if (methodButton) openSourceLibrary(methodButton.dataset.locateSourceId);
});

els.detailSignalCount.addEventListener("click", (event) => {
  if (!event.target.closest("[data-clear-source-output]")) return;
  clearSourceOutput();
});

els.companyPoolGroups.addEventListener("click", (event) => {
  const customerPoolButton = event.target.closest("[data-open-japan-customers]");
  if (customerPoolButton) {
    state.page = "japan-customers";
    renderPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const coverageButton = event.target.closest("[data-company-coverage-id]");
  if (coverageButton) {
    state.coverageCompany = coverageButton.dataset.companyCoverageId;
    state.page = "company-sources";
    renderCompanySourceCoverage();
    renderPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const relationshipButton = event.target.closest("[data-relationship-card-id]");
  if (!relationshipButton) return;
  state.relationshipType = "all";
  state.relationshipEvidence = "all";
  els.relationshipTypeFilter.value = "all";
  els.relationshipEvidenceFilter.value = "all";
  state.page = "relationships";
  renderCompanyRelationships();
  renderPage();
  const card = document.querySelector(`#relationship-card-${CSS.escape(relationshipButton.dataset.relationshipCardId)}`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
});

els.relationshipTypeFilter.addEventListener("change", (event) => {
  state.relationshipType = event.target.value;
  renderCompanyRelationships();
});

els.relationshipEvidenceFilter.addEventListener("change", (event) => {
  state.relationshipEvidence = event.target.value;
  renderCompanyRelationships();
});

els.relationshipGraph.addEventListener("click", (event) => {
  const node = event.target.closest("[data-graph-node-id]");
  if (!node) return;
  state.relationshipGraphFocus = node.dataset.graphNodeId;
  renderCompanyRelationships();
});

els.relationshipGraph.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const node = event.target.closest("[data-graph-node-id]");
  if (!node) return;
  event.preventDefault();
  state.relationshipGraphFocus = node.dataset.graphNodeId;
  renderCompanyRelationships();
});

els.relationshipLayerControl.querySelectorAll("[data-graph-layer]").forEach((button) => {
  button.addEventListener("click", () => {
    state.relationshipGraphLayer = button.dataset.graphLayer;
    state.relationshipGraphFocus = "acro";
    els.relationshipLayerControl.querySelectorAll("[data-graph-layer]").forEach((control) => {
      control.classList.toggle("active", control === button);
    });
    renderCompanyRelationships();
  });
});

function openOverviewEvidence(company = "", category = "") {
  state.sourceOutputId = "all";
  state.sourceOutputLabel = "";
  state.searchQuery = "";
  state.signalType = "all";
  state.relevance = "all";
  state.region = "all";
  state.company = company || "all";
  state.category = category || "all";
  state.tier = "all";
  state.role = "all";
  state.timeRange = 90;
  state.page = "signals";
  els.searchInput.value = "";
  els.signalTypeFilter.value = "all";
  els.relevanceFilter.value = "all";
  els.regionFilter.value = "all";
  els.companyFilter.value = state.company;
  els.categoryFilter.value = state.category;
  els.tierFilter.value = "all";
  els.timeRangeControl.querySelectorAll("[data-time-range]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.timeRange) === 90);
  });
  els.roleControl.querySelectorAll("[data-role-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.roleFilter === "all");
  });
  renderPage();
  renderOverviewScope();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

els.assistantPrompts.addEventListener("click", (event) => {
  const button = event.target.closest("[data-assistant-view]");
  if (!button) return;
  state.assistantView = button.dataset.assistantView;
  renderOverviewScope();
});

els.executivePoints.addEventListener("click", (event) => {
  const button = event.target.closest("[data-assistant-company][data-assistant-category]");
  if (!button) return;
  if (!button.dataset.assistantCompany && !button.dataset.assistantCategory) {
    if (state.assistantView === "source") {
      state.page = "source-health";
      renderPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }
  openOverviewEvidence(button.dataset.assistantCompany, button.dataset.assistantCategory);
});

els.customerPriorityMatrix.addEventListener("click", (event) => {
  if (event.target.closest("[data-methodology-target]")) return;
  const row = event.target.closest("[data-customer-priority-company]");
  if (!row) return;
  openOverviewEvidence(row.dataset.customerPriorityCompany);
});

els.customerPriorityMatrix.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key) || event.target.closest("button")) return;
  const row = event.target.closest("[data-customer-priority-company]");
  if (!row) return;
  event.preventDefault();
  openOverviewEvidence(row.dataset.customerPriorityCompany);
});

els.openJapanAccountsButton.addEventListener("click", () => {
  state.page = "japan-customers";
  renderJapanAccountIntelligence();
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.timeRangeControl.querySelectorAll("[data-time-range]").forEach((button) => {
  button.addEventListener("click", () => {
    state.sourceOutputId = "all";
    state.sourceOutputLabel = "";
    state.timeRange = Number(button.dataset.timeRange);
    els.timeRangeControl.querySelectorAll("[data-time-range]").forEach((control) => {
      control.classList.toggle("active", control === button);
    });
    renderOverviewScope();
  });
});

els.roleControl.querySelectorAll("[data-role-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.role = button.dataset.roleFilter;
    els.roleControl.querySelectorAll("[data-role-filter]").forEach((control) => {
      control.classList.toggle("active", control === button);
    });
    renderOverviewScope();
  });
});

els.regionFilter.addEventListener("change", (event) => {
  state.region = event.target.value;
  renderOverviewScope();
});

els.openSignalDetailButton.addEventListener("click", () => {
  state.page = "signals";
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.openRelationshipsButton.addEventListener("click", () => {
  state.page = "relationships";
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.openAcroSourcesButton.addEventListener("click", () => {
  state.coverageCompany = "acro";
  state.page = "company-sources";
  renderCompanySourceCoverage();
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.refreshButton.addEventListener("click", () => loadData());

els.companyTopicMatrix.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-matrix-company][data-matrix-category]");
  if (!cell) return;
  openOverviewEvidence(cell.dataset.matrixCompany, cell.dataset.matrixCategory);
});

els.sourceStageFilter.addEventListener("change", (event) => {
  state.sourceFocusId = "";
  state.sourceFocusLayer = "";
  state.sourceStage = event.target.value;
  renderRules();
});

els.sourceViewControl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-source-view]");
  if (!button) return;
  state.sourceFocusId = "";
  state.sourceFocusLayer = "";
  state.sourceView = button.dataset.sourceView;
  state.sourceStage = "all";
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

els.japanCustomerSearch.addEventListener("input", (event) => {
  state.accountQuery = event.target.value;
  state.accountLimit = 40;
  renderJapanAccountIntelligence();
});

els.japanCustomerTypeFilter.addEventListener("change", (event) => {
  state.accountStage = event.target.value;
  state.accountLimit = 40;
  renderJapanAccountIntelligence();
});

els.japanCustomerSapFilter.addEventListener("change", (event) => {
  state.accountOrganizationType = event.target.value;
  state.accountLimit = 40;
  renderJapanAccountIntelligence();
});

els.japanCustomerSignalFilter.addEventListener("change", (event) => {
  state.accountSignalStatus = event.target.value;
  state.accountLimit = 40;
  renderJapanAccountIntelligence();
});

els.japanCustomerList.addEventListener("click", (event) => {
  if (event.target.closest("[data-load-more-accounts]")) {
    state.accountLimit += 40;
    renderJapanAccountIntelligence();
    return;
  }
  const row = event.target.closest("[data-japan-account-id]");
  if (!row) return;
  state.selectedAccountId = row.dataset.japanAccountId;
  renderJapanAccountIntelligence();
});

els.pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const pageTarget = button.dataset.pageTarget;
    if (pageTarget === "methodology") {
      openMethodology("", "replace");
      return;
    }
    state.page = pageTarget;
    state.methodologyDetail = "";
    renderPage();
    if (
      window.location.hash.startsWith("#metric-") ||
      window.location.hash.startsWith("#overview-metric-") ||
      window.location.hash === "#methodology"
    ) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

els.methodologyBackButton.addEventListener("click", () => {
  openMethodology("", "replace");
});

document.addEventListener("click", (event) => {
  const methodologyTarget = event.target.closest("[data-methodology-target]");
  if (methodologyTarget) {
    event.preventDefault();
    event.stopPropagation();
    openMethodology(methodologyTarget.dataset.methodologyTarget);
    return;
  }
  const rulePageTarget = event.target.closest("[data-rule-page-target]");
  if (!rulePageTarget) return;
  if (rulePageTarget.dataset.rulePageTarget === "methodology") {
    openMethodology("", "replace");
    return;
  }
  state.page = rulePageTarget.dataset.rulePageTarget;
  state.methodologyDetail = "";
  if (
    window.location.hash.startsWith("#metric-") ||
    window.location.hash.startsWith("#overview-metric-") ||
    window.location.hash === "#methodology"
  ) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("popstate", () => {
  const overviewTarget = overviewMetricTargetFromHash();
  if (overviewTarget) {
    openOverviewMetric(overviewTarget, "none");
    return;
  }
  if (state.page === "overview-metric" && !window.location.hash) {
    closeOverviewMetric("none");
    return;
  }
  const target = methodologyTargetFromHash();
  if (target) {
    openMethodology(target, "none");
    return;
  }
  if (window.location.hash === "#methodology" || (state.page === "methodology" && !window.location.hash)) {
    openMethodology("", "none");
  }
});

const initialOverviewMetricHash = overviewMetricTargetFromHash();
const initialMetricHash = methodologyTargetFromHash();
if (initialOverviewMetricHash) {
  state.page = "overview-metric";
  state.overviewMetric = initialOverviewMetricHash;
} else if (initialMetricHash || window.location.hash === "#methodology") {
  state.page = "methodology";
  state.methodologyDetail = initialMetricHash;
}
renderMethodologyView();
renderPage();
loadData().then(() => {
  if (initialOverviewMetricHash || initialMetricHash || window.location.hash === "#methodology") {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }
});
