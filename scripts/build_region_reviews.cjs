const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const payload = require('../data/latest_run.json');
const prior = require('../web/region-model.js');
const period = require('../web/overview-model.js');
const rows = [];
const source = (url, quote, kind, quality = 'explicit', regions) => ({ url, quote, kind, quality, ...(regions ? { regions } : {}) });
const add = (ids, regions, note, scope, evidence = [], reason = null) => rows.push({ ids: ids.split(' '), regions, note, scope, evidence, reason });
const snapshot = (ids, regions, note) => add(ids, regions, note, '逐条核对已采集的原标题及来源摘录；未逐篇重读全文。只确认报道中的地区关系，不代表批准、疗效或交易结果已独立核验。');
const official = '已读该事件的公开公告文字；未核验外链全部附件。';

// Every ID below was assessed individually. The build step only binds stored decisions to their source records.
snapshot('da2905226b97f5c4 d8f1b9c2b5d94a16 7bd9d3f61c6a6ccf 63310979126797ec 538348a00b06e091', ['north_america'], 'Aitia 被明确写为美国合作方，记录合作方地域关联；不把小野的日本国籍当作项目实施地，也不外推全球权利。');
snapshot('29d3e8fc4cd5c6aa 46f3b05083ef327c', ['japan'], 'PMDA 材料适用性确认对应日本监管体系；不是药品上市批准，也不是产品仅能在日本使用。');
snapshot('4d6b2d8b0e16144b 907e2fd6c8a2b478 37ec971dc3f3d237 57a472ed5652c649 9cd807f39ffb8ed2 3fed214c977cf11a ee6ee6e4fb930c3b', ['north_america'], '当前报道明确涉及美国 FDA 审批或美国供应安排，按美国辖区计入北美；不外推加拿大，不将公司母国作为本次市场。');
snapshot('8bb92253a8f59a2b 0bcc7253861fa1df', ['oceania'], '当前药品事项明确发生于澳大利亚，归大洋洲；不把日本公司身份或其他市场的历史获批加入。');
snapshot('d1e31bdb4b3fadf7 4123d0fc133c0d2a', ['china'], '此次 LEQEMBI 事项指向中国。摘录中的既往美国批准属于背景，不是本次新增地区；不据此扩大到港澳台审批辖区。');
snapshot('70e9c4f46a142fe2', ['north_america'], 'Mediar 在报道中是明确的美国合作方；这是合作方所在地关系，不等于研发全部在美国实施。');
snapshot('bc71e09403cf6b41 7f6d1f7200289674 2be828aed6c3f57c e787af7f45dbf4c8', ['north_america'], 'MFN 指向美国药价政策；其中的加拿大报销报道同属北美但不是美国政策。日本企业身份、比较药价背景不作为日本新事件。');
snapshot('16a0bcfe253fa15a', ['north_america'], '报道是加拿大报销／准入事项，归北美；不能读成美国 FDA 批准或北美全域可用。');
snapshot('0e35cead610af0fc 162ff9debdd7e70e', ['middle_east'], '本条明确是阿联酋的 IZCARGO 批准事项，归中东；不扩展为所有中东国家获批。');
snapshot('3eb4e504e20877ba 5965a7992597bbcc', ['japan'], 'Fezolinetant 事项明确指向日本申报市场；申请进展不等于批准，不把海外既有批准加入本次地区。');
snapshot('bd3e5d13c60368ae fee6211b636283c2 fbe8fb2bd6c2cede 9ae204ef2d032d2a 68a567e9d408dc14 062869a7efb1f30a', ['europe'], '报道涉及欧盟审批或 CHMP 意见，按欧洲分组展示。CHMP 积极意见不等于最终批准；欧盟批准不代表英国等全部欧洲辖区。');
snapshot('ff1fe1fde07ed94a', ['china'], '明确辖区为台湾；合并展示在中国及港澳台市场，但不意味着中国大陆、香港或澳门获得同样批准。');
snapshot('355b7e75bdc462f3', ['korea'], '报道明确是韩国事项；不从小野的日本身份扩展项目地域。');
snapshot('1dfd34d05e17647d', ['japan'], '内容讨论日本制药产业的长期变化，属于明确的产业观察对象；并非按出版社所在地推定。');
snapshot('980adbbbcaf48980', ['north_america', 'europe'], '新闻分别提到美国 FDA 与英国申报安排，保留两个监管关系；不代表加拿大或欧盟同步批准。');
snapshot('d3ee6e6531ea3a0d', ['north_america'], '美国学生 STEM 竞赛是该活动的明确受众范围，归北美；不是 Thermo 总部推断。');
snapshot('afaef913b092cbb9', ['europe'], '标题明确讨论欧洲的药品撤销建议。日本企业身份不等于同一监管决定已在日本实施。');
snapshot('d5bceda2039cc617 14ca15c4fb0ddb70', ['japan'], '日本篮球相关合作的受众／合作组织有明确日本关联，不据此推定所有活动在同一会场举行。');
snapshot('8f9e736dbd46c602', ['japan'], 'FTSE JPX 日本指数的纳入事项对应日本证券市场，不是产品销售区域，也不是仅因上市公司总部位于日本。');
snapshot('606d0801525c2935', ['japan', 'europe'], '报道明确区分欧洲监管行动和日本方面应对，分别保留；不将两地行动写为同一批准结果。');
snapshot('5ef7608d1a33e25d dd6faede0348173c', ['china'], '本次 ENHERTU 事项指向中国市场；不从其他适应证的全球获批背景新增地区。');
snapshot('068db4cf6a0c1513', ['global'], '来源摘录明确是 Roche 与 Simcere 的全球权利交易范围；全球表示权利边界，不是已经在所有国家完成开发或上市。');
snapshot('ce3dab26f7d87e01', ['japan'], '会议预告的明确举办地为东京，计日本；2027 年安排是计划，不是已举办事实。');
snapshot('c418dcf1f3c930af', ['europe'], '事项为英国申报受理，按欧洲分组；受理不等于批准，英国也不等于欧盟。');

for (const old of prior.reviewed) add(old.ids.join(' '), old.regions, old.note, '复核并沿用本地已有的逐条原文补证记录；本轮未再次读取该附件全文。', [source(old.url, old.quote, old.kind)]);
const mt = prior.semanticReviews.find(row => row.ids.includes('3b1e730534809f67'));
add('d798a3eb839131eb 4db218ef05ff6a6d', ['global', 'japan', 'north_america'], mt.note, '核对同一 MT-7117 交易的两篇报道，沿用已经读取的田边官方公告证据。', mt.evidence);

add('888c139d5cd72870 ec55e65a5bc00d6f 8944f11a22b96440 2a6dab8a135c09ba', ['north_america'], '四条均明确指向 BIO 2026 展示或会后回顾；主办方确认会址是美国圣迭戈。只确认会址，不把国际参会者展开为各国，也不以活动结束日替代新闻发布日期。', '已核对各条存档标题及 BIO 主办方 2026 会址说明；没有把每篇回顾均标为全文精读。', [source('https://convention.bio.org/international-visitors', 'San Diego, California from June 22-25', '活动会址')]);
add('223d59d54e74bcc6', ['north_america'], 'ADLM 2026 的具体展会地点是美国加州 Anaheim；本条是参展展示，不由此推断产品全球供应。', '已读 Thermo 官方 ADLM 活动页会址信息，并匹配新闻活动名称及年份。', [source('https://www.thermofisher.com/adlm', 'Anaheim, CA, USA', '活动会址')]);
add('2c5ba74c71c5e550', ['north_america'], 'ACRO 所提 ISSCR 2026 的主办方公告确认蒙特利尔、加拿大会址；不是从 ACRO 公司国籍或论文作者所在地推断。', '核对新闻标题与 ISSCR 主办方会址公告。', [source('https://www.isscr.org/isscr-news/the-isscr-announces-montral-as-location-for-its-2026-annual-meeting-8-11-july-2026', 'Montréal, Canada', '活动会址')]);
add('411e8520e5b8256c', ['global', 'north_america'], '产品合作明确向全球开发者提供匹配 GMP 细胞系，同时在蒙特利尔 ISSCR 2026 推介。全球是供应对象范围，北美是会议地点，不能当成两个独立事件。', '已读 STEMCELL 官方公告公开正文片段，并核对 ISSCR 会址。', [source('https://www.stemcell.com/stemcell-technologies-ccrm-partner-to-expand-access-to-matched-gmp-and-ruo-ipsc-lines-for-cell-therapy-development.html', 'to developers worldwide', '供给对象范围', 'explicit', ['global']), source('https://www.isscr.org/isscr-news/the-isscr-announces-montral-as-location-for-its-2026-annual-meeting-8-11-july-2026', 'Montréal, Canada', '配套发布活动会址', 'explicit', ['north_america'])]);
add('f610ddd76a80d18c 447e26fb57557787', ['north_america'], 'KinetiSol 设备拟部署于 Thermo 的 Oregon 和 Ohio 设施，是有明确地点的制造合作；不把安装计划写为已经完成。', official, [source('https://rctech.com/austinpx-expands-kinetisol-technology-commercial-access-through-thermo-fisher-scientific-collaboration/', 'Bend, Oregon, and Cincinnati, Ohio', '拟部署设备的工厂地点')]);
add('91be4db09d618590 1dea0a8b3e5033e9 8fa79b5800a33dfb', ['europe'], '德国 Darmstadt 的新 BioReliance 检测设施开业，并服务欧洲药品放行。本条虽提总部，但存在明确的设施开业动作，因此可以计入；不是简单排除整句总部描述。', '已读 Merck 经 GlobeNewswire 发布的同一设施公告公开文字。', [source('https://www.globenewswire.com/news-release/2026/07/16/3328423/0/en/merck-opens-bioreliance-testing-facility-in-darmstadt-germany-to-support-drug-product-release-in-europe.html', 'testing facility at its global headquarters in Darmstadt, Germany', '新设施所在地')]);
add('b142009799e4474e 6fede91478efe6b8 c79ae203a0efda78', ['europe'], '合作将 LFB 在法国 Alès 的生物药制造能力与 Sartorius 服务相结合，计入欧洲制造关联。不将电头或作者所属新加坡机构当作该合作的新生产地点。', '已读 Sartorius 公告及 LFB 同一合作公告的公开段落。', [source('https://www.lfbbiomanufacturing.com/news/sartorius-and-lfb-biomanufacturing-strengthen-collaboration/', 'Alès (Gard department, France) industrial site', '制造合作能力所在地', 'contextual')]);
add('b55d823246655df2', ['north_america'], '合作明确由 UCSF 研究者参与，记录美国研究机构关联；未披露的全部实验地点或许可范围不补猜。', '已读 UCSF 关于该合作的公开说明。', [source('https://www.ucsf.edu/news/2026/08/432321/chugai-and-ucsf-collaborate-drug-discovery-research', 'UC San Francisco', '合作研究机构地域', 'contextual')]);
add('dc1ead3212066064', ['europe'], '续签的是与伦敦大学学院的神经退行性疾病研发合作，记录英国研究机构关联。东京总部与另一项 Hatfield 投资只是附带背景，不扩大为本次研发实施范围。', '已读 UCL 的合作续签公告公开正文。', [source('https://www.ucl.ac.uk/news/2026/jun/special-ucl-eisai-neurodegenerative-disease-drug-development-partnership-extended-again', 'University College London (UCL)', '合作研究机构地域', 'contextual')]);
add('9a10afdf46758bf0', ['japan', 'europe'], '本次是日本适应证扩展申请；同一试验结果计划在瑞典斯德哥尔摩 EHA 2026 披露，另计欧洲活动关系。韩国、台湾、美国的既往进展不作为本次新增事项。', official, [source('https://www.ono-pharma.com/ja/news/20260611_2.html', '国内多施設の参画', '日本申报及试验背景', 'contextual', ['japan']), source('https://www.ono-pharma.com/ja/news/20260611_2.html', 'スウェーデンのストックホルム', '同一结果的公布会址', 'explicit', ['europe'])]);
add('6aca0bfc46c3f0b3', ['japan'], '此次是日本根治切除不能甲状腺未分化癌适应证扩展申请。正文列举其他国家既往批准和历史许可，不属于本次新增市场。', official, [source('https://www.ono-pharma.com/ja/news/20260611.html', '国内製造販売承認事項一部変更承認申請', '申报市场', 'contextual')]);
add('3f312461934cd397 140e2eb68041ff2e', ['japan'], '转让涉及日本小野田、吉富工厂，以及日本国内 17 产品的制造销售权。签约、未来交割和未来承继不是同一状态；不推断海外资产一并转让。', official, [source('https://www.tanabe-pharma.com/ja/news/rel_260703.html', '国内の製造販売承認および製造販売権', '转让权利范围', 'contextual')]);
add('68f3e7468fa79f91', ['southeast_asia'], '此次 Canalia 获批辖区为泰国，归东南亚；印尼只是市场对比，日本是药物来源背景，不作为本次获批地区。', official, [source('https://www.tanabe-pharma.com/ja/news/rel_260626.html', 'タイにおける製造販売承認を取得', '泰国监管辖区')]);
add('727ccd206685c83a', ['japan'], '此次 Enspryng 的 MOGAD 适应证申请提交日本 MHLW。全球研究及其他适应证既往市场不加到本次申报地区；没有把申请写成获批。', official, [source('https://www.chugai-pharm.co.jp/english/news/detail/20260731153000_1274.html', 'was filed in Japan', '申报辖区')]);
add('664447d94b2cac63', ['japan'], '同一 64Cu-PSMA-I&T 项目的官方管线记载日本国内承认目标及开发／商业化范围；用于核对本条国内试验指代，不用后续管线状态改写旧新闻时间。', '核对存档新闻与 PeptiDream 官方管线中的同一候选药及合作项目；未复核全部试验注册数据。', [source('https://www.peptidream.com/pipeline/', '日本国内における 開発および商業化', '项目开发市场')]);
add('be5ae1cf92467df9', ['global'], '本次行权对象是最多两个候选项目的全球开发、制造、销售许可。IND 计划未直接列明申报机关，本次不只凭 IND 缩写添加美国。', official, [source('https://www.jcrpharm.co.jp/news/002373.html', '全世界での開発、製造および販売', '许可范围')]);
add('928ce7024da765b6 97d2ba56bde223c6 8876c76bb1b929b7 b108b8b49118ea45', ['japan'], '四条报道涉及 JCR 的 givinostat 日本开发／申请时间表。通过官方同日国内开发计划公告索引核定日本语境；未把美国／欧盟既往获批当作这次申请，也未确认未来时间表兑现。', '已读各条存档标题／摘录及 JCR 7月15日官方公告索引；未读取说明会完整视频或全部附件。', [source('https://www.jcrpharm.co.jp/pressrelease/', 'givinostatの国内開発計画', '官方公告标题所指开发市场', 'contextual')]);
add('63e45022cb500185 6e0ca9ccbebfc675 6eb9504bc1181d72', ['europe', 'north_america'], '德国 Merck 与美国 Minnesota 法人 Bio-Techne 的跨境并购签约，保留交易主体法域。不是只凭新闻电头，也不把双方世界各地客户自动计入，更不修改公司集团关系。', '已读 Merck 交易公告和 Bio-Techne 投资者站点合并协议条款的公开段落。', [source('https://investors.bio-techne.com/all-sec-filings/content/0001140361-26-033911/ny20078105x2_defm14a.htm?TB_iframe=true&height=auto&preload=false&width=auto', 'a German corporation', '收购方法人辖区', 'explicit', ['europe']), source('https://investors.bio-techne.com/all-sec-filings/content/0001140361-26-033911/ny20078105x2_defm14a.htm?TB_iframe=true&height=auto&preload=false&width=auto', 'a Minnesota corporation', '被收购方法人辖区', 'explicit', ['north_america'])]);
add('393f1147e96daed9', ['japan'], 'Pfizer 与 Eisai 的 Nurtec 联合推广明确限定日本国内，并计划9月1日开始。不是从日本药业媒体名称推定，也不是新药全球批准。', official, [source('https://www.pfizer.co.jp/pfizer/company/press/2026/2026-07-27', '国内におけるコ・プロモーション', '联合推广市场', 'contextual')]);
add('aec4bd5d2dc6c41d', ['north_america', 'europe'], '标题的欧米指欧洲和美国；这里只确认新闻指向的监管地区，不把撤销建议、正式撤销和各地区决定混为一谈。', '核对存档标题，并查阅日本厚生劳动省对欧盟建议、美国动向的公开说明。', [source('https://www.mhlw.go.jp/stf/kaiken/daijin/0000194708_00946.html', '欧州医薬品庁（EMA）', '欧洲监管行动', 'explicit', ['europe']), source('https://www.mhlw.go.jp/stf/kaiken/daijin/0000194708_00946.html', '開発国である米国の今後の動向', '美国监管动向', 'explicit', ['north_america'])]);
add('914220cc4f93f937', ['japan', 'north_america'], '撤稿报道不仅提美国医学期刊，还明确涉及 FDA 调查及日本厚生劳动省协商，因此计入美日监管关系；不是仅根据期刊国籍。', '已读该事件的共同社公开报道（千叶日报转载）及日本厚生劳动省后续公开说明，未复核临床数据。', [source('https://www.chibanippo.co.jp/newspack/20260630/1635141', '厚生労働省などに状況を報告', '日本监管应对', 'explicit', ['japan']), source('https://www.chibanippo.co.jp/newspack/20260630/1635141', '米国での承認取り下げを提案', '美国监管行动', 'explicit', ['north_america'])]);
snapshot('e735cfa97567e552', ['north_america'], 'FBI / CODIS 是美国刑事司法 DNA 数据体系，本条许可事项按美国应用辖区计入；并非药品 FDA 批准，未独立核验许可文件。');
add('88a255f65615ec86', ['europe', 'north_america'], 'AAIC 2026 会场为伦敦，部分公布研究为美国真实世界临床资料，分别保留会址与研究样本范围。线上参会不自动变成全球市场；东京电头不计入。', '已读 Eisai 关于此次参会的官方公开正文段落；未阅读全部52份摘要。', [source('https://media-us.eisai.com/2026-06-29-Eisai-to-Showcase-Alzheimers-Disease-Portfolio-with-More-Than-50-Presentations-at-the-Alzheimers-Association-International-Conference-R-2026-AAIC-R', 'in London and online', '会址', 'explicit', ['europe']), source('https://media-us.eisai.com/2026-06-29-Eisai-to-Showcase-Alzheimers-Disease-Portfolio-with-More-Than-50-Presentations-at-the-Alzheimers-Association-International-Conference-R-2026-AAIC-R', 'diverse US clinical settings', '所公布研究的临床范围', 'explicit', ['north_america'])]);
add('8ee7111897daff75', ['japan'], 'LADEC 2026 会址明确为日本科学未来馆，属于日本活动；并非从 Nacalai 总部地址猜测。', official, [source('https://www.nacalai.co.jp/news/news/LADEC2026-20260617.html', '日本科学未来館', '活动会址')]);
add('9da1ddd5209d7fc5', ['north_america'], '访谈具体提到 Gaithersburg（美国 Maryland）站点的预批准检查和商业载体供给能力，计美国；不将受访者德国履历当作该检查地点。', '已读 Miltenyi 官方访谈文字，未追查外链全部监管报告。', [source('https://www.miltenyibioindustry.com/ja/resources/miltenyi-bioindustry-insights/why-an-experienced-partner-for-cell-and-gene-therapy-manufacturing-is-a-game-changer.html', 'Gaithersburg (Maryland, US) site', '受检查的生产站点')]);
add('b8754e1bf51c4d54', ['global', 'north_america'], '访谈明确以全球 CGT 可及性为议题，并提美国 FDA AMT 路径和圣迭戈 BIO 2026 活动。全球是议题范围，不代表 Cytiva 已在每国建立产能。', '已读 BioPharm International 的原创问答公开文字，未核验其外引行业统计。', [source('https://www.biopharminternational.com/view/q-a-cytiva-pierre-alain-ruffieux-scaling-cell-gene-therapy-manufacturing-global-access', 'improve global patient access', '明确的行业议题范围', 'explicit', ['global']), source('https://www.biopharminternational.com/view/q-a-cytiva-pierre-alain-ruffieux-scaling-cell-gene-therapy-manufacturing-global-access', 'San Diego, Calif.', '配套活动会址', 'explicit', ['north_america'])]);
add('64aac44c8d3dc548', ['china', 'north_america'], '采访在圣迭戈 BIO 2026 进行，文字还具体讨论原在中国开发的分子重新进入美国流程的原料切换风险。仅记录该讨论的中美技术转移关联，不代表每个项目已迁移。', '已读原创采访的网页文字总结，未观看完整视频。', [source('https://www.biopharminternational.com/view/thermo-fisher-scientific-paul-jorjorian-genetic-medicine-partnership-raw-material-risk', 'developed in China are being re-established in US-based workflows', '技术转移讨论范围')]);

add('3e4c30453ac323e0', ['nonregional'], '本页是 Sbp2l 抗体用途与染色验证，不限定供给国。页头 Japan 站点选择及论文作者名不作为市场证据，未追查引用论文全部机构。', '已读 Wako 产品应用页正文，未把引用论文全文算作已读。', [source('https://labchem-wako.fujifilm.com/jp/category/03605.html', '免疫組織染色やウエスタンブロッティング', '未限定市场的产品应用内容', 'contextual')]);
add('3a566acc6b15d0ea', ['nonregional'], 'NSF-23 页面展示神经细胞培养用途和对照实验，没有具体市场范围。页脚京都地址不作为本条试验地点或供应地域。', '已读 Nacalai 产品说明与价格表可见文字，未读取全部 SDS。', [source('https://www.nacalai.co.jp/products/459', '初代培養神経細胞の培養', '未限定市场的技术说明', 'contextual')]);
add('00be57c50625421b', ['nonregional'], 'BCMA×CD3 文章讨论靶点机制、临床进展与耐药挑战，正文没有将本次技术讨论限定到国家。提到研究和已获批药物不自动补出审批辖区，网站语言也不计入。', '已读 ACRO 该技术文章正文与 FAQ；未阅读参考文献全文。', [source('https://www.acrobiosystems.com/insights/bcma-cd3-bispecific-antibodies', 'Key Challenges in BCMA×CD3 bsAb Development', '未限定地区的技术讨论', 'contextual')]);
add('253c101021cba8de', ['nonregional'], 'p-Tau217 公告介绍蛋白及检测用途，没有为该产品限定市场。Houston 仅是电头，90国是公司整体背景，不能当作本次产品地区。', '已读 Sino 经 BioSpace 发布的产品公告正文。', [source('https://www.biospace.com/press-releases/sino-biological-launches-precisely-characterized-full-length-p-tau217-protein-to-advance-next-generation-alzheimers-biomarker-assay-development', 'Broad Applications in Alzheimer’s Biomarker Assay Development and Tau Research', '未限定地区的产品用途', 'contextual')]);
add('3afc2b25efbc63ef', ['nonregional'], 'Amicon 抗体标记清理内容是实验步骤及结果，不是地区市场新闻。网址 BY 站点不能推出白俄罗斯实施或销售。', '已读 Merck 官方 protocol 网页公开文字。', [source('https://www.merckmillipore.com/BY/en/technical-documents/protocol/protein-biology/protein-labeling-and-modification/clean-up-of-antibody-labeling-reactions', 'remove unreacted fluorescent labels', '通用实验方法', 'contextual')]);
add('1b14a670d5149073', ['nonregional'], 'Fluorescein 细胞死亡检测试剂盒内容是固定、双染与背景排查方法，没有地区限定。TJ 网址和一般法规提醒不说明实验地点。', '已读 Merck protocol 与 troubleshooting 公开文字，未读取全部引用。', [source('https://www.merckmillipore.com/TJ/en/technical-documents/protocol/cell-culture-and-cell-culture-analysis/cell-counting-and-health-analysis/in-situ-cell-death-detection-kit-fluorescein', 'Fixation of Tissue Sections', '通用实验方法', 'contextual')]);
add('18eb63f029cccd93', ['nonregional'], 'RNAscope webinar 文字简介讨论前列腺癌组织的空间异质性，没有限定市场或会址。讲者机构和页脚 Minneapolis 联系地址不视为研究样本或活动地点。', '已读 Bio-Techne webinar 简介，未观看视频、读取字幕或确认研究样本国家。', [source('https://www.bio-techne.com/resources/webinars/rnascope-prostate-cancer-spatial-profiling', 'map and decode tumor biology', '技术分享简介', 'contextual')]);

add('6d3561c7f3242295 8c23039911cec8e1', [], 'GMP 细胞加工业务承继公告没有列出交割设施的地点，人员、资产及合同范围仍在协商。日本公司参与不能代替被转让资产地域；仍不能确认具体实施地区。', '补读 Takara Bio 6月23日、7月21日日英文公告及 Holdings 后续公告；已读公开正文，未取得最终资产清单。', [source('https://www.takara-bio.co.jp/ja/news/newsr_26m0623hyti.html', 'GMP細胞加工受託の事業基盤', '已读正文仍未明确资产地点'), source('https://www.takara-bio.co.jp/ja/news/newsr_26m721hyti.html', '基本合意', '后续协商公告')], 'place_missing');
add('6e9ac55b265d023b', [], 'ARCT-032 合作没有指明本次生产设施、3期中心国家或权利地域。季报补充 Patheon UK Limited 合同方，但不说明制造设施在英国；季报中2期试验国家不能套到未来3期。', '已读7月合作公告，并补读第二季度 SEC 披露的合作与试验段落；尚无该3期项目实施地点证据。', [source('https://ir.arcturusrx.com/news-releases/news-release-details/arcturus-therapeutics-announces-strategic-collaboration-thermo', 'Phase 3 manufacturing, clinical research, and related services', '已读公告仍未明确实施地点'), source('https://www.sec.gov/Archives/edgar/data/1768224/000119312526338090/arct-20260630.htm', 'Patheon UK Limited', '已核对合同方，不等同制造设施')], 'place_missing');
add('ca7fdd02fe028310', ['global'], '补读 Takara 官方日文公告后确认 Seeker / Trekker 可不受销售地域限制向全世界提供，归全球业务范围。不是美国 SEC 渠道或美国公司地址推断；不把全球范围展开为每个国家的独立新闻。', '已读 Takara Bio 同一专利许可公告正文；未读完整许可合同。', [source('https://www.takara-bio.co.jp/ja/news/newsr_26m06hthy.html', '販売地域の制限なく、全世界において', '许可后的产品销售范围')]);
add('6858bf4b793b0b96', ['nonregional'], 'Bridging ELISA 正文讨论双特异性抗体双靶结合、检测与质量控制，没有限定应用市场。已补到同名正文，不以 kr 域名判断韩国。', '已读官方 www 入口返回的同名正文及 FAQ；未读引用论文全文。', [source('https://www.acrobiosystems.com/insights/bispecific/bridging-elisa-bispecific-antibody', 'simultaneous dual-target engagement', '不限定地区的实验方法', 'contextual')]);
add('ea54a465b2563822', ['nonregional'], '双载荷 ADC 正文讨论临床药理、PK/PD 和生物标志物挑战，没有限定该技术讨论的地域。ASP2998 公司归属不等于试验地点，德国站点不作为地区证据。', '已找到包含 /adc/ 的有效文章路径并读取正文与 FAQ；未读外链参考文献。', [source('https://www.acrobiosystems.com/insights/adc/dual-payload-adcs-translational-challenges-clinical-pharmacology', 'PK/PD Mismatch Creates Biomarker Challenges', '不限定地区的技术讨论', 'contextual')]);
add('c3944558211d8045', ['nonregional'], '同名正文介绍 ADC 总抗体与偶联药物定量的 ELISA 方法、结果和应用，不限定国家。引言的既往药物批准只是背景，不能作为本篇方法的新市场。', '已找到并读取 ACRO 对应 ADC 生物分析文章正文及 FAQ；未追查参考论文。', [source('https://www.acrobiosystems.com/insights/adc/adc-bioanalytical-assays-for-pk-quantification', 'Total antibody bioanalytical assay', '不限定地区的检测方法', 'contextual')]);
add('6c11d29671d535d3', ['nonregional'], '已确认这是 CGT 制造访谈的栏目索引，而非一个新建工厂或合作公告。栏目介绍不限定地区；作者德国、美国所在地及其他访谈里的工厂不套用到索引本身。', '已读该官方栏目页的介绍和可见访谈条目，未把全部链接内容算作已读。', [source('https://www.miltenyibioindustry.com/en/resources/miltenyi-bioindustry-insights.html', 'Cell and Gene Therapy Manufacturing Insights', '内容栏目，不限定地区', 'contextual')]);
add('5e7891e69fcc6c1a', ['japan'], '匹配同日2026年6月15日的日本药品供给通知记录及日元药价，按日本供给语境归类。通知指 Fiblast Spray 250 的5瓶包装，并非全部 Fiblast 产品停供；原厂附件尚未成功读取。', '已读 DSJP 公开药品供应记录，核对产品、厂家、通知日期和包装；这是辅助公开证据，不是原厂附件全文核验。', [source('https://drugshortage.jp/drugdata.php?drugid=394605', 'フィブラストスプレー250', '同日同品种的日本供给通知', 'contextual')]);
add('01307febbeb56eba', ['nonregional'], '同一第4届联合研讨会已确认于7月8日以 Zoom 线上举行，未注明地域限定受众，因此不指定线下会址，也不把线上等同于全球市场。', 'PeptiDream 原页未取得，已补读同场参与公司 TMS 公告并匹配届次、时间及主题；未观看会议。', [source('https://www.tms-japan.co.jp/ja/ir/news/news-7351251014732822750.html', 'Zoomウェビナーによるオンライン開催', '已确认线上活动，无线下会址')]);

const items = new Map(payload.items.map(item => [item.id, item]));
const ids = rows.flatMap(row => row.ids);
assert.equal(ids.length, new Set(ids).size, 'Repeated decision ID');
const entries = rows.flatMap(row => row.ids.map(id => {
  const item = items.get(id);
  assert.ok(item, `Missing source record ${id}`);
  const status = row.regions.length ? row.regions.includes('nonregional') ? 'nonregional' : 'identified' : 'pending';
  assert.equal(!!row.reason, status === 'pending', id);
  const evidence = row.evidence.length ? row.evidence.map(s => ({ regions: s.regions || row.regions, ...s })) : [{
    regions: row.regions, url: item.url, quote: item.title.split(/\s+/).slice(0, 18).join(' '),
    kind: '存档标题及来源摘录', material: 'snapshot', quality: status === 'pending' ? 'limited' : 'explicit',
  }];
  return { ids: [id], title: item.title, status, scope: row.scope, note: row.note, evidence, reason: row.reason, checkedAt: '2026-09-09', reviewer: 'Codex', method: 'source_backed_semantic_review' };
}));
const end = payload.generated_at.slice(0, 10);
const start = period.offset(end, -89);
const selected = payload.items.filter(item => ['daily', 'immediate'].includes(item.tier) && period.publicationDate(item) >= start && period.publicationDate(item) <= end);
const covered = new Set([...prior.semanticReviews.flatMap(row => row.ids), ...ids]);
assert.equal(selected.length, 146);
assert.ok(selected.every(item => covered.has(item.id)), `Unreviewed: ${selected.filter(item => !covered.has(item.id)).map(item => item.id)}`);
assert.ok(ids.every(id => selected.some(item => item.id === id)), 'New decisions outside this batch');
const output = { version: '2026-09-09.full1', scope: { start, end, total: selected.length, tier: 'daily+immediate', ids: selected.map(item => item.id).sort() }, entries };
fs.writeFileSync(path.join(root, 'web/region-review-batch.js'), `(function(root) {\n  const batch = ${JSON.stringify(output, null, 2)};\n  root.AIHOT_REGION_REVIEW_BATCH = batch;\n  if (typeof module !== "undefined" && module.exports) module.exports = batch;\n})(typeof window === "undefined" ? globalThis : window);\n`);
const decisions = new Map(prior.semanticReviews.flatMap(row => row.ids.map(id => [id, row])));
for (const row of entries) decisions.set(row.ids[0], row);
const audit = selected.map(item => {
  const { guard, ...review } = decisions.get(item.id);
  return { id: item.id, title: item.title, publicationDate: period.publicationDate(item), ...review };
});
const counts = audit.reduce((counts, row) => {
  counts[row.status]++;
  if (row.reason) counts[row.reason] = (counts[row.reason] || 0) + 1;
  return counts;
}, { identified: 0, nonregional: 0, pending: 0 });
fs.writeFileSync(path.join(root, 'preview-checks/region-full-audit-20260909.json'), JSON.stringify({ scope: output.scope, counts, records: audit }, null, 2));
console.log(`Bound ${entries.length} new decisions; ${selected.length} selected records covered. No article or collection data changed.`);
