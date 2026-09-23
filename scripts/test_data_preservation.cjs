const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readBundle(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window));
}

module.exports = function assertDataPreserved(root, baseline) {
  const previous = readBundle(path.join(baseline, 'web/embedded-data.js'));
  const current = readBundle(path.join(root, 'web/embedded-data.js'));
  // The only new catalog entry registers the already-existing regional model in the rules center.
  for (const key of Object.keys(previous)) {
    if (key !== 'AIHOT_RULE_CATALOG') assert.deepEqual(current[key], previous[key], key);
  }
  for (const [key, value] of Object.entries(previous.AIHOT_RULE_CATALOG)) {
    if (['version', 'verified_at', 'rule_modules', 'rule_governance'].includes(key)) continue;
    assert.deepEqual(current.AIHOT_RULE_CATALOG[key], value, `Existing business rule ${key}`);
  }
  assert.deepEqual(fs.readFileSync(path.join(root, 'scripts/run_daily.py')), fs.readFileSync(path.join(baseline, 'scripts/run_daily.py')));
};
