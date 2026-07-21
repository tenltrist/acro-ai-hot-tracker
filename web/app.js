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
    id: "official_video",
    number: "E",
    title: "视频与回放",
    description: "官方 YouTube、技术视频和 Webinar Replay。",
  },
  {
    id: "regional_coverage",
    number: "＋",
    title: "跨类别地区覆盖",
    description: "这不是内容分类；地区站抓到内容后，仍要归入上面五类。",
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

const sourceInventory = [
  {
    layer: "official",
    number: "01",
    title: "官方自有内容",
    subtitle: "先按内容类型分组，再用公司、地区和获取方式作标签。官网直抓受限时，只使用公开索引结果，不绕过验证。",
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
        name: "Thermo Fisher 官方 YouTube",
        contentGroup: "official_video",
        companyTag: "Thermo Fisher",
        regionTag: "全球频道",
        status: "active",
        trust: "A",
        method: "YouTube Atom RSS",
        note: "免费订阅官方频道更新，作为独立视频信号，不混入默认新闻流。",
        sourceIds: ["thermo_youtube_official"],
        url: "youtube.com/@thermofisher",
      },
      {
        name: "ACRO 官方 YouTube",
        contentGroup: "official_video",
        companyTag: "ACRO",
        regionTag: "全球频道",
        status: "active",
        trust: "A",
        method: "官方频道公开页面",
        note: "官方频道与 Channel ID 已确认；Atom Feed 实测返回 404，改为读取公开频道页中的最新视频。",
        sourceIds: ["acro_youtube_official"],
        url: "youtube.com/@ACROBiosystems",
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
        companyTag: "ACRO",
        regionTag: "全球",
        status: "active",
        trust: "B",
        method: "公司名 + site 索引 RSS",
        note: "当前用于补漏 ACRO 发布到 PR Newswire 的新闻稿；“公司定向”是查询规则，不是来源分类。",
        sourceIds: ["google_news_acro_prnewswire"],
        url: "prnewswire.com",
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
        sourceIds: ["businesswire_company_pool_index"],
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
        note: "没有公开 RSS 且正文需要订阅；已将 5 家公司纳入公开标题监测，不抓付费正文。",
        sourceIds: ["nikkei_biotech_company_pool_index"],
        url: "bio.nikkeibp.co.jp",
      },
      {
        name: "日刊薬業",
        mediaGroup: "regional_media",
        companyTag: "制药公司 / 政策",
        regionTag: "日本",
        status: "available",
        trust: "B",
        method: "公开标题索引 / 会员正文",
        note: "网站可访问但会员边界明显；公司池定向测试仅少量弱命中，暂不进入自动跑批。",
        url: "nk.jiho.jp",
      },
      {
        name: "Science Portal",
        mediaGroup: "regional_media",
        companyTag: "科研趋势",
        regionTag: "日本",
        status: "available",
        trust: "B",
        method: "JST 官方 RSS",
        note: "官方 RSS 稳定，但内容覆盖全科学领域，本轮生命科学业务密度偏低；待增加栏目或关键词过滤后再启用。",
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
        status: "available",
        trust: "C",
        method: "site 索引 / 直连受限",
        note: "官网与 Feed 自动请求返回 403；索引能发现类器官、外泌体和会议内容，但公司命中噪音较高，暂不启用。",
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
        status: "available",
        trust: "C",
        method: "site 索引 RSS",
        note: "能命中赛默飞交易和基因测序上游内容，但同时出现人物、职场等弱相关结果，需建立栏目白名单。",
        url: "jiemian.com",
      },
      {
        name: "36Kr · 医疗健康",
        mediaGroup: "regional_media",
        companyTag: "融资 / 初创公司",
        regionTag: "中国",
        status: "available",
        trust: "C",
        method: "site 索引 RSS",
        note: "能发现公司档案和融资周报，但公司资料页与旧内容比例较高，适合作为低权重补漏。",
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
      { name: "Bilibili", status: "manual", trust: "D", method: "人工观察", note: "先作为中国市场内容渠道观察，不进入 MVP 自动抓取。" },
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
        name: "重点展会与专业会议日历",
        marketGroup: "conference_exhibition",
        roleTag: "发现源",
        regionTag: "多地区",
        status: "planned",
        trust: "B",
        method: "主办方白名单 + 日历",
        note: "为 BioJapan、SLAS、AACR 等目标会议记录日期、参展商、演讲者和议题，不抓取全网泛展会。",
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
  merck_life_science: "Merck KGaA Life Science / MilliporeSigma",
  sartorius: "Sartorius / Sartorius Stedim Biotech",
  miltenyi_biotec: "Miltenyi Biotec / 美天旎",
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
    companies: 5,
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
  render();
  renderSourceHealth();
  renderSourceHealthPage();
  renderTrend();
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
      state.payload = await fetchJson("../data/latest_run.json");
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
  const categories = [...new Set(state.payload.items.map((item) => item.category))].sort();
  const companies = (state.payload.companies || [])
    .map((company) => company.display_name)
    .sort();
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
  els.sourceCount.textContent = `${
    new Set(scoped.flatMap((item) => item.source_ids || [item.source_id || item.source_label])).size
  } sources`;

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
          ${
            cat.layer === "official"
              ? renderOfficialSourceGroups(visibleSources)
              : cat.layer === "wire_media"
                ? renderWireMediaGroups(visibleSources)
                : cat.layer === "market_channel"
                  ? renderMarketChannelGroups(visibleSources)
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
    .filter(
      (item) =>
        state.company === "all" ||
        (item.matched_companies || [item.company]).includes(state.company),
    )
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => {
      if (!query) return true;
      const haystack = `${item.title} ${item.summary} ${item.ai_summary || ""} ${item.company} ${(item.source_labels || [item.source_label]).join(" ")} ${item.reasons.join(" ")}`.toLowerCase();
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
  const sourceNames = new Set(
    state.payload.items.flatMap((item) => item.source_labels || [item.source_label]),
  );
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
  els.healthMetricTracked.textContent = rows.length;
  els.healthMetricProducing.textContent = rows.filter((row) => row.total > 0).length;
  els.healthMetricSelected.textContent = rows.filter((row) => row.immediate + row.daily > 0).length;
  const quietCount = rows.filter((row) => row.status === "quiet").length;
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  els.healthMetricAttention.textContent = quietCount + pendingCount + errorCount;
  els.healthAttentionDetail.textContent = `${quietCount} 个暂无内容 · ${pendingCount} 个待配置 · ${errorCount} 个异常`;

  const visible = rows
    .filter(
      (row) =>
        state.healthCompany === "all" ||
        (row.scope || row.company) === state.healthCompany,
    )
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

  const headers = ["标题", "公司命中", "情报类型", "来源", "发布日期", "分数", "分层", "分类", "理由", "摘要", "URL"];
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
    .filter(
      (item) =>
        state.company === "all" ||
        (item.matched_companies || [item.company]).includes(state.company),
    )
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => {
      if (!query) return true;
      const haystack = `${item.title} ${item.summary} ${item.ai_summary || ""} ${item.company} ${(item.source_labels || [item.source_label]).join(" ")} ${item.reasons.join(" ")}`.toLowerCase();
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
