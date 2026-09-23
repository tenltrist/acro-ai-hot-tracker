/* Business-reviewed product taxonomy. Does not alter admission, scores or technology tags. */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.AIHOT_PRODUCT_MODEL = model;
})(typeof window === "undefined" ? globalThis : window, function () {
  const version = "2026-09-18.kaidi-products-v1";
  const directions = { customer: "客户研发相关", competitor: "竞品产品相关", unspecified: "观察方向未明确" };
  const definitions = [
    { id: "drug", label: "药物产品", note: "药物与治疗研究；泛词须有明确治疗或药物研发语境。", removed: [], row: 4 },
    { id: "protein", label: "重组蛋白", note: "具体蛋白产品，或明确的靶点蛋白治疗研究；核酸酶产品与靶点研发分开观察。", removed: ["融合蛋白", "酶（泛称）"], row: 5 },
    { id: "antibody", label: "抗体", note: "具体抗体类型、药物或试剂；同义名称归一。", removed: ["科研型抗体（泛称）"], row: 6 },
    { id: "assay", label: "试剂盒与检测产品", note: "检测产品须有试剂盒或试剂证据；方法或服务描述不当作产品。", removed: ["ELISpot", "PCR", "流式检测", "病毒滴度"], row: 7 },
    { id: "cell", label: "细胞株与类器官", note: "细胞株、类器官等材料产品；不以单独的 T / B 细胞名称归类。", removed: ["肿瘤细胞", "免疫细胞", "T细胞", "B细胞"], row: 8 },
    { id: "culture", label: "细胞培养产品", note: "培养基、细胞激活与扩增试剂；细胞因子、生长因子归重组蛋白，不重复触发本类。", removed: ["血清", "培养补充剂", "转染试剂", "细胞冻存产品"], row: 9 },
    { id: "bead", label: "磁珠与耗材", note: "保留独立分类，关注磁珠、细胞分选材料和培养袋。", removed: ["培养板", "微流控芯片", "过滤组件", "一次性耗材（泛称）"], row: 10 },
    { id: "equipment", label: "仪器设备", note: "具体设备发布、采购或升级，以及 CMC 生产、GMP 设施动态；暂不改名。", removed: ["质谱仪", "色谱设备"], row: 13 },
    { id: "service", label: "定制服务", note: "具体定制、开发或检测服务；AI辅助蛋白开发也可为客户研发。", removed: ["工艺开发"], row: 14 },
  ];
  const pending = [
    "“细胞技术设备”是否指“细胞计数设备”待确认，暂保留细胞计数设备。",
    "仪器设备已包含 CMC 生产、GMP 设施；建议名称为“设备与生产设施”，尚未作为业务确认改名。",
    "“化学合成培养基”按原词保留，未自动替换为 chemically defined medium 或其他术语。",
    "磁珠暂不并入细胞培养；细胞因子、生长因子仅归重组蛋白，明确培养产品仍可同时命中。",
    "ADA、RDC、tLNP 按原缩写识别，未扩写业务尚未确认的含义；短词仍需对应语境。",
  ];
  // Each term is canonical; regex aliases only identify source words, never company metadata.
  const term = (label, pattern) => ({ label, pattern });
  const antibodyTerms = [
    term("单抗", /\bmonoclonal antibod(?:y|ies)\b|\bmAbs?\b|单克隆抗体|单抗|モノクローナル抗体/i),
    term("双抗", /\bbispecific antibod(?:y|ies)\b|\bBsAbs?\b|双特异性抗体|双抗|二重特異性抗体/i),
    term("ADC", /\bADCs?\b|antibody[ -]drug conjugates?|抗体[药物]*偶联|抗体薬物複合体/i),
    term("RDC", /\bRDCs?\b/i), term("ADA", /\bADA\b/i),
    term("anti-G4S antibody", /\banti[ -]?G4S(?:\s+antibod(?:y|ies))?\b/i),
    term("抗独特型抗体", /anti[ -]idiotyp\w* antibod|抗独特型抗体/i),
    term("抗载荷抗体", /anti[ -]payload antibod|抗载荷抗体/i),
    term("IHC抗体", /IHC\s*(?:antibod|抗体)/i), term("流式抗体", /flow cytometry antibod|流式抗体/i),
    term("细胞表型抗体", /cell phenotyp\w* antibod|细胞表型抗体/i),
    term("通用标签抗体", /tag antibod|标签抗体/i), term("同型对照抗体", /isotype control antibod|同型对照抗体/i),
    term("治疗性抗体", /therapeutic antibod|治疗性抗体/i),
    term("靶点抗体", /\banti[ -](?:HER2|CD20|PD[ -]?1)\b/i),
  ];
  const researchTerms = [
    term("药物与治疗产品", /\bdrugs?\b|\bmedicines?\b|therapeutic products?|clinical candidates?|新药|药品|医薬品|治療薬/i),
    ...antibodyTerms.slice(0, 4), term("纳米抗体药物", /nanobod\w*|纳米抗体/i),
    term("小分子药物", /small[ -]molecule|小分子|低分子/i), term("多肽药物", /peptide|多肽|ペプチド/i),
    term("重组蛋白药物", /recombinant protein|重组蛋白|組換えタンパク/i),
    term("核酸药物", /nucleic acid|核酸/i), term("细胞治疗", /cell therap|细胞治疗|細胞治療/i),
    term("基因治疗", /gene therap|基因治疗|遺伝子治療/i), term("疫苗", /vaccin|疫苗|ワクチン/i),
    term("放射性药物", /radiopharm|放射性药物/i), term("肿瘤 / 癌症", /\btumou?r\b|\bcancer\b|oncol|肿瘤|癌症|がん|腫瘍/i),
    term("免疫", /immun\w*|免疫/i), term("mRNA", /\bmRNA\b/i),
    term("干细胞", /stem cells?|干细胞|幹細胞/i), term("T细胞", /\bT[ -]?cells?\b|T细胞|T細胞/i),
    term("B细胞", /\bB[ -]?cells?\b|B细胞|B細胞/i),
    ...["MSC", "HSC", "iPSC"].map(label => term(label, new RegExp(`\\b${label}s?\\b`, "i"))),
    term("CAR-T", /\bCAR[ -]?T\b/i), term("NK-T", /\bNK[ -]?T\b/i),
    term("TCR-T", /\bTCR[ -]?T\b/i), term("in vivo-CAR", /\bin[ -]vivo[ -]CAR\b/i),
    term("Neuro", /\bneuro\w*|神经|神経/i), term("病毒", /\bvirus\b|\bviral\b|病毒|ウイルス/i),
    term("类器官", /organoid|类器官|オルガノイド/i),
  ];
  const terms = {
    drug: researchTerms,
    protein: [
      term("重组蛋白", /recombinant proteins?|重组蛋白|組換えタンパク/i),
      term("靶点蛋白", /target proteins?|靶点蛋白|標的タンパク/i),
      term("细胞因子", /cytokine|细胞因子|サイトカイン/i), term("生长因子", /growth factors?|生长因子|成長因子/i),
      term("趋化因子", /chemokine|趋化因子/i), term("免疫检查点蛋白", /checkpoint proteins?|免疫检查点蛋白/i),
      term("受体蛋白", /receptor proteins?|受体蛋白/i), term("配体蛋白", /ligand proteins?|配体蛋白/i),
      term("Fc蛋白", /\bFc proteins?\b|Fc蛋白/i), term("膜蛋白", /membrane proteins?|(?:跨)?膜蛋白/i),
      term("Cas9酶", /\bCas9\b/i), term("DNase", /\b(?:DNases?|deoxyribonucleases?)\b|脱氧核糖核酸酶/i), term("RNase", /\b(?:RNases?|ribonucleases?)\b|(?<!脱氧)核糖核酸酶/i),
      term("MHC", /\bMHC\b/i), term("病毒抗原", /viral antigens?|病毒抗原/i),
      term("神经科学蛋白", /neuroscience proteins?|神经科学蛋白/i),
      term("细胞外基质蛋白", /extracellular matrix proteins?|细胞外基质蛋白/i),
      term("具体蛋白", /\b(?:IL[ -]?(?:2|6|15)|VEGF|PD[ -]?1|PD[ -]?L1|HER2|CD20|BCMA|FcRn|Laminin)\b/i),
      term("具名蛋白产品", /\b(?=[a-z-]*\d)[a-z][a-z\d-]*\s+proteins?\b/i),
    ],
    antibody: antibodyTerms,
    assay: [
      ...["ELISA", "TR-FRET", "qPCR", "PK", "tLNP"].map(label => term(label, new RegExp(`\\b${label}\\b`, "i"))),
      term("PD", /\bPD\b(?![ -]?(?:L?\d))/i),
      term("细胞因子检测", /cytokine.{0,18}(?:assay|detect|quantif)|细胞因子.{0,8}检测/i),
      term("Biomarker检测", /biomarker.{0,18}(?:assay|detect|quantif)|(?:生物标志物|Biomarker).{0,8}检测/i),
      term("ADC内吞检测", /ADC.{0,16}(?:internalization|内吞)/i),
      term("ADC定量", /ADC.{0,16}(?:quantif|定量)/i),
      term("宿主DNA检测", /host.{0,10}DNA|宿主DNA|宿主 DNA/i),
      term("荧光检测", /fluorescen\w* (?:assay|detect)|荧光检测/i),
      term("蛋白互作检测", /protein interaction assay|蛋白互作检测/i),
      term("质量与残留检测", /endotoxin|mycoplasma|sterility|residual (?:DNA|protein)|内毒素|支原体|无菌|残留\s*(?:DNA|蛋白)/i),
    ],
    cell: [
      term("基因敲除细胞株", /knock[ -]?out cell lines?|基因敲除细胞(?:株|系)/i),
      term("过表达细胞株", /overexpress\w* cell lines?|过表达细胞(?:株|系)/i),
      term("稳定细胞株", /stable cell lines?|稳定细胞(?:株|系)/i),
      term("报告基因细胞株", /reporter (?:gene )?cells?|报告基因细胞(?:株|系)?/i),
      term("细胞株", /(?:cell|iPSC) lines?|细胞[株系]|細胞株/i), term("HEK293", /\bHEK[ -]?293\w*\b/i),
      term("iPSC", /\biPSCs?\b|iPS細胞|诱导多能干细胞/i), term("干细胞材料", /stem cells?|干细胞|幹細胞/i),
      term("类器官", /organoid|类器官|オルガノイド/i), term("组织模型", /tissue models?|组织模型/i),
    ],
    culture: [
      term("无血清培养基", /serum[ -]free medi(?:a|um)|无血清培养基|無血清培地/i),
      term("基础培养基", /basal medi(?:a|um)|基础培养基/i),
      term("化学合成培养基", /化学合成培养基/),
      term("培养基", /culture medi(?:a|um)|培养基|培地/i),
      term("细胞激活试剂", /cell activation (?:reagents?|kits?)|细胞激活试剂/i),
      term("细胞扩增试剂", /cell expansion reagents?|细胞扩增(?:产品|试剂)/i),
    ],
    bead: [
      term("双抗磁珠", /bispecific.{0,15}beads?|双抗磁珠/i),
      term("抗体标记磁珠", /antibody.{0,15}beads?|抗体标记磁珠/i),
      term("生物素标记磁珠", /biotin.{0,15}beads?|生物素标记磁珠/i),
      term("磁珠", /magnetic beads?|磁珠|磁気ビーズ|(?:CD3.{0,4}CD28|Protein A).{0,8}beads?/i),
      term("细胞分选材料", /cell sorting materials?|细胞分选材料/i),
      term("细胞培养袋", /(?:cell )?culture bags?|(?:细胞|一次性)?培养袋/i), term("Cytopak", /\bCytopak\b/i),
    ],
    equipment: [
      term("流式仪", /flow cytometers?|流式仪|フローサイトメーター/i),
      term("细胞成像设备", /cell imag\w* (?:systems?|instruments?|equipment)|细胞成像设备/i),
      term("细胞计数设备", /cell counters?|cell count\w* (?:systems?|equipment)|细胞计数设备/i),
      term("生物反应器", /bioreactors?|生物反应器/i), term("实验室自动化设备", /laboratory automation (?:systems?|equipment)|实验室自动化设备/i),
      term("CMC生产", /CMC.{0,20}(?:manufactur|production)|CMC\s*生产/i),
      term("GMP设施", /GMP.{0,20}(?:facilit|plant|factor)|GMP.{0,6}(?:设施|厂房|工厂|工場)/i),
    ],
    service: [
      term("定制蛋白", /custom (?:recombinant )?proteins?|定制蛋白|蛋白定制/i),
      term("抗体开发", /antibody development|抗体开发/i), term("细胞株定制", /custom cell lines?|细胞[株系]定制/i),
      term("试剂盒开发", /kit development|试剂盒开发/i), term("分析检测", /analytical (?:testing|services?)|分析检测/i),
      term("TR-FRET定制", /TR[ -]FRET/i), term("流式检测", /flow cytometr|流式检测/i),
      term("SPR", /\bSPR\b/i), term("BLI", /\bBLI\b/i),
      term("GMP蛋白定制", /GMP.{0,12}(?:proteins?|蛋白)/i),
      term("GMP培养基定制", /GMP.{0,12}(?:medi(?:a|um)|培养基)/i),
      term("GMP磁珠定制", /GMP.{0,12}(?:beads?|磁珠)/i),
      term("AI辅助蛋白开发", /(?:AI|artificial intelligence).{0,30}protein.{0,16}(?:develop|design)|AI.{0,8}蛋白.{0,6}(?:开发|设计)/i),
    ],
  };
  const therapy = /\bdrugs?\b|\btherap\w*|\btherapeutic\w*|clinical (?:trials?|progress|advances?|development|insights)|\bphase\s*[123I]|drug discover|pipeline|药物|治疗|临床|管线|医薬|治療|治験/i;
  const product = /\bproducts?\b|\breagents?\b|\bkits?\b|catalog\w*|portfolio|suppl\w*|commercial\w*|launch\w*|introduc\w*|releas\w*|manufactur\w*|(?:expand|provide) access to|产品|试剂|原料|材料|试剂盒|供应|生产|销售|推出|发布|製品|試薬|発売|供給|販売/i;
  const kit = /\bkits?\b|\breagents?\b|试剂盒|试剂|キット|試薬/i;
  const service = /\bservices?\b|\bcustom(?:ized|ization|ised|isation)?\b|\bcontract(?:ed|ing)?\b|服务|定制|受託|サービス/i;
  const facility = /launch\w*|introduc\w*|purchas\w*|upgrad\w*|expand\w*|open\w*|build\w*|manufactur\w*|production|invest\w*|发布|推出|采购|升级|建设|扩建|扩产|生产|设施|工厂|厂房|導入|稼働|工場|施設/i;
  const proteinContext = /proteins?|antigens?|cytokines?|growth factors?|DNase|RNase|nuclease|enzymes?|蛋白|抗原|细胞因子|生长因子|核酸酶|酶|タンパク|サイトカイン/i;
  const antibodyContext = /antibod|conjugate|antigen|drug|immun|抗体|偶联|免疫|药物|抗体/i;
  const researchTool = /(?:cell|iPSC) lines?|cell culture|culture medi(?:a|um)|organoid models?|cell sorting|细胞[株系]|培养基|类器官模型|细胞分选/i;
  const gradedProtein = /GMP[ -]grade\s+(?:human\s+)?(?:IL[ -]?(?:2|6|15)|VEGF|Laminin)\b|GMP级.{0,4}(?:IL[ -]?(?:2|6|15)|VEGF|Laminin)/i;
  const namedMedium = /\b(?:TeSR\w*|mTeSR\w*|StemSpan\w*)[^。.!?]{0,65}\bculture medi(?:a|um)\b/i;
  const unique = values => [...new Set(values)];
  const cache = new WeakMap();
  function materials(item) {
    return [["title", item.title], ["summary", item.summary], ["source_excerpt", item.evidence?.source_excerpt]]
      .filter(([, value]) => typeof value === "string" && value.trim())
      .flatMap(([field, value]) => value.normalize("NFKC").split(/(?<=[。！？!?;；])|\n|(?<=\.)\s+/u).map(text => ({ field, text: text.trim() })).filter(row => row.text));
  }
  function companyRoles(item, companies, text) {
    const ids = unique([item.company_id, ...(item.matched_company_ids || [])]);
    const matched = companies.filter(c => ids.includes(c.id));
    const roles = unique(matched.map(c => c.business_role));
    if (roles.length <= 1) return roles;
    // For mixed-company stories, require a company's own name in the evidence sentence.
    const localRoles = unique(matched.filter(c => [c.display_name, c.display_name_en, c.display_name_zh, c.display_name_ja, ...(c.aliases || []), ...(c.japanese_aliases || [])]
      .some(name => {
        if (!name || String(name).length <= 2) return false;
        const value = String(name).normalize("NFKC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const bounded = /^[\x00-\x7F]+$/.test(value) ? `(?<![a-z0-9])${value}(?![a-z0-9])` : value;
        return new RegExp(bounded, "i").test(text);
      })).map(c => c.business_role));
    // Joint announcements do not establish which party owns each activity.
    return localRoles.length === 1 ? localRoles : [];
  }
  function admitted(id, label, text) {
    if (id === "drug") return therapy.test(text) && !kit.test(text) && !service.test(text) && !gradedProtein.test(text) && !(researchTool.test(text) && product.test(text));
    if (id === "protein") return ((product.test(text) || gradedProtein.test(text)) && (label !== "具体蛋白" || proteinContext.test(text) || gradedProtein.test(text)) && (label !== "Cas9酶" || proteinContext.test(text))) || (label === "靶点蛋白" && therapy.test(text));
    if (id === "antibody") return (therapy.test(text) || product.test(text)) && (!/^(?:ADA|RDC)$/.test(label) || antibodyContext.test(text));
    if (id === "assay") return kit.test(text) && !service.test(text);
    if (id === "cell") return product.test(text) && !service.test(text);
    if (id === "culture") return (product.test(text) || namedMedium.test(text)) && !service.test(text);
    if (id === "bead") return product.test(text) && !service.test(text);
    if (id === "equipment") return facility.test(text);
    if (id === "service") return label === "AI辅助蛋白开发" || service.test(text);
    return false;
  }
  function analyze(item, companies = []) {
    const prior = cache.get(item);
    if (prior?.companies === companies) return prior.result;
    const matches = [];
    for (const definition of definitions) {
      const evidence = [];
      for (const { field, text } of materials(item)) for (const entry of terms[definition.id]) {
        const hit = text.match(entry.pattern);
        if (!hit || !admitted(definition.id, entry.label, text)) continue;
        const roles = companyRoles(item, companies, text);
        const observed = [];
        const customerContext = therapy.test(text) || definition.id === "equipment" || entry.label === "AI辅助蛋白开发";
        const supplierContext = product.test(text) || service.test(text) || namedMedium.test(text) || gradedProtein.test(text);
        if (roles.includes("customer") && customerContext && ["drug", "protein", "antibody", "equipment", "service"].includes(definition.id)) observed.push("customer");
        if (roles.includes("competitor") && supplierContext && definition.id !== "drug") observed.push("competitor");
        const index = Math.max(0, hit.index - 75);
        evidence.push({ field, term: entry.label, word: hit[0], quote: text.slice(index, Math.max(index + 200, hit.index + hit[0].length)), directions: observed.length ? observed : ["unspecified"] });
      }
      if (evidence.length) matches.push({ id: definition.id, label: definition.label, terms: unique(evidence.map(e => e.term)), directions: unique(evidence.flatMap(e => e.directions)), evidence });
    }
    const result = { version, matches, categories: matches.map(row => row.id), status: matches.length ? "identified" : "unidentified" };
    cache.set(item, { companies, result });
    return result;
  }
  function matches(result, selected = [], direction = "all") {
    if (!selected.length && direction === "all") return true;
    if (!result.matches.length) return (!selected.length || selected.includes("unidentified")) && ["all", "unspecified"].includes(direction);
    return result.matches.some(row => (!selected.length || selected.includes(row.id)) && (direction === "all" || row.directions.includes(direction)));
  }
  return { version, definitions, directions, pending, terms, analyze, matches };
});
