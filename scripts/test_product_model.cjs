const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const model = require('../web/product-model.js');
const technology = require('../web/overview-model.js');
const companies = [
  { id: 'c', display_name: 'Customer Pharma', business_role: 'customer' },
  { id: 'v', display_name: 'Vendor Bio', business_role: 'competitor' },
  { id: 'acro', display_name: 'ACROBiosystems', business_role: 'self' },
];
const analyze = (title, company_id = 'v', extra = {}) => model.analyze({ title, company_id, ...extra }, companies);
let checks = 0;
function has(title, category, expected = true, company = 'v') {
  assert.equal(analyze(title, company).categories.includes(category), expected, `${category}: ${title}`); checks++;
}
for (const title of ['推进 ADC 药物临床研发', 'mRNA 治疗方法研发', '肿瘤药物研发', '病毒相关治疗研究', '类器官用于治疗方法研究', 'Neuro drug discovery', '纳米抗体药物研发', 'TCR-T clinical trial', 'in vivo-CAR therapy', 'iPSC cell therapy']) has(title, 'drug', true, 'c');
for (const title of ['肿瘤新闻', '免疫相关讲座', '病毒检测技术', 'New T cell research', 'Vendor launches cell lines for drug discovery', '推出 ADC 内吞检测试剂盒用于药物开发']) has(title, 'drug', false);
for (const title of ['推出 DNase 产品', 'New RNase reagent', 'Launch of Cas9 enzyme', '推出 MHC 蛋白产品', '推出 IL-2 重组蛋白', '靶点蛋白的治疗方法研究']) has(title, 'protein');
for (const title of ['推出融合蛋白产品', '推出酶产品', 'HER2 临床治疗进展', 'Cas9 基因编辑技术研究']) has(title, 'protein', false);
for (const title of ['推出脱氧核糖核酸酶产品', 'Deoxyribonuclease reagent launch', '推出核糖核酸酶产品']) has(title, 'protein');
assert.deepEqual(analyze('推出脱氧核糖核酸酶产品').matches.find(row => row.id === 'protein').terms, ['DNase']); checks++;
for (const title of ['Launch of monoclonal antibody product', '推出双抗产品', 'BsAb therapy clinical trial', '推出 anti-G4S antibody 产品', '推出 ADA 抗体检测试剂', 'RDC drug clinical development']) has(title, 'antibody');
for (const title of ['推出科研型抗体', 'ADA software product launch', 'RDC warehouse launch']) has(title, 'antibody', false);
for (const title of ['推出 qPCR 试剂盒', 'New ELISA kit', 'PK assay kit', 'PD assay reagent', 'tLNP detection kit', '推出宿主 DNA 检测试剂盒', 'ADC 内吞检测试剂盒', 'Biomarker detection kit']) has(title, 'assay');
for (const title of ['PCR 试剂盒', 'ELISpot kit', '流式检测试剂盒', '病毒滴度试剂盒', 'ELISA 方法研究', 'SPR 方法研究', 'PK clinical analysis']) has(title, 'assay', false);
for (const title of ['Anti-PD-1 antibody reagent launch', 'Anti-PD-L1 antibody kit launch']) has(title, 'assay', false);
for (const title of ['推出基因敲除细胞株产品', 'Launch of overexpression cell line products', '供应 HEK293 细胞株', '推出 iPSC 细胞产品', '销售类器官模型产品']) has(title, 'cell');
for (const title of ['供应 T 细胞', '供应 B 细胞', '肿瘤细胞研究', '免疫细胞研究', '细胞培养技术研究', '类器官用于疾病模型研究']) has(title, 'cell', false);
for (const title of ['推出无血清培养基', '推出化学合成培养基', '推出细胞扩增试剂', 'Launch of cell activation reagent']) has(title, 'culture');
for (const title of ['推出血清产品', '推出培养补充剂', '转染试剂发布', '细胞冻存产品发布', '细胞因子产品发布', '生长因子产品发布', 'chemically defined medium launch']) has(title, 'culture', false);
for (const title of ['推出双抗磁珠', '推出抗体标记磁珠', '推出生物素标记磁珠', '推出细胞培养袋', 'Cytopak product launch']) has(title, 'bead');
for (const title of ['推出培养板', '微流控芯片发布', '过滤组件发布', '一次性耗材发布']) has(title, 'bead', false);
for (const title of ['GMP 设施建设', 'CMC 生产扩建', '采购细胞计数设备', 'Launch of flow cytometer']) has(title, 'equipment');
for (const title of ['采购质谱仪', '色谱设备发布', 'GMP 技术讲座', 'Using flow cytometers for cell research']) has(title, 'equipment', false);
for (const title of ['TR-FRET 定制服务', '流式检测服务', 'SPR services', 'BLI services', 'GMP蛋白定制', 'GMP培养基定制', 'GMP磁珠定制', 'AI辅助蛋白开发', '细胞系定制服务']) has(title, 'service');
for (const title of ['工艺开发服务', '抗体开发临床进展', 'SPR 方法研究']) has(title, 'service', false);
const customer = analyze('Customer Pharma advances ADC drug clinical trial', 'c');
assert.deepEqual(customer.matches.find(row => row.id === 'antibody').directions, ['customer']); checks++;
const supplier = analyze('Vendor Bio launches ADC internalization assay kit');
assert.deepEqual(supplier.matches.find(row => row.id === 'assay').directions, ['competitor']); checks++;
assert.ok(!supplier.categories.includes('drug')); checks++;
assert.deepEqual(analyze('ACROBiosystems launches DNase product', 'acro').matches[0].directions, ['unspecified']); checks++;
assert.deepEqual(analyze('Unknown launches DNase product', '').matches[0].directions, ['unspecified']); checks++;
const actual = require('../data/latest_run.json');
for (const [id, category, excluded] of [
  ['411e8520e5b8256c', 'cell', 'drug'],
  ['cb582bed07d28e07', 'protein', 'drug'],
  ['bfdf2b217eb30fc1', 'protein', 'assay'],
  ['ccdfb3f35238d546', 'culture', 'drug'],
]) {
  const item = actual.items.find(item => item.id === id);
  if (!item) continue;
  const result = model.analyze(item, actual.companies);
  assert.ok(result.categories.includes(category), item.title); checks++;
  assert.ok(!result.categories.includes(excluded), item.title); checks++;
}
has('BCMA×CD3 Bispecific Antibodies: Mechanism, Clinical Progress and Challenges', 'antibody');
has('Full-length p-Tau217 Protein research methods', 'protein', false);
has('GMP-grade IL-15 Used in Cell Therapy Manufacturing', 'drug', false);
has('Cell culture media preparation techniques', 'culture', false);
const mixed = analyze('Customer Pharma advances ADC drug clinical trial. Vendor Bio launches DNase reagent.', 'c', { matched_company_ids: ['c', 'v'] });
assert.deepEqual(mixed.matches.find(row => row.id === 'drug').directions, ['customer']); checks++;
assert.deepEqual(mixed.matches.find(row => row.id === 'protein').directions, ['competitor']); checks++;
assert.equal(model.matches(mixed, ['drug'], 'competitor'), false); checks++;
assert.equal(model.matches(mixed, ['drug', 'protein'], 'competitor'), true); checks++;
const joint = analyze('Customer Pharma and Vendor Bio announce an ADC therapy and assay kit collaboration.', 'c', { matched_company_ids: ['c', 'v'] });
assert.ok(joint.matches.every(row => row.directions.every(direction => direction === 'unspecified'))); checks++;
const shortName = model.analyze({ title: 'Astellas launches an ADC internalization assay kit', matched_company_ids: ['tella', 'astellas'] }, [
  { id: 'tella', display_name: 'tella', business_role: 'customer' },
  { id: 'astellas', display_name: 'Astellas', business_role: 'competitor' },
]);
assert.deepEqual(shortName.matches.find(row => row.id === 'assay').directions, ['competitor']); checks++;
const synonymous = analyze('Launch of monoclonal antibody mAb 单克隆抗体 单抗 product');
assert.equal(synonymous.matches.find(row => row.id === 'antibody').terms.filter(term => term === '单抗').length, 1); checks++;
assert.deepEqual(analyze('Company update', 'v', { ai_summary: '推出 DNase 产品', title_zh: '推出 ADC 药物', intelligence: { product_needs: ['重组蛋白'] } }).categories, []); checks++;
assert.ok(analyze('Company update', 'v', { evidence: { source_excerpt: '推出 DNase 产品' } }).categories.includes('protein')); checks++;
assert.equal(model.matches(analyze('公司一般公告'), ['unidentified'], 'unspecified'), true); checks++;
assert.equal(model.matches(analyze('公司一般公告'), ['protein'], 'all'), false); checks++;
assert.equal(model.definitions.length, 9); checks++;
const original = { id: 'unchanged', title: '推出 DNase 产品', tier: 'archive', score: 12, acro_relevance: { score: 4 }, company_id: 'v' };
const snapshot = JSON.stringify(original); analyze(original.title, 'v', original);
assert.equal(JSON.stringify(original), snapshot); checks++;
for (const text of ['ELISpot immunoassay', 'PCR molecular biology', 'single-cell sequencing', 'mass spectrometry', 'chromatography']) {
  const item = { title: text }; const before = technology.topics(item); model.analyze(item, companies); assert.deepEqual(technology.topics(item), before); checks++;
}
if (fs.existsSync('/tmp/acro-product-baseline.json')) {
  for (const [file, hash] of Object.entries(JSON.parse(fs.readFileSync('/tmp/acro-product-baseline.json')))) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname, '..', file))).digest('hex'), hash, file); checks++;
  }
}
console.log(`PASS ${checks} product checks; protected source data, identity, technology, scores and schedules unchanged.`);
