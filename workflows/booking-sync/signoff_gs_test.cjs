// Runs Signoff.gs in Node with a tiny Utilities stub. Usage: node signoff_gs_test.js
const fs = require('fs'); const path = require('path'); const vm = require('vm'); const assert = require('assert');
const Utilities = { formatDate: (d, tz, _f) => {
  const s = d.toLocaleString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return s.replace(/,(?= \d{4})/, ',').replace(/, (\d{1,2}:)/, ' $1'); } };
const ctx = { Utilities }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Signoff.gs'), 'utf8'), ctx);
const out = ctx.automationSignoff_({ platform: 'Google Apps Script', name: 'N', purpose: 'P.', cadence: 'C', link: 'L' }, new Date('2026-11-03T04:30:00Z'));
const lines = out.split('\n');
assert.deepStrictEqual(lines.map(l => l.split(':')[0]), ['--', 'Platform', 'Automation', 'Purpose', 'Cadence', 'Last run', 'Link']);
assert.strictEqual(lines[5], 'Last run: Nov 2, 2026 8:30 PM PT');
assert.throws(() => ctx.automationSignoff_({ platform: '' }));
console.log('Signoff.gs tests passed');
