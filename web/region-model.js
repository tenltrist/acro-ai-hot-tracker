(function (root) {
  "use strict";
  const semanticReviews = root.AIHOT_REGION_REVIEWS || (typeof module !== "undefined" && module.exports ? require("./region-reviews.js") : { entries: [] });
  const definitions = [
    { id: "japan", label: "日本", scope: "日本及明确城市，例如东京、大阪、神户；PMDA 日本监管事项。", apac: true },
    { id: "china", label: "中国及港澳台市场", scope: "中国大陆、香港、澳门、台湾的明确市场线索；具体辖区保留在证据中，不互相推定批准。", apac: true },
    { id: "korea", label: "韩国", scope: "韩国、首尔等明确线索；不将朝鲜归入韩国。", apac: true },
    { id: "southeast_asia", label: "东南亚", scope: "东南亚或新加坡、马来西亚、泰国、印尼、越南、菲律宾等明确国家。", apac: true },
    { id: "south_asia", label: "南亚", scope: "南亚或印度、巴基斯坦、孟加拉国、斯里兰卡、尼泊尔等。", apac: true },
    { id: "oceania", label: "大洋洲", scope: "大洋洲、澳大利亚、新西兰；TGA 澳大利亚监管事项。", apac: true },
    { id: "north_america", label: "北美", scope: "本看板的业务分组为美国、加拿大；墨西哥归入拉美。FDA 指向美国监管，不表示加拿大已批准。" },
    { id: "europe", label: "欧洲", scope: "欧洲、EU / 欧盟及英国、德国、法国、瑞士等；EU 不等于欧洲所有国家。" },
    { id: "latin_america", label: "拉丁美洲", scope: "拉美、南美、中美洲及墨西哥、巴西、阿根廷等。" },
    { id: "middle_east", label: "中东", scope: "中东及沙特、阿联酋、以色列等明确国家，不从泛称亚洲推定。" },
    { id: "africa", label: "非洲", scope: "非洲及南非、埃及、肯尼亚等明确国家。" },
    { id: "asia_unspecified", label: "原文仅明确亚洲范围", scope: "只明确写亚洲 / Asia / アジア；作为范围证据保留，不另设一级地区，也不推定具体国家或自动等同亚太。" },
    { id: "apac_unspecified", label: "原文仅明确亚太范围", scope: "明确写亚太 / APAC / Asia-Pacific，但没有具体国家；计入亚太父级一次，不重复计入各个国家。", apac: true },
    { id: "global", label: "全球业务范围", scope: "明确的全球开发、许可、销售、临床、交易业务或职能体系范围；作为范围证据保留，不另设一级地区，不代表每个国家已实施。" },
    { id: "nonregional", label: "未限定地区", scope: "经逐条判读，当前证据是未限定地域的方法、行业讨论或公司整体披露；不等于全球业务覆盖，也不保证未读材料中没有地理信息。" },
    { id: "unknown", label: "地区待确认", scope: "当前可用材料没有通过准入的地区证据，或项目地点未披露；不代表全球、没有业务或没有新闻。" },
  ];
  const patterns = [
    ["japan", /\b(?:japan|japanese|tokyo|osaka|kobe|kyoto|yokohama|biojapan)\b|日本|東京|东京|大阪|神戸|神户|京都|横浜|横滨|近畿|湘南/gi],
    ["china", /\b(?:china|chinese|beijing|shanghai|shenzhen|suzhou|guangzhou|hong kong|macao|macau|taiwan|taipei)\b|中国|北京|上海|深圳|苏州|广州|香港|澳門|澳门|台湾|臺灣|台北/gi],
    ["korea", /\b(?:south korea|korean|seoul|bio korea)\b|(?<!north )\bkorea\b|韩国|韓国|首尔|ソウル/gi],
    ["southeast_asia", /\b(?:southeast asia|south east asia|singapore|malaysia|thailand|indonesia|vietnam|philippines|cambodia|laos|myanmar|brunei)\b|东南亚|東南アジア|新加坡|シンガポール|马来西亚|マレーシア|泰国|タイ王国|印度尼西亚|インドネシア|越南|ベトナム|菲律宾|フィリピン|柬埔寨|カンボジア|ラオス|ミャンマー|ブルネイ/gi],
    ["south_asia", /\b(?:south asia|india|pakistan|bangladesh|sri lanka|nepal|bhutan|maldives)\b|南亚|南アジア|印度(?!尼西亚)|インド(?!ネシア)|巴基斯坦|パキスタン|孟加拉|バングラデシュ|斯里兰卡|スリランカ|尼泊尔|ネパール/gi],
    ["oceania", /\b(?:oceania|australia|australian|new zealand|sydney|melbourne)\b|大洋洲|澳大利亚|澳洲|オーストラリア|豪州|新西兰|ニュージーランド/gi],
    ["north_america", /\b(?:north america|united states|USA|canada|canadian|boston|california|san diego|new york)\b|\bU\.S\.(?:A\.)?(?![a-z])|\bUS(?=\s+(?:FDA|market|approval|launch|regulator))|美国|美國|米国|米國|米FDA|(?<=[対対])米(?=投資|事業)|米(?=[A-Z][A-Za-z-]+(?:社|との|と|、|,|\s))|加拿大|カナダ|北米|北美/gi],
    ["europe", /\b(?:europe|european|EU|germany|france|UK|united kingdom|switzerland|netherlands|belgium|italy|spain|sweden|denmark|finland|norway|poland|ireland)\b|欧洲|欧州|欧盟|欧連合|德国|ドイツ|法国|フランス|英国|イギリス|瑞士|スイス|荷兰|オランダ|比利时|ベルギー|意大利|イタリア|西班牙|スペイン|丹麦|デンマーク|瑞典|スウェーデン|芬兰|フィンランド|挪威|ノルウェー/gi],
    ["latin_america", /\b(?:latin america|south america|central america|mexico|brazil|argentina|chile|colombia|peru)\b|拉丁美洲|拉美|南美|南米|中南米|中南美|墨西哥|メキシコ|巴西|ブラジル|阿根廷|アルゼンチン/gi],
    ["middle_east", /\b(?:middle east|saudi arabia|united arab emirates|UAE|israel|qatar)\b|中东|中東|沙特|サウジアラビア|阿联酋|アラブ首長国連邦|以色列|イスラエル/gi],
    ["africa", /\b(?:africa|african|south africa|egypt|kenya|nigeria)\b|非洲|アフリカ|南非|南アフリカ|埃及|エジプト|肯尼亚|ケニア/gi],
    ["apac_unspecified", /\b(?:APAC|asia[- ]pacific)\b|亚太|亞太|アジア太平洋/gi],
    ["asia_unspecified", /(?<!southeast |south east |south |central |east )\basia\b(?![- ]pacific)|(?<!东南|東南|南|东|東|中)亚洲|(?<!東南|南|東|中央)アジア(?!太平洋)/gi],
    ["global", /\b(?:global(?:ly)?|worldwide)\b|全球|全世界|グローバル/gi],
  ];
  const regulators = [
    { pattern: /\bFDA\b|米FDA|美国食品药品监督管理局/gi, region: "north_america", label: "美国 FDA 监管辖区", url: "https://www.fda.gov/about-fda/what-we-do" },
    { pattern: /\bEMA\b|\bCHMP\b|欧洲药品管理局/gi, region: "europe", label: "欧盟药品监管程序", url: "https://www.ema.europa.eu/en/about-us/what-we-do" },
    { pattern: /\bPMDA\b|厚生労働省|厚生劳动省/gi, region: "japan", label: "日本药品监管程序", url: "https://www.pmda.go.jp/english/about-pmda/0001.html" },
    { pattern: /\bTGA\b/gi, region: "oceania", label: "澳大利亚 TGA 监管辖区", url: "https://www.tga.gov.au/" },
  ];
  const regulatoryAction = /approv|authori[sz]|submission|application|review|clearance|recall|reject|designation|许可|批准|申請|申请|承認|審査|审查|認定|认定|召回|拒绝|优先审评/i;
  const scopeAction = /licens|rights|develop|clinical|trial|commercial|launch|rollout|distribut|supply|market|sales|operations|conference|meeting|许可|授权|開発|开发|販売|销售|供[应給]|临床|臨床|試験|试验|商[业業]化|市场|提供|大会|会議|会议/i;
  const reasons = [
    { id: "source_limited", label: "材料不完整，需要补原文", note: "已判读可用材料，但未能获得足够原文；不根据技术标题、既有摘要或公司国籍补地区。" },
    { id: "place_missing", label: "已读原文，地点仍未明确", note: "已读材料未给出本次项目地点或权利范围，不等于公司从未披露。会议先补查同届主办方会址，不能仅因参会公告省略会址就停在此类。" },
    { id: "vague", label: "范围表述不具体", note: "只有国内、海外、国际等表述，不能确定具体国家。" },
    { id: "weak", label: "仅辅助或被排除的线索", note: "地区仅出现在既有摘要、来源名、公司简介、联系地址或排除条款。" },
    { id: "short", label: "来源材料较短", note: "无有效来源摘录，或摘录去除标题后不足 60 字符；不能只凭公司名称补地区。" },
    { id: "unspecified", label: "材料未明确地区", note: "现有标题和摘录未识别出具体地区；常见于技术文章、财报或组织调整，也可能有词表遗漏。" },
  ];

  // Reviewed evidence is tied to an existing record and a title guard, never inferred from its AI summary.
  const reviewed = [
    { ids: ["25585e893f5bb468", "34cd5c5b8acdd97b"], guard: /DS1025/i, regions: ["japan", "asia_unspecified", "europe"], quote: "日本を含むアジアおよび欧州", note: "DS1025 试验计划在这些地区招募患者，不代表每个中心已经启动。", url: "https://www.daiichisankyo.co.jp/files/news/pressrelease/pdf/202608/20260828_J.pdf", kind: "计划试验范围" },
    { ids: ["10441cf2c0d6077f"], guard: /テセントリク/, regions: ["japan"], quote: "適応拡大の承認申請を、本日、厚生労働省に行いました", note: "向日本厚生劳动省提交适应证扩展申请，不等于获批。", url: "https://www.chugai-pharm.co.jp/news/detail/20260814153000_1606.html", kind: "申请监管辖区" },
    { ids: ["35f39b631e792318", "4e98b27a0b73fe34", "ed04209a9d9a544f"], guard: /バミキバルト/, regions: ["japan"], quote: "厚生労働省に製造販売承認申請を行いました", note: "日本上市申请；通过原始公告核定‘国内’所指范围。", url: "https://www.chugai-pharm.co.jp/news/detail/20260825153000_1610.html", kind: "申请监管辖区" },
    { ids: ["9e3775de960f2865"], guard: /AID351/, regions: ["global"], quote: "全世界における開発、製造", note: "全球许可的开发和制造权利范围，不代表已在全球上市。", url: "https://www.chugai-pharm.co.jp/news/detail/20260818113000_1599.html", kind: "许可地域范围" },
    { ids: ["1e26832cc0109438"], guard: /Dato-DXd|DS-1062/, regions: ["japan", "asia_unspecified", "europe", "north_america", "latin_america"], quote: "日本を含むアジア、欧州、北米および南米", note: "第 3 相试验计划招募地区，不表示各地区已经完成入组。", url: "https://www.daiichisankyo.co.jp/files/news/pressrelease/pdf/202608/20260827_J.pdf", kind: "计划试验范围" },
  ].map(entry => ({ ...entry, checkedAt: "2026-09-09" }));
  const normalize = value => String(value || "").normalize("NFKC");
  const cache = new WeakMap();
  const reviewFor = item => semanticReviews.entries.find(entry => entry.ids.includes(item.id) && entry.guard.test(item.title || "")) || null;
  function scan(text, field, label, auxiliary = false) {
    const hits = [];
    // Keep sentence boundaries without splitting U.S.; each excerpt is bounded, not a full-page keyword scan.
    const chunks = normalize(text).slice(0, 6000).split(/(?<=[。！？;；\n])|(?<=[.!?])\s+(?=[A-Z][a-z])/);
    for (const chunk of chunks) {
      const boilerplate = /headquarter|based in|contact:|registered office|本社[：:はを]|总部|所在地[：:]|お問い合わせ|联系地址|investor contact|官网的新产品信息|官网的公开页面/i.test(chunk) || /^[A-Z][A-Z\s]+,\s.*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/.test(chunk);
      const promotional = /global(?:ly)?[- ](?:leading|leader)|worldwide leader|全球领先|世界领先|グローバルリーダー/i.test(chunk);
      const push = (region, word, index, kind, url = "") => {
        const before = chunk.slice(Math.max(0, index - 32), index);
        const after = chunk.slice(index + word.length, index + word.length + 36);
        const excluded = /(?:exclud(?:e|es|ing)|except|outside|不含|不包括|除外|除|未确认|无法确认|不能说明|不能推断)\s*$/i.test(before) || /^(?:を除く|以外|以外の|除外)/.test(after);
        const publisher = [...chunk.matchAll(/日本経済新聞(?:社)?|Japan Times|Taiwan News|China Daily|BioSpectrum Asia/gi)].some(match => index >= match.index && index < match.index + match[0].length);
        const rejected = auxiliary ? "辅助材料不直接计入" : publisher ? "媒体名称不计入新闻地区" : boilerplate ? "公司简介 / 地址 / 入口说明不计入" : excluded ? "被排除或未确认的地区不计入" : "";
        hits.push({ field, label, region, word, kind, url, quote: chunk.trim(), auxiliary, accepted: !rejected, rejected });
      };
      for (const [region, pattern] of patterns) {
        for (const match of chunk.matchAll(new RegExp(pattern))) {
          const globalProperName = /^(?:Worldwide\s+(?:Clinical Trials|division)|Global\s+(?:Healthcare|Health Care|Diagnostics)\s+(?:Conference|Specialist))/i.test(chunk.slice(match.index));
          if (region === "global" && (!scopeAction.test(chunk) || promotional || globalProperName)) {
            hits.push({ field, label, region, word: match[0], quote: chunk.trim(), accepted: false, rejected: "机构 / 会议名称、全球宣传词或无明确业务范围", auxiliary, kind: "泛化表述" });
            continue;
          }
          push(region, match[0], match.index, "明确地区词");
        }
      }
      for (const regulator of regulators) {
        for (const match of chunk.matchAll(new RegExp(regulator.pattern))) {
          if (regulatoryAction.test(chunk)) push(regulator.region, match[0], match.index, regulator.label, regulator.url);
        }
      }
    }
    return hits;
  }
  function base(item) {
    if (cache.has(item)) return cache.get(item);
    const excerpts = [...new Set([item.summary, item.evidence?.source_excerpt].filter(Boolean))].join("\n");
    const fields = [
      [item.title, "title", "标题", false], [excerpts, "excerpt", "来源摘录", false],
      [[item.ai_summary, item.ai_summary_en].filter(Boolean).join("\n"), "ai", "既有摘要", true],
      [(item.source_labels || [item.source_label]).filter(Boolean).join(" / "), "source", "来源名称", true],
    ];
    const evidence = fields.flatMap(args => scan(...args));
    const unique = [...new Map(evidence.map(hit => [`${hit.field}|${hit.region}|${hit.word}|${hit.kind}|${hit.accepted}`, hit])).values()];
    const verified = reviewed.filter(entry => entry.ids.includes(item.id) && entry.guard.test(item.title || "")).flatMap(entry => entry.regions.map(region => ({ ...entry, field: "reviewed", label: "原文核对", region, word: entry.quote, accepted: true, auxiliary: false })));
    const value = { evidence: unique, verified, excerpts };
    cache.set(item, value);
    return value;
  }
  function analyze(item, mode = "reviewed") {
    const { evidence, verified, excerpts } = base(item);
    const semanticReview = reviewFor(item);
    if (mode === "reviewed" && semanticReview) {
      const curated = semanticReview.evidence.flatMap(source => (source.regions.length ? source.regions : ["unknown"]).map(region => ({ ...source, region, field: "semantic", label: "AI 地区判读", word: source.quote, checkedAt: semanticReview.checkedAt, accepted: semanticReview.status !== "pending", auxiliary: false })));
      const ids = new Set(curated.filter(hit => hit.accepted).map(hit => hit.region));
      const regions = definitions.filter(region => ids.has(region.id)).map(region => region.id);
      return { regions: regions.length ? regions : ["unknown"], evidence: [...evidence.map(hit => ({ ...hit, accepted: false, rejected: hit.rejected || "本条以已保存的材料语义判读为准，实际阅读范围见记录" })), ...curated], reason: semanticReview.reason, review: semanticReview };
    }
    const all = [...evidence, ...verified.map(hit => ({ ...hit, accepted: mode === "reviewed", rejected: mode === "reviewed" ? "" : "当前只统计标题 / 来源摘录" }))];
    const ids = new Set(all.filter(hit => hit.accepted).map(hit => hit.region));
    const regions = definitions.filter(region => ids.has(region.id)).map(region => region.id);
    let reason = null;
    if (!regions.length) {
      const raw = normalize(`${item.title || ""}\n${excerpts}`);
      const residue = normalize(excerpts).replace(normalize(item.title), "").trim();
      reason = /国内|海外|international|国際|国际/i.test(raw) ? "vague" : all.length ? "weak" : residue.length < 60 ? "short" : "unspecified";
    }
    return { regions: regions.length ? regions : ["unknown"], evidence: all, reason, review: null };
  }
  function partition(items, mode = "reviewed") {
    const unique = [...new Map(items.map(item => [item.id, item])).values()];
    const groups = { located: [], nonregional: [], pending: [], reviewed: [], unreviewed: [], source_limited: [], place_missing: [], inactive: [] };
    for (const item of unique) {
      const result = analyze(item, mode);
      const saved = reviewFor(item);
      groups[saved ? "reviewed" : "unreviewed"].push(item);
      if (result.regions.includes("unknown")) {
        groups.pending.push(item);
        if (saved && mode !== "reviewed") groups.inactive.push(item);
        else if (["source_limited", "place_missing"].includes(result.reason)) groups[result.reason].push(item);
      } else groups[result.regions.includes("nonregional") ? "nonregional" : "located"].push(item);
    }
    return groups;
  }
  const apac = definitions.filter(row => row.apac).map(row => row.id);
  const families = [
    { id: "apac", label: "亚太", members: apac },
    ...["north_america", "europe", "latin_america", "middle_east", "africa"].map(id => ({ id, label: definitions.find(row => row.id === id).label, members: [id] })),
  ];
  const scopeIds = ["global", "asia_unspecified"];
  function distribution(items, mode = "reviewed") {
    const unique = [...new Map(items.map(item => [item.id, item])).values()];
    return families.map(family => ({ ...family, items: unique.filter(item => analyze(item, mode).regions.some(id => family.members.includes(id))) }));
  }
  const model = Object.freeze({ version: "2026-09-09.4", definitions, reasons, regulators, reviewed, semanticReviews: semanticReviews.entries, reviewScope: semanticReviews.scope, reviewFor, analyze, partition, apac, families, scopeIds, distribution });
  root.AIHOT_REGION_MODEL = model;
  if (typeof module !== "undefined" && module.exports) module.exports = model;
})(typeof window === "undefined" ? globalThis : window);
