const assert = require('node:assert/strict');
const model = require('../web/region-model.js');
const cases = [
  ['日本に新工場', ['japan']],
  ['Research in Seoul and Tokyo', ['japan', 'korea']],
  ['South Korea clinical trial', ['korea']],
  ['North Korea clinical trial', ['other']],
  ['Clinical trial in India and Singapore', ['india', 'singapore']],
  ['United States and Australia study', ['australia', 'other']],
  ['Ｕ．Ｓ． approval announced', ['other']],
  ['米国で承認を取得', ['other']],
  ['米Aitia社と共同研究契約を締結', ['other']],
  ['オーストラリアで承認取得', ['australia']],
  ['英国、中国、美国站点部署', ['other']],
  ['印度尼西亚的临床试验', ['other']],
  ['インドネシアで販売', ['other']],
  ['Publication in Indiana', ['unknown']],
  ['Roman studies', ['unknown']],
  ['Contact us for more information', ['unknown']],
  ['FDA approves new therapy', ['unknown']],
  ['EMA recommends approval', ['unknown']],
  ['PMDA reviews application', ['unknown']],
  ['TGA approves therapy', ['unknown']],
  ['Global license', ['unknown']],
  ['Worldwide license excluding China', ['unknown']],
  ['中国を除く全世界の販売権', ['unknown']],
  ['APAC-EN news', ['unknown']],
  ['Southeast Asia conference', ['unknown']],
  ['欧州・アジア市場', ['unknown']],
  ['New product - Taiwan News', ['unknown']],
  ['武田薬品の戦略 - 日本経済新聞', ['unknown']],
  ['日本新薬、新薬を発表', ['unknown']],
  ['Headquartered in Tokyo, Japan, the company launches a product', ['unknown']],
  ['Headquartered in Tokyo, Japan, trials begin in India', ['india']],
  ['Singapore-based company launches a platform', ['unknown']],
  ['Headquartered in the US, the company launches a platform', ['unknown']],
  ['Headquarters in Japan and Korea', ['unknown']],
  ['日本語のウェブサイト', ['unknown']],
  ['印度洋研究', ['unknown']],
  ['总部位于日本，试验在澳大利亚开展', ['australia']],
  ['TOKYO, Japan, September 10, 2026 /PRNewswire/ launches product', ['unknown']],
  ['Launch in Japan and Japan', ['japan']],
];
for (const [title, regions] of cases) assert.deepEqual(model.analyze({ title }).regions, regions, title);
const acroOthers = '阿富汗、阿尔及利亚、澳属萨摩亚、安哥拉、亚美尼亚、阿塞拜疆、巴林、孟加拉国、不丹、文莱、柬埔寨、喀麦隆、埃及、斐济、法属波利尼西亚、关岛、印度尼西亚、伊朗、伊拉克、以色列、约旦、哈萨克斯坦、科威特、吉尔吉斯斯坦、老挝、黎巴嫩、马来西亚、马尔代夫、蒙古、缅甸、尼泊尔、新喀里多尼亚、新西兰、阿曼、巴基斯坦、巴勒斯坦、巴布亚新几内亚、菲律宾、卡塔尔、俄罗斯、沙特阿拉伯、所罗门群岛、斯里兰卡、叙利亚、塔吉克斯坦、泰国、东帝汶、汤加、土耳其、土库曼斯坦、阿联酋、乌兹别克斯坦、瓦努阿图'.split('、');
for (const country of acroOthers) assert.deepEqual(model.analyze({ title: country + '临床试验' }).regions, ['other'], country);
for (const locale of ['en', 'zh-Hans', 'ja']) {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  for (const country of model.countryCodes) {
    const region = model.businessDefinitions.find(row => row.country === country)?.id || 'other';
    assert.deepEqual(model.analyze({ title: names.of(country) + ' trial' }).regions, [region], locale + ':' + country);
  }
}
for (const mode of ['content', 'reviewed']) {
  assert.deepEqual(model.analyze({ title: 'Antibody technology', ai_summary: '在日本发布', source_label: 'Singapore News', matched_companies: ['Tokyo Ltd.'], company: 'India Ltd', regions: ['japan'] }, mode).regions, ['unknown']);
}
assert.deepEqual(model.analyze({ title: 'New trial', evidence: { source_excerpt: 'Research in Australia.' } }).regions, ['australia']);
const explicit = { id: 'bf4f2e275594a361', title: 'Abcam and Genedata collaborate' };
assert.deepEqual(model.analyze(explicit).regions, ['other']);
assert.deepEqual(model.analyze({ ...explicit, id: 'not-reviewed' }).regions, ['unknown']);
assert.deepEqual(model.analyze({ ...explicit, title: 'Unrelated title' }).regions, ['unknown']);
assert.deepEqual(model.analyze({ id: '0388959ac0342a8d', title: 'オキシトシン 4F1' }).regions, ['unknown']);
const items = [
  { id: 'a', title: 'Japan Singapore trial' },
  { id: 'b', title: 'Global study' },
  { id: 'c', title: 'United States study' },
];
assert.equal(model.partition(items).located.length, 2);
assert.equal(model.partition(items).pending.length, 1);
assert.deepEqual(model.distribution([...items, items[0]]).map(row => row.items.length), [1, 0, 0, 1, 0, 1]);
assert.deepEqual(model.businessDefinitions.map(row => row.label), ['日本', '韩国', '印度', '新加坡', '澳大利亚', '其他国家']);
console.log(JSON.stringify({ cases: cases.length, acroOthers: acroOthers.length, multilingualCountries: model.countryCodes.length * 3, evidenceBoundaries: 'passed', overlapAndDedup: 'passed' }));
