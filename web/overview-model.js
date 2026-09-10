/* Pure event and period model, shared by the dashboard and regression tests. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.AIHOT_OVERVIEW_MODEL = model;
})(typeof window === "undefined" ? globalThis : window, function () {
  const DAY = 86400000;
  const unique = (values) => [...new Set(values.filter(Boolean))];
  function date(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
    if (!match) return "";
    const [, y, m, d] = match.map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return "";
    return parsed.toISOString().slice(0, 10);
  }
  const offset = (value, days) => new Date(Date.parse(value) + days * DAY).toISOString().slice(0, 10);
  function period(mode, anchor) {
    const day = date(anchor);
    if (!day) throw new Error("Invalid period date");
    const value = new Date(`${day}T00:00:00Z`);
    if (mode === "month") {
      const start = `${day.slice(0, 7)}-01`;
      const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      return { mode, start, end, days: Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1 };
    }
    const start = offset(day, -((value.getUTCDay() + 6) % 7));
    return { mode: "week", start, end: offset(start, 6), days: 7 };
  }
  function shift(range, direction) {
    if (range.mode === "week") return offset(range.start, 7 * direction);
    const start = new Date(`${range.start}T00:00:00Z`);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + direction, 1)).toISOString().slice(0, 10);
  }
  function canonicalUrl(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
      }
      url.searchParams.sort();
      return url.href.replace(/\/$/, "");
    } catch { return ""; }
  }
  function publicationDate(item) {
    // Legacy event_start_at was copied from item.published, not verified as an event date.
    if (item.signal_type === "event" && !item.date_provenance?.published) return "";
    if ((item.evidence?.source_types || []).some(type => ["sitemap_urls", "clinical_trials"].includes(type)) && !item.date_provenance?.published) return "";
    return date(item.published_at || item.published);
  }
  function eventDate(item) {
    return item.date_provenance?.event_verified ? date(item.event_start_at) : "";
  }
  const topicTerms = [
    ["CGT", /\bCGT\b|cell and gene therap|细胞与基因治疗|細胞[・と]遺伝子治療/i],
    ["ADC", /\bADCs?\b|antibody.drug conjugate|抗体偶联|抗体薬物複合体/i],
    ["CAR-T", /\bCAR[ -]?T\b/i], ["CAR-NK", /\bCAR[ -]?NK\b/i],
    ["iPSC", /\biPSCs?\b|iPS細胞|诱导多能干细胞/i],
    ["mRNA", /\bmRNA\b/i], ["抗体", /\bantibod(?:y|ies)\b|抗体|抗體/i],
    ["重组蛋白", /recombinant protein|重组蛋白|組換えタンパク/i],
    ["细胞治疗", /cell therap|細胞治療|细胞治疗/i],
    ["基因治疗", /gene therap|遺伝子治療|基因治疗/i],
    ["类器官", /organoid|オルガノイド|类器官/i],
    ["流式细胞术", /flow cytometr|フローサイトメトリ|流式/i],
    ["单细胞", /single.cell|シングルセル|单细胞/i],
    ["GMP", /\bGMP\b/i], ["ELISA", /\bELISA\b/i],
    ["CRISPR", /\bCRISPR\b/i], ["生物工艺", /bioprocess|バイオプロセス|生物工艺/i],
    ["多肽", /\bpeptide|ペプチド|多肽/i], ["细胞培养", /cell culture|細胞培養|细胞培养/i],
    ["测序", /sequencing|シーケン|测序/i], ["质谱", /mass spectrometr|質量分析|质谱/i],
    ["色谱", /chromatograph|クロマトグラフィ|色谱/i], ["核酸", /nucleic acid|核酸/i],
    ["干细胞", /stem cell|幹細胞|干细胞/i], ["小分子", /small molecule|低分子|小分子/i],
  ];
  function topics(item) {
    const text = `${item.title || ""} ${item.summary || ""}`;
    const extracted = [...(item.intelligence?.targets || []), ...(item.intelligence?.modalities || [])]
      .filter(term => term && text.toLowerCase().includes(term.toLowerCase()));
    const canonical = term => topicTerms.find(([, pattern]) => pattern.test(term))?.[0] || term;
    return unique([...topicTerms.filter(([, pattern]) => pattern.test(text)).map(([label]) => label), ...extracted.map(canonical)]);
  }
  function titleKey(item) {
    return String(item.title || "").replace(/\s+[-|]\s+(?:Business Wire|PR Newswire|Yahoo Finance|GlobeNewswire|ACROBiosystems|Taiwan News)$/i, "")
      .normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  }
  function buildEvents(items, { companies = [], classify, regions } = {}) {
    const companyIds = new Set(companies.map(company => company.id));
    const records = new Map();
    for (const item of items) {
      const key = item.id || item.url;
      const prior = records.get(key);
      if (!prior) records.set(key, item);
      else records.set(key, {
        ...prior, ...item,
        related_urls: unique([...(prior.related_urls || []), ...(item.related_urls || [])]),
        source_ids: unique([...(prior.source_ids || []), ...(item.source_ids || [])]),
        source_labels: unique([...(prior.source_labels || []), ...(item.source_labels || [])]),
      });
    }
    const groups = [];
    const links = new Map();
    const titles = new Map();
    for (const item of records.values()) {
      const published = publicationDate(item);
      const ids = unique([...(item.matched_company_ids || []), item.company_id]).filter(id => companyIds.has(id));
      const url = canonicalUrl(item.url);
      const key = titleKey(item);
      const titleGroup = published && key.length >= 35 ? titles.get(`${published}:${key}`) : null;
      // Identical URLs with different dated updates remain separate records.
      let group = url ? links.get(`${url}:${published}:${key}`) : null;
      if (!group && titleGroup && (ids.some(id => titleGroup.companyIds.includes(id)) || (!ids.length && !titleGroup.companyIds.length))) group = titleGroup;
      if (!group) {
        group = { id: item.id || url, reports: [], companyIds: [], published, eventDate: eventDate(item), topics: [], regions: [], categories: [] };
        groups.push(group);
      }
      group.reports.push(item);
      group.companyIds = unique([...group.companyIds, ...ids]);
      group.topics = unique([...group.topics, ...topics(item)]);
      group.regions = unique([...group.regions, ...(regions ? regions(item) : [])]);
      group.categories = unique([...group.categories, classify ? classify(item) : item.business_event_type || "corporate_strategy"]);
      if (url) links.set(`${url}:${published}:${key}`, group);
      if (published && key.length >= 35) titles.set(`${published}:${key}`, group);
    }
    return groups.map(group => {
      group.reports.sort((a, b) => Number(b.summary_method === "manual_ai") - Number(a.summary_method === "manual_ai") || String(b.archive_last_seen || "").localeCompare(String(a.archive_last_seen || "")));
      group.item = group.reports[0];
      group.category = group.categories[0];
      group.roles = unique(group.companyIds.map(id => companies.find(c => c.id === id)?.business_role));
      if (!group.roles.length) group.roles = ["industry"];
      group.regions = group.regions.filter(region => region !== "unknown");
      if (group.regions.some(region => region !== "nonregional")) group.regions = group.regions.filter(region => region !== "nonregional");
      if (!group.regions.length) group.regions = ["unknown"];
      if (!group.topics.length) group.topics = ["unidentified"];
      const evidence = new Map();
      for (const report of group.reports) {
        const urls = unique([report.url, ...(report.related_urls || []), ...(report.evidence?.related_urls || [])]);
        for (const raw of urls) {
          const url = canonicalUrl(raw);
          if (!url) continue;
          const prior = evidence.get(url) || { url, labels: [], reportIds: [] };
          prior.labels = unique([...prior.labels, ...(report.source_labels || [report.source_label])]);
          prior.reportIds = unique([...prior.reportIds, report.id]);
          evidence.set(url, prior);
        }
      }
      group.evidence = [...evidence.values()];
      return group;
    }).sort(compareRecent);
  }
  function compareRecent(a, b) {
    return (b.published || "").localeCompare(a.published || "") || String(a.id).localeCompare(String(b.id));
  }
  function select(events, scope, range, mode = "period") {
    const query = String(scope.query || "").toLowerCase().trim();
    return events.filter(event => {
      if (mode === "period" && (!event.published || event.published < range.start || event.published > range.end || event.published > (scope.today || range.end))) return false;
      if (mode === "unknown" && event.published) return false;
      if (scope.company && scope.company !== "all" && !event.companyIds.includes(scope.company)) return false;
      if (scope.role && scope.role !== "all" && !event.roles.includes(scope.role)) return false;
      if ((scope.signalType && scope.signalType !== "all") || (scope.relevance && scope.relevance !== "all")) {
        if (!event.reports.some(report => (!scope.signalType || scope.signalType === "all" || report.signal_type === scope.signalType) && (!scope.relevance || scope.relevance === "all" || report.acro_relevance?.level === scope.relevance))) return false;
      }
      if (scope.regions?.length && !scope.regions.some(region => event.regions.includes(region))) return false;
      if (scope.category && scope.category !== "all" && event.category !== scope.category) return false;
      if (scope.topic && scope.topic !== "all" && !event.topics.includes(scope.topic)) return false;
      if (query && !event.reports.some(report => `${report.title} ${report.title_zh || ""} ${report.summary || ""} ${(report.matched_companies || []).join(" ")}`.toLowerCase().includes(query))) return false;
      return true;
    }).sort(compareRecent);
  }
  function buckets(events, field) {
    const counts = new Map();
    for (const event of events) {
      for (const value of unique(Array.isArray(event[field]) ? event[field] : [event[field]])) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  }
  return { date, offset, period, shift, canonicalUrl, publicationDate, eventDate, topics, buildEvents, select, buckets, compareRecent };
});
