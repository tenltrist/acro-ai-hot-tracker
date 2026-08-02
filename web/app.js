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
  relevance: "all",
  signalType: "all",
  company: "all",
  category: "all",
  timeRange: 30,
  role: "all",
  region: "all",
  searchQuery: "",
  page: "overview",
  sourceStage: "all",
  healthCompany: "all",
  healthStatus: "all",
  coverageCompany: "acro",
  relationshipType: "all",
  relationshipEvidence: "all",
  relationshipGraphLayer: "all",
  relationshipGraphFocus: "acro",
  dockOpenRoles: new Set(["self"]),
  feedback: loadFeedback(),
  history: null,
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
        name: "Bio-Techne / R&D Systems Press Releases",
        contentGroup: "company_news",
        companyTag: "R&D Systems / Bio-Techne",
        regionTag: "全球站",
        status: "active",
        trust: "A",
        method: "官方 IR 定向索引 RSS",
        note: "R&D Systems 是品牌，新闻主体多为 Bio-Techne；当前优先保留产品、合作、收购与技术平台更新。",
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
        name: "Google News - 新增竞品 / 对标池",
        companyTag: "Abcam / Promega / R&D / BD / MCE / STEMCELL / Sino / Takara",
        regionTag: "全球 + 日本",
        status: "active",
        trust: "C",
        method: "公司全称 + 业务主题 RSS",
        note: "8 家公司已逐源运行，这一层只负责外部补漏；官方新闻、活动与技术内容已在 01 层建立独立入口。每个聚合入口都必须同时命中公司全称。",
        sourceIds: [
          "google_news_abcam",
          "google_news_promega",
          "google_news_rd_systems",
          "google_news_bd_biosciences",
          "google_news_medchemexpress",
          "google_news_stemcell_technologies",
          "google_news_sino_biological",
          "google_news_takara_bio",
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
        note: "适合大规模品牌与舆情监测；当前 13 家公司 MVP 规模仍优先验证免费入口。",
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
  companies: ["Company Pool", "目标公司池"],
  relationships: ["Relationship Intelligence", "ACRO 企业关系与客户线索"],
  "company-sources": ["Company Sources", "公司数据源档案"],
  signals: ["Intelligence Detail", "情报明细与证据库"],
  sources: ["Source Map", "数据源地图与接入边界"],
  acro: ["Company Profile", "ACRO 样本档案"],
  "structured-rules": ["Intelligence Operations", "六组结构化情报规则"],
  pipeline: ["System Pipeline", "数据获取、处理、存储、展现链路"],
  questions: ["Open Questions", "待确认事项"],
  "source-health": ["Source Operations", "数据源健康与产出质量"],
};

const companyIdToDisplayName = {
  acro: "ACROBiosystems / 百普赛斯",
  thermo_fisher: "Thermo Fisher Scientific",
  merck_life_science: "Merck KGaA Life Science / MilliporeSigma",
  sartorius: "Sartorius / Sartorius Stedim Biotech",
  miltenyi_biotec: "Miltenyi Biotec / 美天旎",
  abcam: "Abcam",
  promega: "Promega",
  rd_systems: "R&D Systems / Bio-Techne",
  bd_biosciences: "BD Biosciences",
  medchemexpress: "MedChemExpress / MCE",
  stemcell_technologies: "STEMCELL Technologies",
  sino_biological: "Sino Biological / 义翘神州",
  takara_bio: "Takara Bio / 宝生物",
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
  sourceStageFilter: document.querySelector("#sourceStageFilter"),
  sourceStageCount: document.querySelector("#sourceStageCount"),
  companyPoolTimestamp: document.querySelector("#companyPoolTimestamp"),
  companyRoleSummary: document.querySelector("#companyRoleSummary"),
  companyPoolGroups: document.querySelector("#companyPoolGroups"),
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
  relationshipSegmentCount: document.querySelector("#relationshipSegmentCount"),
  relationshipGraph: document.querySelector("#relationshipGraph"),
  relationshipFocusPanel: document.querySelector("#relationshipFocusPanel"),
  relationshipLayerControl: document.querySelector("#relationshipLayerControl"),
  relationshipResultCount: document.querySelector("#relationshipResultCount"),
  relationshipTypeFilter: document.querySelector("#relationshipTypeFilter"),
  relationshipEvidenceFilter: document.querySelector("#relationshipEvidenceFilter"),
  relationshipList: document.querySelector("#relationshipList"),
  customerSegmentList: document.querySelector("#customerSegmentList"),
  companyCoverageTitle: document.querySelector("#companyCoverageTitle"),
  companyCoverageDescription: document.querySelector("#companyCoverageDescription"),
  companyCoverageSelect: document.querySelector("#companyCoverageSelect"),
  companyCoverageMetrics: document.querySelector("#companyCoverageMetrics"),
  companyCoverageGrid: document.querySelector("#companyCoverageGrid"),
  companyDockCount: document.querySelector("#companyDockCount"),
  companyDockList: document.querySelector("#companyDockList"),
  structuredRuleVersion: document.querySelector("#structuredRuleVersion"),
  structuredGroupCount: document.querySelector("#structuredGroupCount"),
  structuredTermCount: document.querySelector("#structuredTermCount"),
  structuredHitCount: document.querySelector("#structuredHitCount"),
  structuredRuleGrid: document.querySelector("#structuredRuleGrid"),
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
  renderCompanyRelationships();
  renderCompanySourceCoverage();
  renderStructuredRules();
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
  customer: { label: "客户池", empty: "客户名单待导入" },
};

function compactCompanyName(company) {
  if (company.id === "acro") return "ACRO";
  return (company.display_name || company.id).split(" / ")[0];
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
    const members = companies.filter((company) => company.business_role === role);
    const rows = members.length
      ? members.map((company) => `
          <button class="company-chip ${state.company === company.display_name ? "active" : ""}" type="button" data-filter-company="${escapeHtml(company.id)}">
            <span class="company-chip-main"><i class="company-dot role-${role}"></i><strong>${escapeHtml(compactCompanyName(company))}</strong></span>
            <small>${escapeHtml(company.role_label || meta.label)}</small>
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

function renderCompanyPools() {
  const companies = state.payload?.companies || [];
  if (!els.companyPoolGroups || !els.companyRoleSummary) return;

  const relationshipData = getRelationshipData();
  const relationshipRecords = relationshipData.records || [];
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
    role_label: "客户群 / 具体名单待发现",
    role_reason: segment.note,
    monitoring_focus: "从官方案例、合作公告、产品引用和会议演讲中逐条确认。",
    entity_kind: "segment",
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
      description: "依据产品、技术能力、应用场景与目标客户重叠程度纳入。",
      empty: "尚未确认竞品公司。",
      members: companies.filter((company) => company.business_role === "competitor"),
    },
    {
      id: "customer",
      title: "已确认客户",
      description: "只收录有采购、项目、客户案例或内部授权证据的公司。",
      empty: "当前没有可对外展示的已确认客户，不用合作伙伴或参会公司填充。",
      members: companies.filter((company) => company.business_role === "customer"),
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
      members: (relationshipData.customer_segments || []).map(asSegmentMember),
    },
  ];

  const counts = Object.fromEntries(roleDefinitions.map((role) => [role.id, role.members.length]));

  els.companyPoolTimestamp.textContent = `${companies.length} 家监测公司 · ${relationshipRecords.length} 条关系证据`;
  els.companyRoleSummary.innerHTML = `
    <article><span>本公司</span><strong>${counts.self}</strong><small>系统标本</small></article>
    <article><span>竞品池</span><strong>${counts.competitor}</strong><small>行业对标</small></article>
    <article><span>已确认客户</span><strong>${counts.customer}</strong><small>高证据门槛</small></article>
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
                <strong>${escapeHtml(company.display_name)}</strong>
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
                : company.entity_kind === "segment"
                  ? '<span class="company-profile-state">名单发现中</span>'
                  : `<button class="company-profile-source-button" type="button" data-company-coverage-id="${escapeHtml(company.id)}">查看数据源</button>`}
            </article>
          `).join("")
        : `<div class="company-pool-empty"><strong>0 家</strong><p>${escapeHtml(role.empty)}</p></div>`;

      return `
        <section class="company-pool-block role-${role.id}">
          <header>
            <div><span>${escapeHtml(role.title)}</span><strong>${members.length} 家</strong></div>
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
    if (!isRelationship || !["daily", "immediate"].includes(item.tier) || Number(item.age_days || 0) > 90) continue;
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
    addEdge("acro", segmentId, "segment", "客户发现方向");
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
  const segments = data.customer_segments || [];
  const dynamicCandidates = getDynamicRelationshipCandidates();
  const allRecords = [...records, ...dynamicCandidates];
  const confirmed = records.filter((record) => record.evidence_level === "confirmed");
  const disclosed = records.filter((record) => record.evidence_level === "disclosed");
  const customers = records.filter((record) => record.relationship_type === "confirmed_customer");
  const visible = allRecords.filter(
    (record) =>
      (state.relationshipType === "all" || record.relationship_type === state.relationshipType) &&
      (state.relationshipEvidence === "all" || record.evidence_level === state.relationshipEvidence),
  );

  els.relationshipUpdatedAt.textContent = `证据库更新：${data.updated_at || "--"}`;
  els.relationshipConfirmedCount.textContent = confirmed.length;
  els.relationshipDisclosedCount.textContent = disclosed.length;
  els.relationshipCandidateCount.textContent = dynamicCandidates.length;
  els.relationshipCustomerCount.textContent = customers.length;
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
      <span>客户群已确认 · 具体公司待发现</span>
    </article>
  `).join("");
}

const coverageStatusMeta = {
  active: { label: "专属运行", className: "active" },
  covered: { label: "已有覆盖", className: "covered" },
  pending: { label: "待恢复 / 配置", className: "pending" },
  planned: { label: "待补入口", className: "planned" },
  manual: { label: "人工观察", className: "manual" },
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

function renderCompanySourceCoverage() {
  if (!els.companyCoverageSelect || !els.companyCoverageGrid) return;
  const companies = state.payload?.companies || [];
  const coverage = state.payload?.company_source_coverage || {};
  const definitions = coverage.slot_definitions || [];
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

  els.companyCoverageTitle.textContent = company
    ? `${company.display_name} · 10 板块数据源档案`
    : "公司数据源档案";
  els.companyCoverageDescription.textContent = company?.monitoring_focus
    ? `监测重点：${company.monitoring_focus}`
    : "专属来源、共享覆盖与待补入口统一展示。";
  els.companyCoverageMetrics.innerHTML = `
    <article><span>专属运行源</span><strong>${dedicatedIds.length}</strong><small>直接绑定该公司</small></article>
    <article><span>共享覆盖源</span><strong>${sharedIds.length}</strong><small>新闻稿、地区媒体或研究池</small></article>
    <article><span>已覆盖板块</span><strong>${coveredSlots}<b> / ${definitions.length}</b></strong><small>专属运行或已有共享覆盖</small></article>
    <article class="${gapSlots ? "needs-review" : "is-clear"}"><span>待补板块</span><strong>${gapSlots}</strong><small>待接入、待恢复或尚未配置</small></article>
  `;

  els.companyCoverageGrid.innerHTML = definitions.map((definition) => {
    const slot = profile.slots?.[definition.id] || {
      status: "planned",
      mode: "none",
      source_ids: [],
      note: `尚未为 ${company?.display_name || "该公司"} 建立这一类稳定入口。`,
    };
    const status = coverageStatusMeta[slot.status] || coverageStatusMeta.planned;
    const summary = summarizeCoverageSlot(slot, state.coverageCompany);
    const sourceNames = summary.rows.map((row) => row.source_label);
    const result = slot.source_ids?.length
      ? `${slot.source_ids.length} 个来源 · 本轮候选 ${summary.total} · 日报 ${summary.selected}`
      : "尚未配置运行入口";
    return `
      <article class="company-coverage-slot status-${status.className}">
        <header>
          <span>${escapeHtml(definition.number)}</span>
          <div><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(coverageModeLabels[slot.mode || "none"] || coverageModeLabels.none)}</small></div>
          <b class="coverage-status ${status.className}">${escapeHtml(status.label)}</b>
        </header>
        <p>${escapeHtml(definition.description)}</p>
        <div class="company-coverage-note">${escapeHtml(slot.note || "")}</div>
        <div class="company-coverage-result"><strong>${escapeHtml(result)}</strong>${sourceNames.length ? `<small title="${escapeAttr(sourceNames.join("\n"))}">${escapeHtml(sourceNames.slice(0, 2).join(" / "))}${sourceNames.length > 2 ? ` +${sourceNames.length - 2}` : ""}</small>` : ""}</div>
      </article>
    `;
  }).join("");
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
  els.refreshButton.disabled = false;
  els.refreshButton.classList.remove("is-loading");
  els.refreshButton.removeAttribute("aria-busy");
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
  els.windowDays.textContent = `${state.timeRange} 天`;
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

const businessEventDefinitions = {
  product_platform: { label: "产品与平台", short: "产品平台" },
  target_therapy: { label: "靶点与治疗方向", short: "靶点疗法" },
  clinical_regulatory: { label: "临床与监管", short: "临床监管" },
  partnership_deal: { label: "合作、授权与交易", short: "合作交易" },
  customer_demand: { label: "客户需求与潜在机会", short: "客户需求" },
  market_activity: { label: "市场活动与渠道", short: "市场活动" },
  regional_expansion: { label: "地区扩张与市场进入", short: "地区扩张" },
  quality_supply: { label: "质量、GMP 与供应链", short: "质量供应" },
  corporate_strategy: { label: "公司战略与组织动作", short: "公司战略" },
};

function getBusinessEventType(item) {
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

function renderOverviewScope() {
  const scoped = getFilteredItems();
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  const customerCompanyCount = (state.payload.companies || []).filter(
    (company) => company.business_role === "customer",
  ).length;
  const competitorCount = scoped.filter((item) => getItemRole(item, companyRoles) === "competitor").length;
  const customerCount = scoped.filter((item) => getItemRole(item, companyRoles) === "customer").length;
  const apacRegions = new Set(["japan", "china", "korea", "southeast_asia"]);
  const apacCount = scoped.filter((item) => apacRegions.has(inferItemRegion(item))).length;
  const criticalCount = scoped.filter(
    (item) => ["daily", "immediate"].includes(item.tier) && item.acro_relevance?.level === "high",
  ).length;

  els.metricCandidates.textContent = criticalCount;
  els.metricDaily.textContent = competitorCount;
  els.metricImmediate.textContent = customerCompanyCount ? customerCount : "未接入";
  els.metricArchive.textContent = apacCount;
  els.metricCompetitorNote.textContent = `${
    (state.payload.companies || []).filter((company) => company.business_role === "competitor").length
  } 家已确认竞品`;
  els.metricCustomerNote.textContent = customerCompanyCount
    ? `${customerCompanyCount} 家客户 / 目标客户`
    : "客户池尚未导入名单";
  els.sourceCount.textContent = `${scoped.length} 条`;
  els.windowDays.textContent = `${state.timeRange} 天`;

  renderExecutiveBrief(scoped, companyRoles, customerCompanyCount);
  renderSignalTrend(scoped, companyRoles);
  renderRegionDistribution(scoped);
  renderCompanyTopicMatrix(scoped);
  renderCategoryDistribution(scoped);
  renderBusinessLanes(scoped, companyRoles);
  renderSignals();
}

function renderBusinessLanes(items, companyRoles) {
  if (!els.competitorActionList) return;
  const competitorItems = items.filter(
    (item) => getItemRole(item, companyRoles) === "competitor",
  );
  const opportunityItems = items.filter((item) => {
    const role = getItemRole(item, companyRoles);
    const productNeeds = item.intelligence?.product_needs || [];
    return item.recommended_action?.type === "lead" ||
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
    return `
      <a class="business-lane-item" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">
        <span><b>${escapeHtml(shortCompanyName(company))}</b><i>${escapeHtml(context)}</i></span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.published || "日期待核对")} · ${Number(item.score) || 0} 分</small>
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
  return "industry";
}

function labelRole(role) {
  return {
    self: "本公司",
    competitor: "竞品",
    customer: "客户",
    industry: "行业观察",
  }[role] || role;
}

function renderExecutiveBrief(items, companyRoles, customerCompanyCount) {
  const competitorCompanyCounts = {};
  const categoryCounts = {};
  const regionCounts = {};
  const intelligenceCounts = {};
  const actionCounts = {};
  const relevanceCounts = { high: 0, medium: 0, low: 0 };
  for (const item of items) {
    for (const companyId of item.matched_company_ids || []) {
      if (companyRoles.get(companyId) === "competitor") {
        competitorCompanyCounts[companyId] = (competitorCompanyCounts[companyId] || 0) + 1;
      }
    }
    const businessEvent = getBusinessEventType(item);
    categoryCounts[businessEvent] = (categoryCounts[businessEvent] || 0) + 1;
    const region = inferItemRegion(item);
    regionCounts[region] = (regionCounts[region] || 0) + 1;
    const relevance = item.acro_relevance?.level || "low";
    relevanceCounts[relevance] = (relevanceCounts[relevance] || 0) + 1;
    for (const value of [
      ...(item.intelligence?.targets || []),
      ...(item.intelligence?.modalities || []),
      ...(item.intelligence?.product_needs || []),
    ]) {
      intelligenceCounts[value] = (intelligenceCounts[value] || 0) + 1;
    }
    const actionLabel = item.recommended_action?.label;
    if (actionLabel && actionLabel !== "归档观察") {
      actionCounts[actionLabel] = (actionCounts[actionLabel] || 0) + 1;
    }
  }
  const topCompanyEntry = Object.entries(competitorCompanyCounts).sort((a, b) => b[1] - a[1])[0];
  const topCompany = topCompanyEntry
    ? state.payload.companies.find((company) => company.id === topCompanyEntry[0])
    : null;
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topRegion = Object.entries(regionCounts)
    .filter(([region]) => region !== "global")
    .sort((a, b) => b[1] - a[1])[0];
  const topIntelligence = Object.entries(intelligenceCounts).sort((a, b) => b[1] - a[1])[0];
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];

  els.executiveHeadline.textContent = items.length
    ? `${state.timeRange} 天内 ${items.length} 条信号：${relevanceCounts.high} 条 ACRO 高相关，${relevanceCounts.medium} 条中相关`
    : "当前筛选范围内没有达到日报门槛的信号";
  const points = [
    topCompany
      ? `竞品活跃度最高：${shortCompanyName(topCompany.display_name)}，共 ${topCompanyEntry[1]} 条。`
      : "当前范围内没有明确命中竞品池的信号。",
    topIntelligence
      ? `结构化情报中“${topIntelligence[0]}”出现最多，共 ${topIntelligence[1]} 条。`
      : topCategory
        ? `当前主要集中于“${labelBusinessEvent(topCategory[0])}”，尚需补充靶点和疗法字段。`
        : "主题信号暂不足以形成判断。",
    topAction
      ? `建议动作最多的是“${topAction[0]}”，共 ${topAction[1]} 条待评估。`
      : "当前没有信号达到需要人工行动的程度。",
    topRegion
      ? `已识别地区中“${labelRegion(topRegion[0])}”最多，共 ${topRegion[1]} 条；其余全球内容仍需进一步结构化。`
      : "多数内容暂未识别出明确事件地区，地区结果目前只作线索。",
    customerCompanyCount
      ? `客户池已接入 ${customerCompanyCount} 家，可继续观察需求与合作信号。`
      : "客户池尚未导入，客户需求不显示为 0，避免造成“没有需求”的误判。",
  ];
  els.executivePoints.innerHTML = points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
}

function renderSignalTrend(items, companyRoles) {
  const days = state.timeRange;
  const seriesDefinitions = [
    { id: "self", label: "本公司", color: "#087f8c" },
    { id: "competitor", label: "竞品", color: "#c95d42" },
    { id: "customer", label: "客户", color: "#345f9f" },
    { id: "industry", label: "行业", color: "#7b8790" },
  ].filter((series) => state.role === "all" || state.role === series.id);
  const values = Object.fromEntries(seriesDefinitions.map((series) => [series.id, Array(days).fill(0)]));
  for (const item of items) {
    const age = Math.max(0, Math.floor(Number(item.age_days) || 0));
    if (age >= days) continue;
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
    const suffix = series.id === "customer" && !total ? "未接入" : total;
    return `<span><i style="background:${series.color}"></i>${series.label} ${suffix}</span>`;
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

function renderCompanyTopicMatrix(items) {
  const companies = (state.payload.companies || []).filter(
    (company) => ["self", "competitor", "customer"].includes(company.business_role),
  );
  const categoryTotals = {};
  for (const item of items) {
    const eventType = getBusinessEventType(item);
    categoryTotals[eventType] = (categoryTotals[eventType] || 0) + 1;
  }
  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category]) => category);
  if (!categories.length) {
    els.companyTopicMatrix.innerHTML = '<div class="empty">当前范围内没有可形成矩阵的商业事件。</div>';
    return;
  }
  const matrix = {};
  let max = 0;
  for (const company of companies) {
    matrix[company.id] = {};
    for (const category of categories) {
      const count = items.filter(
        (item) => (item.matched_company_ids || []).includes(company.id) && getBusinessEventType(item) === category,
      ).length;
      matrix[company.id][category] = count;
      max = Math.max(max, count);
    }
  }
  const columns = `minmax(150px, 1.5fr) repeat(${categories.length}, minmax(68px, 1fr))`;
  const header = `<div class="matrix-row matrix-header" style="grid-template-columns:${columns}"><span>公司</span>${categories.map((category) => `<span>${escapeHtml(labelBusinessEvent(category, true))}</span>`).join("")}</div>`;
  const rows = companies.map((company) => `
    <div class="matrix-row" style="grid-template-columns:${columns}">
      <span class="matrix-company"><i class="role-dot role-${company.business_role}"></i>${escapeHtml(shortCompanyName(company.display_name))}</span>
      ${categories.map((category) => {
        const count = matrix[company.id][category];
        const intensity = count ? Math.max(1, Math.ceil((count / Math.max(max, 1)) * 4)) : 0;
        return `<span class="matrix-cell intensity-${intensity}" title="${count} 条">${count || "–"}</span>`;
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
  return `
    <article class="source-card">
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

function renderPage() {
  const [eyebrow, title] = pageMeta[state.page] || pageMeta.overview;
  els.pageEyebrow.textContent = eyebrow;
  els.pageTitle.textContent = title;
  els.toolbar.hidden = !["overview", "signals"].includes(state.page);
  els.pagePanels.forEach((panel) => {
    panel.hidden = panel.dataset.page !== state.page;
  });
  els.pageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.pageTarget === state.page);
  });
}

function renderSignals() {
  const filtered = getFilteredItems();
  els.detailSignalCount.textContent = `${filtered.length} 条结果`;
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
  return `<div class="business-insight relevance-${escapeAttr(relevance.level || "low")}${compact ? " is-compact" : ""}">
    <div class="business-insight-copy">
      <div class="business-insight-title">
        <span>ACRO ${escapeHtml(relevance.label || "待分析")}</span>
        <strong>${Number(relevance.score) || 0}</strong>
      </div>
      <p>${escapeHtml(relevance.explanation || "暂无结构化业务解释。")}</p>
    </div>
    <div class="recommended-action priority-${escapeAttr(action.priority || "low")}">
      <span>建议动作</span>
      <div><strong>${escapeHtml(action.label || "归档观察")}</strong><small>${escapeHtml(action.owner || "待确认")}</small></div>
      <p>${escapeHtml(action.text || "暂不发起业务动作。")}</p>
    </div>
  </div>`;
}

function renderSignalCards(container, items, compact) {
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    const customerEmpty = state.role === "customer" && !(state.payload.companies || []).some(
      (company) => company.business_role === "customer",
    );
    container.innerHTML = `<div class="empty">${
      customerEmpty
        ? "客户池尚未导入公司名单，因此不能把‘未接入’解释成‘没有客户信号’。"
        : "当前筛选条件下没有需要展示的信号。"
    }</div>`;
    return;
  }
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  for (const item of items) {
    const card = document.createElement("article");
    card.className = `signal-card${compact ? " compact" : ""}`;
    const fb = state.feedback[item.id];
    const fbClass = fb ? `voted-${fb.value}` : "";
    const role = getItemRole(item, companyRoles);
    const region = inferItemRegion(item);
    card.innerHTML = `
      <div class="signal-top">
        <a class="signal-title" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        <span class="score">${item.score}</span>
      </div>
      <div class="meta-row">
        <span class="tag ${item.tier}">${labelTier(item.tier)}</span>
        <span class="tag role-tag role-${role}">${labelRole(role)}</span>
        <span class="tag region-tag">${escapeHtml(labelRegion(region))}</span>
        <span class="tag type-tag">${labelSignalType(item.signal_type || "news")}</span>
        <span class="tag business-event-tag">${labelBusinessEvent(getBusinessEventType(item), true)}</span>
        <span class="tag company-match ${
          item.matched_companies?.length ? "matched" : "unmatched"
        }">${escapeHtml(
          item.matched_companies?.length
            ? `命中：${item.matched_companies.join(" / ")}`
            : "未命中公司池",
        )}</span>
        <span class="tag">${escapeHtml(item.published || "no date")}</span>
        <span class="tag source-origin">${escapeHtml((item.source_labels || [item.source_label]).join(" + "))}</span>
      </div>
      <p class="summary">${escapeHtml(item.ai_summary || item.summary || "暂无摘要，建议回原文核对。")}</p>
      ${renderBusinessInsight(item, compact)}
      ${compact ? "" : renderIntelligenceFields(item)}
      ${compact ? "" : `<ul class="reason-list">
        ${item.reasons.slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
      </ul>
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
  const runningCount = rows.filter((row) => row.enabled !== false).length;
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const quietCount = rows.filter((row) => row.status === "quiet").length;
  els.healthStatus.textContent = errors.length
    ? `${errors.length} 异常 · ${runningCount} 运行`
    : pendingCount
      ? `${runningCount} 运行 · ${pendingCount} 待配置`
      : `${runningCount} 来源运行正常`;

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

  els.healthMetricTracked.textContent = metricRows.length;
  els.healthMetricProducing.textContent = metricRows.filter((row) => row.total > 0).length;
  els.healthMetricSelected.textContent = metricRows.filter((row) => row.immediate + row.daily > 0).length;
  const quietCount = metricRows.filter((row) => row.status === "quiet").length;
  const pendingCount = metricRows.filter((row) => row.status === "pending").length;
  const errorCount = metricRows.filter((row) => row.status === "error").length;
  els.healthMetricAttention.textContent = quietCount + pendingCount + errorCount;
  els.healthAttentionDetail.textContent = `${quietCount} 个暂无内容 · ${pendingCount} 个待配置 · ${errorCount} 个异常`;

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
      return `<div class="health-table-row" role="row">
        <span class="health-name"><strong>${escapeHtml(row.source_label)}</strong><small>监测范围：${escapeHtml(row.scope || row.company || "跨公司")}</small></span>
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

  const headers = ["标题", "公司命中", "情报类型", "来源", "发布日期", "分数", "分层", "商业事件", "靶点", "疗法技术", "产品需求", "研发阶段", "业务动作", "活动信号", "ACRO相关性", "相关性解释", "建议动作", "负责人", "理由", "摘要", "URL"];
  const rows = [headers.join(",")];
  for (const item of filtered) {
    rows.push(
      [
        csvCell(item.title),
        csvCell(item.company),
        csvCell(labelSignalType(item.signal_type || "news")),
        csvCell((item.source_labels || [item.source_label]).join(" + ")),
        csvCell(item.published || ""),
        item.score,
        csvCell(labelTier(item.tier)),
        csvCell(labelBusinessEvent(getBusinessEventType(item))),
        csvCell((item.intelligence?.targets || []).join("; ")),
        csvCell((item.intelligence?.modalities || []).join("; ")),
        csvCell((item.intelligence?.product_needs || []).join("; ")),
        csvCell((item.intelligence?.development_stages || []).join("; ")),
        csvCell((item.intelligence?.business_actions || []).join("; ")),
        csvCell((item.intelligence?.event_signals || []).join("; ")),
        csvCell(item.acro_relevance?.label || ""),
        csvCell(item.acro_relevance?.explanation || ""),
        csvCell(item.recommended_action?.label || ""),
        csvCell(item.recommended_action?.owner || ""),
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
  const companyRoles = new Map(
    (state.payload.companies || []).map((company) => [company.id, company.business_role]),
  );
  return state.payload.items
    .filter((item) => Math.max(0, Math.floor(Number(item.age_days) || 0)) < state.timeRange)
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
      const haystack = `${item.title} ${item.summary} ${item.ai_summary || ""} ${item.company} ${(item.source_labels || [item.source_label]).join(" ")} ${item.reasons.join(" ")} ${intelligenceText} ${item.acro_relevance?.explanation || ""} ${item.recommended_action?.label || ""} ${item.recommended_action?.text || ""}`.toLowerCase();
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
    renderOverviewScope();
  });
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

els.companyPoolGroups.addEventListener("click", (event) => {
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

els.timeRangeControl.querySelectorAll("[data-time-range]").forEach((button) => {
  button.addEventListener("click", () => {
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

els.refreshButton.addEventListener("click", () => loadData());

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
