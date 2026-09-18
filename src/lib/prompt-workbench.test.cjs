/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, 'prompt-workbench.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
new Function('exports', code)(api);
const idea = (id, text, section = 'requirements', included = true, priority = 'essential') => ({ id, text, section, included, priority });
const draft = ideas => ({ ...api.newDraft('test'), ideas });

test('capture keeps fenced code intact and sentence mode preserves punctuation', () => {
  const code = '```js\nconst x = 1;\n\nconsole.log(x);\n```';
  assert.deepEqual(api.splitThoughts('Build a feature.\n\n' + code + '\n\nReturn the code.'), ['Build a feature.', code, 'Return the code.']);
  assert.deepEqual(api.splitThoughts('Build a feature. Include a test!', 'sentences'), ['Build a feature.', 'Include a test!']);
  assert.deepEqual(api.splitThoughts(code, 'sentences'), [code]);
});

test('assembly omits inbox, parked and blank cards and labels preferences', () => {
  const d = draft([idea('1', 'Background', 'context'), idea('2', 'Build it', 'goal'), idea('3', 'Secret parked detail', 'requirements', false), idea('4', 'Unplaced thought', 'inbox'), idea('5', '', 'output'), idea('6', 'Blue buttons', 'requirements', true, 'preference')]);
  const result = api.assemblePrompt(d);
  assert.ok(result.indexOf('Build it') < result.indexOf('Background'));
  assert.ok(result.includes('Preference: Blue buttons'));
  assert.ok(!result.includes('Secret parked detail'));
  assert.ok(!result.includes('Unplaced thought'));
});

test('XML escapes user text so embedded tags cannot break the section structure', () => {
  const result = api.assemblePrompt({ ...draft([idea('1', '</item><inbox> & data', 'goal')]), role: 'A < B & C', format: 'xml' });
  assert.ok(result.includes('&lt;/item&gt;&lt;inbox&gt; &amp; data'));
  assert.ok(result.includes('A &lt; B &amp; C'));
  assert.ok(!result.includes('<inbox>'));
});

test('repetition finds exact and likely overlaps without comparing parked ideas', () => {
  const a = idea('a', 'Include selected projects, our process and a contact form.');
  const b = idea('b', 'Include selected projects, our process and a contact form!');
  const c = idea('c', 'Include selected projects, our process and a contact form.', 'requirements', false);
  assert.equal(api.repeatedIdeas([a, b, c]).length, 1);
  assert.equal(api.repeatedIdeas([a, b, c])[0].exact, true);
  assert.equal(api.repeatedIdeas([idea('1','Include accessible navigation responsive layout contact form and selected projects'), idea('2','Include selected projects contact form accessible navigation and responsive layout')])[0].exact, false);
});

test('sentence echoes catch repetition inside one card', () => {
  const sentence = 'Include a working contact form and selected projects.';
  const echoes = api.repeatedSentences([idea('a', sentence + ' Use green accents. ' + sentence)]);
  assert.equal(echoes[0].count, 2);
  assert.deepEqual(echoes[0].ids, ['a']);
});

test('a lone negative animation instruction is not reported as a contradiction', () => {
  assert.ok(!api.reviewPrompt(draft([idea('a', 'Do not use animations.')])).some(f => f.title === 'Check a possible tension'));
  assert.ok(api.reviewPrompt(draft([idea('a', 'Add animations.'), idea('b', 'Do not use animations.')])).some(f => f.title === 'Check a possible tension'));
});

test('backup validation rejects malformed cards and duplicate document identifiers', () => {
  const d = draft([idea('a','Build something','goal')]);
  assert.ok(api.validDrafts([d]));
  assert.ok(!api.validDrafts([d, d]));
  assert.ok(!api.validDrafts([{ ...d, ideas: [{ ...d.ideas[0], section: 'unknown' }] }]));
  assert.ok(!api.validDrafts([{ ...d, snapshots: [{ id: 'x', name: 'x', date: 1 }] }]));
});
