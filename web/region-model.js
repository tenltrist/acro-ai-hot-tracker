(function (root) {
  "use strict";
  const registry = root.AIHOT_REGION_REVIEWS || (typeof module !== "undefined" && module.exports ? require("./region-reviews.js") : { entries: [], scope: {} });
  const businessDefinitions = [
    { id: "japan", label: "日本", country: "JP" },
    { id: "korea", label: "韩国", country: "KR" },
    { id: "india", label: "印度", country: "IN" },
    { id: "singapore", label: "新加坡", country: "SG" },
    { id: "australia", label: "澳大利亚", country: "AU" },
    { id: "other", label: "其他国家" },
  ].map(row => ({ ...row, scope: row.country ? "原文明确指向" + row.label + "的国家或具体地点证据。" : "除五个单列国家外的明确国家或地区；无具体国家证据不计入。" }));
  const definitions = [...businessDefinitions, { id: "unknown", label: "地区待确认", scope: "内部证据状态，不是其他国家；保留在总计和未筛选列表中。" }];
  const reasons = [
    { id: "source_limited", label: "材料不完整，需要补原文", note: "已有材料不足；不能从公司所在地或旧摘要补国家。" },
    { id: "place_missing", label: "已读材料未明确国家", note: "只描述实际阅读范围，不声称公司从未披露地点。" },
    { id: "vague", label: "仅有宽泛地域范围", note: "全球、亚洲、亚太、欧洲、国内、海外等不展开为具体国家。" },
    { id: "weak", label: "只有被排除的辅助线索", note: "来源名、公司所在地、联系地址、旧判读的推断和排除条款不计入。" },
    { id: "short", label: "来源材料较短", note: "只读标题或短摘录不等于已读全文，不补猜国家。" },
    { id: "unspecified", label: "材料未明确国家", note: "现有原文材料没有可采用的具体国家或地点证据。" },
  ];
  const normalize = value => String(value || "").normalize("NFKC");
  const escapePattern = value => value.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");
  // ISO country/territory names are labels, not evidence inferred from company metadata.
  const codes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
  const aliases = new Map();
  const add = (country, words) => words.split("|").filter(Boolean).forEach(word => aliases.set(normalize(word), country));
  for (const locale of ["en", "zh-Hans", "zh-Hant", "ja"]) {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    for (const code of codes) add(code, names.of(code));
  }
  add("JP", "Japan|日本|东京|東京|大阪|京都|横滨|横浜|神户|神戸|Tokyo|Osaka|Kyoto|Yokohama|Kobe|BioJapan");
  add("KR", "South Korea|Republic of Korea|大韩民国|大韓民国|韩国|韓國|韓国|首尔|首爾|ソウル|Seoul|Bio Korea");
  add("IN", "India|印度|インド|新德里|ニューデリー|New Delhi|孟买|ムンバイ|Mumbai|Bengaluru|Bangalore");
  add("SG", "Singapore|新加坡|シンガポール");
  add("AU", "Australia|澳大利亚|澳洲|オーストラリア|豪州|Sydney|Melbourne|悉尼|シドニー|墨尔本|メルボルン");
  add("US", "United States|United States of America|USA|U.S.|U.S.A.|美国|美國|米国|米國|アメリカ|New York|Boston|San Diego|California|Texas|St. Louis|纽约|紐約|ボストン|ニューヨーク");
  add("GB", "United Kingdom|Great Britain|Britain|英国|英國|イギリス|London|伦敦|ロンドン");
  add("CN", "China|中国|中國|Beijing|Shanghai|Shenzhen|Suzhou|北京|上海|深圳|苏州|蘇州");
  add("CA", "Canada|加拿大|カナダ|Toronto|多伦多|トロント");
  add("AS", "American Samoa|美属萨摩亚|美屬薩摩亞|澳属萨摩亚|アメリカ領サモア");
  add("AE", "United Arab Emirates|阿联酋|阿聯酋|阿拉伯联合酋长国|アラブ首長国連邦");
  add("RU", "Russia|Russian Federation|俄罗斯|俄羅斯|ロシア");
  add("TR", "Turkey|Türkiye|土耳其|トルコ");
  add("VN", "Vietnam|Viet Nam|越南|ベトナム");
  add("LA", "Laos|Lao PDR|老挝|寮國|ラオス");
  add("MM", "Myanmar|Burma|缅甸|緬甸|ミャンマー");
  add("PS", "Palestine|Palestinian territories|巴勒斯坦|パレスチナ");
  add("TL", "East Timor|Timor-Leste|东帝汶|東帝汶|東ティモール");
  add("IR", "Iran|伊朗|イラン");
  add("SY", "Syria|叙利亚|敘利亞|シリア");
  add("SA", "Saudi Arabia|沙特阿拉伯|沙特|沙烏地阿拉伯|サウジアラビア");
  add("SB", "Solomon Islands|所罗门群岛|所羅門群島|ソロモン諸島");
  add("PF", "French Polynesia|法属波利尼西亚|法屬波利尼西亞|フランス領ポリネシア");
  add("NC", "New Caledonia|新喀里多尼亚|新喀里多尼亞|ニューカレドニア");
  const wordPattern = [...aliases.keys()].sort((a, b) => b.length - a.length).map(word => {
    const escaped = escapePattern(word);
    return /[A-Za-z]/.test(word) ? "(?<![A-Za-z0-9])" + escaped + "(?![A-Za-z0-9])" : escaped;
  }).join("|");
  const countryPattern = new RegExp(wordPattern, "giu");
  const aliasLookup = new Map([...aliases].map(([word, country]) => [word.toLowerCase(), country]));
  const bucket = country => businessDefinitions.find(row => row.country === country)?.id || "other";
  const reasonPattern = /\b(?:global|worldwide|APAC|Asia|Europe|Africa|international|overseas|domestic)\b|全球|亚洲|亚太|欧洲|非洲|国内|海外|欧州|アジア|グローバル/iu;
  const reviewFor = item => registry.entries.find(entry => entry.ids.includes(item.id) && entry.guard.test(item.title || "")) || null;

  function scan(text, field = "excerpt", label = "来源摘录", source = {}) {
    const hits = [];
    const chunks = normalize(text).slice(0, 12000).split(/(?<=[。！？;；\n])|(?<=[.!?])(?<!\bSt\.)(?<!\bDr\.)\s+(?=[A-Z][a-z])/);
    for (const chunk of chunks) {
      const matches = [...chunk.matchAll(countryPattern)].map(match => ({ word: match[0], index: match.index, country: aliasLookup.get(match[0].toLowerCase()) }));
      // Uppercase abbreviations must not match English pronouns ("us", "in").
      for (const match of chunk.matchAll(/\b(?:US|UK|UAE)\b|米(?=FDA|[A-Z][A-Za-z-]*(?:社|企業))/g)) matches.push({ word: match[0], index: match.index, country: { US: "US", UK: "GB", UAE: "AE", 米: "US" }[match[0]] });
      for (const match of matches) {
        const before = chunk.slice(0, match.index);
        const after = chunk.slice(match.index + match.word.length);
        const names = /日本(?:語|语|新薬|新藥|化薬|化藥|製薬|制药|ケミファ|経済新聞|經濟新聞)|印度洋|インド洋|Japan Times|Taiwan News|China Daily|BioSpectrum Asia|Singapore Exchange/giu;
        const nameOnly = [...chunk.matchAll(names)].some(name => match.index >= name.index && match.index < name.index + name[0].length);
        const locationPrefix = /headquarter(?:s|ed)?(?:\s+(?:is|are))?\s+in\s+(?:the\s+)?|based\s+in\s+(?:the\s+)?|本社[：:はを]?|总部(?:位于|设在|：|:)?|所在地[：:]/i;
        const location = locationPrefix.exec(before);
        const address = location && !before.slice(location.index + location[0].length).replace(countryPattern, "").replace(/\band\b|以及|及|和|と/gi, "").replace(/[\s,、，-]/g, "");
        const corporateLocation = /^(?:[- ]based\b|に本社|本社|总部)/i.test(after);
        const contact = /contact:|registered office|お問い合わせ|联系地址|investor contact|官网的新产品信息|官网的公开页面/i.test(chunk);
        const wireDate = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/.exec(chunk);
        const dateline = /^[A-Z][A-Z\s.,]+,/.test(chunk) && wireDate && match.index < wireDate.index;
        const exclusion = /(?:exclud(?:e|es|ing)|except|outside|不含|不包括|除外|除|未确认|无法确认|不能说明|不能推断)\s*$/i.test(before) || /^(?:を除く|以外|除外)/.test(after);
        const rejected = source.rejected || (nameOnly ? "公司或来源名称不是事件地点" : contact || address || corporateLocation || dateline ? "公司所在地、联系地址或新闻电头不计入" : exclusion ? "排除或未确认的地区不计入" : "");
        hits.push({ ...source, field, label, country: match.country, region: bucket(match.country), word: match.word, quote: chunk.trim(), kind: source.kind || "原文明确国家 / 地点", accepted: !rejected, rejected });
      }
    }
    return hits;
  }

  function evidenceForReview(review) {
    return review.evidence.flatMap(source => {
      const inferred = /机构所在地|公司所在地|总部|企業所在地/.test(source.kind || "") || source.contextUrl;
      return scan(source.quote, "reviewed", "已保存原文引用", { ...source, checkedAt: review.checkedAt, rejected: inferred ? "旧判读依赖机构所在地，不符合当前国家证据口径" : "" });
    });
  }

  const cache = new WeakMap();
  function analyze(item, mode = "reviewed") {
    let cached = cache.get(item);
    if (!cached) { cached = {}; cache.set(item, cached); }
    if (cached[mode]) return cached[mode];
    const review = reviewFor(item);
    const excerpt = [...new Set([item.summary, item.evidence?.source_excerpt].filter(Boolean))].join("\n");
    const content = [...scan(item.title, "title", "原标题"), ...scan(excerpt)];
    const auxiliary = [
      ...scan([item.ai_summary, item.ai_summary_en].filter(Boolean).join("\n"), "ai", "既有摘要", { rejected: "摘要不是原文地理证据" }),
      ...scan((item.source_labels || [item.source_label]).filter(Boolean).join("\n"), "source", "来源名称", { rejected: "来源所在地不是事件地点" }),
    ];
    const saved = mode === "reviewed" && review ? evidenceForReview(review) : [];
    // Explicit reviews narrow long excerpts to the relevant event; their old region
    // labels never become country evidence. Pending reviews can gain new clues.
    const narrowed = mode === "reviewed" && review && review.status !== "pending";
    const evidence = [...content.map(hit => narrowed ? { ...hit, accepted: false, rejected: hit.rejected || "采用已保存的事件原文引用，避免混入背景国家" } : hit), ...saved, ...auxiliary];
    const countries = [...new Set(evidence.filter(hit => hit.accepted).map(hit => hit.country))];
    const ids = new Set(countries.map(bucket));
    const regions = businessDefinitions.filter(row => ids.has(row.id)).map(row => row.id);
    const material = narrowed ? review.evidence.map(source => source.quote).join("\n") : (item.title || "") + "\n" + excerpt;
    const reason = regions.length ? null : review?.reason || (reasonPattern.test(material) ? "vague" : evidence.length ? "weak" : excerpt.replace(item.title || "", "").trim().length < 60 ? "short" : "unspecified");
    return (cached[mode] = { regions: regions.length ? regions : ["unknown"], countries, evidence, reason, review: mode === "reviewed" ? review : null });
  }

  function partition(items, mode = "reviewed") {
    const groups = { located: [], pending: [], reviewed: [], unreviewed: [], source_limited: [], place_missing: [], inactive: [] };
    for (const item of new Map(items.map(row => [row.id || row.url, row])).values()) {
      const result = analyze(item, mode);
      groups[reviewFor(item) ? "reviewed" : "unreviewed"].push(item);
      groups[result.regions.includes("unknown") ? "pending" : "located"].push(item);
      if (result.regions.includes("unknown") && ["source_limited", "place_missing"].includes(result.reason)) groups[result.reason].push(item);
      if (mode !== "reviewed" && reviewFor(item)) groups.inactive.push(item);
    }
    return groups;
  }
  const families = businessDefinitions.map(row => ({ ...row, members: [row.id] }));
  function distribution(items, mode = "reviewed") {
    const unique = [...new Map(items.map(row => [row.id || row.url, row])).values()];
    return families.map(row => ({ ...row, items: unique.filter(item => analyze(item, mode).regions.includes(row.id)) }));
  }
  const model = Object.freeze({ version: "2026-09-16.business-countries", definitions, businessDefinitions, reasons, families, reviewFor, analyze, partition, distribution, scan, evidenceForReview, countryCodes: codes, semanticReviews: registry.entries, reviewScope: registry.scope });
  root.AIHOT_REGION_MODEL = model;
  if (typeof module !== "undefined" && module.exports) module.exports = model;
})(typeof window === "undefined" ? globalThis : window);
