const assert = require('node:assert/strict');
const model = require('../web/region-model.js');
const cases = [
  ['launches in the U.S. for adults', ['north_america']],
  ['Ｕ．Ｓ． approval announced', ['north_america']],
  ['Contact us for more information', ['unknown']],
  ['米国で承認を取得', ['north_america']],
  ['米Aitia社と共同研究契約を締結', ['north_america']],
  ['米FDAが新薬を承認', ['north_america']],
  ['オーストラリアで承認取得', ['oceania']],
  ['EUで適応拡大承認を取得', ['europe']],
  ['台湾で承認', ['china']],
  ['FDA approves new therapy', ['north_america']],
  ['FDA laboratory supplies', ['unknown']],
  ['EMA recommends approval', ['europe']],
  ['PMDA reviews the application', ['japan']],
  ['TGA approves therapy', ['oceania']],
  ['厚生労働省に承認申請', ['japan']],
  ['グローバル開発・販売権のライセンス契約', ['global']],
  ['Global leader in cell therapy products', ['unknown']],
  ['A global view of protein structures', ['unknown']],
  ['Worldwide license excluding China', ['global']],
  ['中国を除く全世界の販売権', ['global']],
  ['Research in Seoul and Tokyo', ['japan', 'korea']],
  ['Headquartered in Tokyo, the company launches a new product', ['unknown']],
  ['Company based in Boston', ['unknown']],
  ['亚洲市场合作', ['asia_unspecified']],
  ['アジア太平洋で販売', ['apac_unspecified']],
  ['Southeast Asia and Indonesia', ['southeast_asia']],
  ['Asia-Pacific collaboration', ['apac_unspecified']],
  ['印度尼西亚的临床试验', ['southeast_asia']],
  ['南アジアで販売', ['south_asia']],
  ['米トランプ氏との対米投資会合', ['north_america']],
  ['New product - Taiwan News', ['unknown']],
  ['武田薬品の戦略 - 日本経済新聞', ['unknown']],
  ['デンマーク社に譲渡 - 日本経済新聞', ['europe']],
  ['Acquisition of Worldwide Clinical Trials', ['unknown']],
  ['Morgan Stanley Global Healthcare Conference', ['unknown']],
  ['富士フイルム和光純薬日本官网的新产品信息。', ['unknown']],
];
for (const [title, expected] of cases) assert.deepEqual(model.analyze({ title }).regions, expected, title);
for (const mode of ['content', 'reviewed', 'clues']) {
  assert.deepEqual(model.analyze({ title: 'Antibody technology', ai_summary: '在日本发布', source_label: 'China News', matched_companies: ['Tokyo Ltd.'] }, mode).regions, ['unknown']);
}
assert.deepEqual(model.analyze({ title: 'Drug approval', evidence: { source_excerpt: 'The FDA approved this medicine.' } }).regions, ['north_america']);
assert.equal(model.analyze({ title: '国内で承認申請' }).reason, 'vague');
assert.equal(model.analyze({ title: 'Antibody technology', source_label: 'Japan News' }).reason, 'weak');
assert.equal(model.analyze({ title: 'New antibody platform' }).reason, 'short');
assert.equal(model.analyze({ title: 'New platform', summary: 'This platform measures binding and quantifies antibody responses across different laboratory protocols with high reproducibility.' }).reason, 'unspecified');
const item = { id: '25585e893f5bb468', title: 'DS1025の第1相臨床試験を開始' };
assert.deepEqual(model.analyze(item, 'content').regions, ['unknown']);
assert.deepEqual(model.analyze(item, 'reviewed').regions, ['japan', 'europe', 'asia_unspecified']);
assert.deepEqual(model.analyze({ ...item, id: 'other' }).regions, ['unknown']);
assert.deepEqual(model.analyze({ ...item, title: 'Unrelated news' }).regions, ['unknown']);
assert.ok(!model.apac.includes('asia_unspecified'));
assert.ok(model.apac.includes('oceania'));
assert.equal(new Set(model.definitions.map(row => row.id)).size, model.definitions.length);
console.log(`${cases.length} geographic cases, admission boundaries, verified-evidence guards and unknown reasons passed.`);
