const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const model = require('../web/admission-model.js');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'data/latest_run.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/rule_catalog.json'), 'utf8'));
const batch = JSON.parse(fs.readFileSync(path.join(root, 'config/admission_audit.json'), 'utf8'));
if (batch.snapshot_generated_at !== payload.generated_at) throw new Error('Review belongs to a different snapshot; reassess before building.');
if (batch.reviews.length !== 30 || new Set(batch.reviews.map(row => row.id)).size !== 30) throw new Error('Expected 30 unique review records.');
const reviews = batch.reviews.map(row => {
  const item = payload.items.find(item => item.id === row.id);
  if (!item || item.tier !== 'archive') throw new Error(`Missing or no longer unselected: ${row.id}`);
  if (!model.verdicts[row.verdict]) throw new Error(`Invalid review opinion: ${row.id}`);
  return { ...row, signature: model.signature(item) };
});
const output = { ...batch, reviews, catalog_version: catalog.version };
const outFile = path.join(root, 'web/admission-reviews.js');
// Rebuilding assets must not silently stamp old opinions onto edited evidence.
if (fs.existsSync(outFile)) {
  const prior = fs.readFileSync(outFile, 'utf8');
  const match = prior.match(/^window\.AIHOT_ADMISSION_REVIEWS = ([\s\S]+);\s*$/);
  if (!match) throw new Error('Invalid prior review batch');
  const old = JSON.parse(match[1]);
  for (const row of reviews) {
    const previous = old.reviews.find(item => item.id === row.id);
    if (previous && previous.signature !== row.signature) throw new Error(`Underlying record changed; review must be reassessed: ${row.id}`);
  }
}
fs.writeFileSync(outFile, `window.AIHOT_ADMISSION_REVIEWS = ${JSON.stringify(output, null, 2).replace(/</g, '\\u003c')};\n`);
const other = payload.items.filter(item => item.tier === 'archive');
const tally = values => values.reduce((counts, key) => ({ ...counts, [key]: (counts[key] || 0) + 1 }), {});
const report = {
  checked_at: batch.checked_at, snapshot: payload.generated_at, sample_method: batch.method,
  actual_selected: payload.items.filter(model.selected).length, retained: payload.items.length, other: other.length,
  reasons: tally(other.map(item => model.explain(item, catalog).key)),
  sample_count: reviews.length, opinions: tally(reviews.map(row => row.verdict)),
  with_supplementary_evidence: reviews.filter(row => row.evidence.length).length,
  applied_changes: 0,
  snapshot_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data/latest_run.json'))).digest('hex'),
};
fs.writeFileSync(path.join(root, 'preview-checks/admission-audit-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
