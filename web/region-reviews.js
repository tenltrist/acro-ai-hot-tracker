(function (root) {
  "use strict";
  // Curated in this Codex session. This registry does not call a model at runtime.
  const evidence = (regions, url, quote, kind, quality = "explicit", contextUrl = "") => ({ regions, url, quote, kind, quality, contextUrl });
  const review = (ids, guard, status, scope, note, sources, reason = null) => ({ ids, guard, status, scope, note, evidence: sources, reason, checkedAt: "2026-09-09", reviewer: "Codex", method: "source_backed_semantic_review" });
  const entries = [
    review(["7b5b1e59e7db16ce", "d50238d39d4b95e4"], /Astorg.*Microbiology/i, "identified", "已读 Astorg 同一交易的官网交割公告正文。", "交易标的是全球微生物业务。归类依据是被收购业务的范围，不是公告电头中的纽约、巴黎或卢森堡。", [
      evidence(["global"], "https://www.astorg.com/news/astorg-completes-acquisition-of-microbiology-business-from-thermo-fisher-scientific-establishing-an-independent-global-diagnostics-specialist", "acquisition of the global microbiology business", "收购业务范围"),
    ]),
    review(["6c91469a64ec7c2c"], /小野薬品.*組織改編/, "identified", "已读组织变更的公开短摘录，并补读小野官方业绩说明中 Forxiga 国内共同销售结束的段落；未取得收费报道全文。", "标题把组织调整与 Forxiga 共同销售结束相连；官方将该结束事项列在日本国内产品销售中，因此按日本销售业务语境归类。不是依据公司国籍，也不表示全部调整部门只负责日本。", [
      evidence(["japan"], "https://www.ono-pharma.com/ja/ir/overview", "国内製品商品売上", "同一共同销售事项的市场语境", "contextual"),
      evidence(["japan"], "https://nk.jiho.jp/article/304897", "プライマリーからスペシャリティに変更する", "组织调整的公开短摘录", "limited"),
    ]),
    review(["7bf450b4ffa3d817"], /科研製薬.*事業戦略部/, "identified", "已读药事日报同一组织改编的公开报道正文。", "报道明确将 QA 改组与建立全球质量保证体系联系起来；全球仅指该职能体系的目标范围，不表示各地已建立机构。其他部门的地区范围未确认。", [
      evidence(["global"], "https://www.yakuji.co.jp/entry138966.html", "グローバル信頼性保証体制の構築", "质量职能的目标范围"),
    ]),
    review(["0388959ac0342a8d"], /オキシトシン.*4F1/, "identified", "已读 Wako 4F1 产品应用页面，并核对数据提供机构的官网所在地。", "应用图的数据由日本旭川医科大学提供，因此保留日本这一技术应用关联；不是依据 Wako 国籍，也不表示日本独家上市、临床试验地点或新签合作。", [
      evidence(["japan"], "https://labchem-wako.fujifilm.com/jp/category/03263.html", "旭川医科大学", "应用数据提供机构所在地", "contextual", "https://www.asahikawa-med.ac.jp/english/access/"),
    ]),
    review(["5363461214b7e7c4"], /c-Fos.*モルモット/, "identified", "已读 Wako c-Fos 产品应用页面，并核对数据提供机构的官网所在地。", "产品应用图注明日本旭川医科大学提供数据。日本指数据贡献机构的关联，不据此推断销售地域、实验实际开展地或合作签约时间。", [
      evidence(["japan"], "https://labchem-wako.fujifilm.com/jp/category/03606.html", "旭川医科大学", "应用数据提供机构所在地", "contextual", "https://www.asahikawa-med.ac.jp/english/access/"),
    ]),
    review(["95f82e6a342421a4", "9d63bcf5808ead59"], /キッセイ薬品.*ぼうこうがん|Cretostimogene grenadenorepvec/, "identified", "已读 Kissei 8月17日 CG0070 试验结果官方公告两页。", "BOND-003 的入组范围包含北美、澳大利亚及亚太；正文另确认日本多家机构参与。日本后续上市申请仍是计划。许可背景里的其他亚洲国家不当作本试验地点。", [
      evidence(["north_america", "oceania", "apac_unspecified"], "https://www.kissei.co.jp/news/uploaded/ac0d28038b8ced3e28ffd15df1f1d731.pdf", "北米、オーストラリア、およびアジア太平洋地域", "实际试验入组范围"),
      evidence(["japan"], "https://www.kissei.co.jp/news/uploaded/ac0d28038b8ced3e28ffd15df1f1d731.pdf", "日本国内の複数の施設", "试验参与机构范围"),
    ]),
    review(["bf4f2e275594a361", "d5020475aa0c47bf"], /Genedata.*Abcam|Abcam.*Genedata/i, "identified", "已读 Abcam 与 Genedata 的官方合作公告正文。", "公告明确软件已部署在英国总部及中国、美国的重要研发站点。英国能计入是因为存在部署动作，不是因为总部地址本身。未将公告电头的瑞士加入。", [
      evidence(["europe", "china", "north_america"], "https://www.abcam.com/en-us/press-releases/abcam-and-genedata-collaborate-to-accelerate-ai-driven-antibody-development", "UK and key sites in China and the US", "研发系统部署地点"),
    ]),
    review(["a2e60f9f918a3e11"], /武田薬品.*キムCEO/, "pending", "本次未能读取日经原文；现有记录只有标题及重复标题的索引摘要。", "报道方向是武田新管理层的现金创造力与管线转化。没有足够原文确认具体市场，不能把日经媒体名称中的日本或已有 AI 摘要当作地理证据。", [
      evidence([], "https://www.nikkei.com/article/DGXZQOUB288260Y6A720C2000000/", "", "原文未读取成功", "limited"),
    ], "source_limited"),
    review(["b7dfbb89d95d38f2", "2fb1951ea24539d6"], /DESTINY-Lung04|DS-8201.*非小細胞肺がん/, "identified", "已读第一三共 DESTINY-Lung04 日文结果公告及英文公告中的试验说明。", "英文公告将454名受试者的试验地点列为亚洲、欧洲和北美。没有逐国名单，不把东京总部或其他适应证的市场背景加入本试验地区。", [
      evidence(["asia_unspecified", "europe", "north_america"], "https://www.daiichisankyo.com/files/news/pressrelease/pdf/202608/20260817_E.pdf", "sites in Asia, Europe and North America", "实际试验入组范围"),
    ]),
    review(["780708d9f2d51226"], /Fortrea.*Worldwide/, "identified", "已读 Fortrea 官网资产收购协议公告正文。", "拟收购的是得州 Austin、San Antonio 和 Pflugerville 的早期临床及实验室设施。归属美国；Worldwide 是卖方名字，不是全球收购地域。公告为签约待交割。", [
      evidence(["north_america"], "https://ir.fortrea.com/news-releases/news-release-details/fortrea-acquire-clinical-pharmacology-unit-and-bioanalytical", "a biospecimen storage facility in Pflugerville, Texas", "拟收购资产所在地"),
    ]),
    review(["7a28708350c8df50"], /American Regent.*recall/i, "identified", "已读 American Regent 经 PR Newswire 发布的召回公告正文。", "受影响批次在美国全国分销，召回由美国 FDA 知悉。这里是美国召回地域，不因母公司第一三共位于日本而增加日本。", [
      evidence(["north_america"], "https://www.prnewswire.com/news-releases/american-regent-inc-issues-voluntary-nationwide-recall-of-three-lots-of-epinephrine-injection-usp-30-mg30-ml-1-mgml-due-to-the-presence-of-particulate-matter-and-lack-of-assurance-of-sterility-302869473.html", "distributed nationwide, in the United States", "召回产品分销范围"),
    ]),
    review(["9af268f4ae597903"], /リボルナ.*マイルストーン/, "identified", "已读里程碑公告，并沿其明确引用的2025年3月31日协议补读 Reborna 原始合作公告。", "本次里程碑属于同一 RNA 靶向合作；原协议授予小野全球开发、制造和商业化许可的独家选择权。全球是这项选择权的范围，不是已行权、已上市或研究中心遍布全球；实验地点仍未确定。", [
      evidence(["global"], "https://rebornabiosciences.com/en/news/16101", "exclusive option right to develop, manufacture, and commercialize worldwide", "同一协议的许可选择权范围"),
      evidence(["global"], "https://prtimes.jp/main/html/rd/p/000000017.000078945.html", "2025年3月31日", "里程碑与原协议的对应关系", "contextual"),
    ]),
    review(["3b1e730534809f67"], /MT-7117/, "identified", "已读田边制药 MT-7117 权利转让官网公告正文。", "本次交易转让全球开发和销售权；公告还明确美国申报程序继续，以及拟将资金再投入日本市场。分别是权利范围、监管辖区、计划投资市场，不表示已获批或投资已经完成；丹麦总部不计入。", [
      evidence(["global"], "https://www.tanabe-pharma.com/ja/news/rel_260818.html", "グローバル開発および販売権", "转让权利范围"),
      evidence(["north_america"], "https://www.tanabe-pharma.com/ja/news/rel_260818.html", "米国での承認取得に向けて", "继续推进的申报辖区"),
      evidence(["japan"], "https://www.tanabe-pharma.com/ja/news/rel_260818.html", "日本市場への再投資", "计划再投资市场"),
    ]),
    review(["c7a04819717a0d7c"], /ゼリファスト/, "identified", "已读 Kissei 经 atpress 发布的 Jellyfast 发售公告正文。", "按日元含税价格、日本食品产品语境和 Kissei 健康护理网店渠道，判断这是面向日本的供应公告。属于上下文判断，不能推出仅在日本销售或全球发售；11月10日仍是预定日期。", [
      evidence(["japan"], "https://www.atpress.ne.jp/news/621964", "キッセイヘルスケアネットショップ", "产品供应市场", "contextual"),
    ]),
    review(["ed3cdaa97ca5b93b"], /マルホ.*科研製薬.*久光製薬/, "identified", "已读 Maruho 官网三家公司教育项目公告正文。", "结合日本学校教育项目语境，将面向全国中学、高中的材料分发范围解析为日本。依据是项目受众，不是三家公司的总部；不推断具体学校已经使用。", [
      evidence(["japan"], "https://www.maruho.co.jp/information/20260904.html", "全国の中学校・高等学校", "教育项目受众范围", "contextual"),
    ]),
    review(["23e7e3bcebc55ca1"], /MFN.*アステラス/, "identified", "已读 Astellas 关于与美国政府协议的官方正文，用于核对该报道的政策地域。", "MFN 新闻所涉政策指向美国。Astellas 官方证实其美国医保定价及供应安排；这份证据不代替其他八家公司的全部条款核验。日本公司参与美国政策，不等于日本国内政策。", [
      evidence(["north_america"], "https://newsroom.astellas.com/2026-09-01-astellas-enters-voluntary-agreement-with-us-government-supporting-affordable-access-to-medicines", "reached an agreement with the U.S. government", "药价政策适用市场"),
    ]),
    review(["627a72f75ff67cfb"], /ウラシル.*PCR/, "identified", "已读 Takara Bio 9月3日 U-Tolerant PCR 酶官方发售页。", "发售页给出日元未税产品价格与日本产品目录入口，且说明与长滨生物大学共同研究；按供应语境归日本。不是只凭日文网站判断，也不推断海外不可购买。", [
      evidence(["japan"], "https://www.takara-bio.co.jp/ja/news/newsr_26m0903trss.html", "希望小売価格（税別）", "产品供应市场", "contextual"),
    ]),
    review(["63a85e7f9c5d383d"], /ASP2138/, "identified", "已读 Astellas ASP2138 官方公告正文及其试验引用；注册站点本次未返回国家明细。", "公告说明计划在多个国家招募570人，其引用将该研究称为 global 3期试验。按明确的跨国整体试验范围归全球，不展开成日本、美国或所有国家，也不表示所有中心已启动。", [
      evidence(["global"], "https://jp.newsroom.astellas.com/2026-08-25-astellas-doses-first-patient-in-phase-3-study-of-asp2138-in-cldn18-2-postive-and-her2-negative-locally-advanced-unresectable-or-metastatic-gastric-or-gastroesophageal-junction-gej-adenocarcinoma", "A phase 3, global, multi-center", "全球试验计划范围"),
    ]),
    review(["c478882870a7b0e0"], /WashU.*Eisai/i, "identified", "已读 Eisai 美国官网 WashU 表彰公告正文。", "举行表彰和设置永久纪念牌的是圣路易斯的华盛顿大学医学院，因此事件关联美国。不能将卫材东京总部当作本次活动地点。", [
      evidence(["north_america"], "https://us.eisai.com/press-releases/washu-medicine-honors-ceo-haruo-naito-and-eisai-for-longstanding-contributions-to-alzheimers-disease-research-and-healthcare", "Washington University School of Medicine in St. Louis", "表彰活动场所"),
    ]),
    review(["a8300e5b5082d821"], /Cell and Gene Therapy Trends/, "nonregional", "已读 Thermo Fisher CGT 商业化技术博客正文；未观看外链完整讨论视频。", "文章讨论 CGT 制造、成本、支付与商业化的一般挑战，并未把这些判断限定到某个市场。不从 ASGCT 名称或发言人公司所在地推定内容地区。", [
      evidence(["nonregional"], "https://www.thermofisher.com/blog/biotechnology/cell-gene-therapy-commercialization-trends-2026/", "scientific, manufacturing, regulatory, and commercial challenges", "未限定地域的行业讨论", "contextual"),
    ]),
    review(["94d852fd3e08d1f5"], /百普赛斯.*2026.*半年度报告/, "nonregional", "已读巨潮披露的4页半年度报告摘要，未将其称为半年度报告全文。", "当前证据列示公司整体财务指标，没有按业务地区展开。此条记录按公司整体财报内容保留为未限定地区，不按北京办公地址、上市交易所或股东地址分市场。", [
      evidence(["nonregional"], "https://static.cninfo.com.cn/finalpage/2026-08-29/1225526805.PDF", "主要会计数据和财务指标", "公司整体财务披露", "contextual"),
    ]),
    review(["7cc7a1c1a12296a4"], /Morgan Stanley 24th/, "identified", "已读参会公告及 Morgan Stanley 主办方第24届医疗会议页面，匹配2026年9月14至16日和会议届次。", "主办方明确会址为纽约 Marriott Marquis，Thermo 预定9月15日发言，归北美。仍是未来参会计划；线上直播不改变线下会址，会议名中的 Global 不作为全球地域。", [
      evidence(["north_america"], "https://msevents.dealogic.com/clientportal/Conferences/Custom/List/616?menuItemId=102", "New York Marriott Marquis", "主办方公布的会议会址"),
    ]),
    review(["1a01f03a67dbfd29"], /Beyond Protein A/, "nonregional", "本轮通过 Thermo 官方文章的另一公开入口读取了正文；未阅读其外链全部技术材料。", "文章讨论新型抗体结构与 Protein A、其他亲和纯化方法的匹配，没有限定国家或市场。已补到正文，因此由材料不足改为内容未限定地区，不依据公司总部指定美国。", [
      evidence(["nonregional"], "https://www.thermofisher.com/blog/biotechnology/?p=1309", "selecting purification strategies based on the biology of the molecule", "未限定地区的技术方法讨论", "contextual"),
    ]),
    review(["239abd95c265a3f1"], /Combining CRISPR and Single-Cell/, "nonregional", "已读官方视频页面的文字介绍，未观看52分钟视频或读取完整字幕。", "当前公开简介是 CRISPR 与单细胞 RNA 测序的方法分享，未限定国家或销售市场。仅对这份简介作未限定地区判断，不代表视频全部内容经过地区核对；不从 EMBL 名字推测会场。", [
      evidence(["nonregional"], "https://videos.bdbiosciences.com/detail/videos/all/video/6403283888112/combining-crispr-and-single-cell-rna-seq-webinar", "CRISPR interference, coupled with targeted single-cell RNA sequencing", "未限定地域的方法分享", "contextual"),
    ]),
    review(["14f66fc10d29bdfc"], /次世代モダリティセミナーに村上/, "identified", "已读 PeptiDream 官网研讨会回顾正文。", "讲演涉及日本 RI 医药品支持政策和日本相关企业，因而归入日本产业议题。原文未给出会场地址，本判断不是声称会议在某个日本城市举办。泛称海外不展开。", [
      evidence(["japan"], "https://www.peptidream.com/ir/blog/000655.html", "日本での支援強化の動き", "明确的产业政策议题"),
    ]),
  ];
  const batch = root.AIHOT_REGION_REVIEW_BATCH || (typeof module !== "undefined" && module.exports ? require("./region-review-batch.js") : { entries: [] });
  entries.push(...batch.entries.map(entry => ({ ...entry, guard: new RegExp(`^${entry.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) })));
  const registry = Object.freeze({ version: "2026-09-09.full1", entries, scope: batch.scope });
  root.AIHOT_REGION_REVIEWS = registry;
  if (typeof module !== "undefined" && module.exports) module.exports = registry;
})(typeof window === "undefined" ? globalThis : window);
