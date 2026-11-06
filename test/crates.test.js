import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCrateName,
  suggestCrateName,
  addIds,
  moveItem,
  dropIndex,
  resolveCrate,
  formatTotalDuration,
  sanitiseCrates,
} from '../src/lib/crates.js';

const crates = [
  { id: 'a', name: 'Peak time' },
  { id: 'b', name: 'New crate' },
];

test('validateCrateName requires a name, a length limit and uniqueness (case-insensitive)', () => {
  assert.equal(validateCrateName('  ', crates), 'Give the crate a name.');
  assert.match(validateCrateName('x'.repeat(61), crates), /60 characters/);
  assert.equal(validateCrateName('peak TIME ', crates), 'You already have a crate with that name.');
  assert.equal(validateCrateName('Peak time', crates, 'a'), '', 'renaming a crate to its own name is fine');
  assert.equal(validateCrateName('Warm up', crates), '');
});

test('suggestCrateName picks the first free numbered name', () => {
  assert.equal(suggestCrateName(crates), 'New crate 2');
  assert.equal(suggestCrateName(crates, 'Opening set'), 'Opening set');
  assert.equal(suggestCrateName([...crates, { id: 'c', name: 'new crate 2' }]), 'New crate 3');
});

test('addIds appends only new ids, in order, and reports how many', () => {
  const list = ['1', '2'];
  assert.deepEqual(addIds(list, ['2', '3', '3', '4']), { list: ['1', '2', '3', '4'], added: 2 });
  const same = addIds(list, ['1']);
  assert.equal(same.added, 0);
  assert.equal(same.list, list, 'unchanged list keeps its identity');
});

test('moveItem moves to the final index and clamps', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b'], 0, 9), ['b', 'a']);
});

test('dropIndex maps a drop before/after a row to the final index', () => {
  // dragging row 0 to just after row 2 → ends at index 2
  assert.equal(dropIndex(0, 2, true), 2);
  // dragging row 0 to just before row 2 → ends at index 1
  assert.equal(dropIndex(0, 2, false), 1);
  // dragging row 3 to before row 1 → index 1
  assert.equal(dropIndex(3, 1, false), 1);
  // dropping a row onto its own bottom half is a no-op
  assert.equal(dropIndex(2, 2, true), 2);
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, dropIndex(0, 2, true)), ['b', 'c', 'a', 'd']);
});

test('resolveCrate keeps crate order and counts missing tracks', () => {
  const byId = new Map([
    ['1', { id: '1' }],
    ['3', { id: '3' }],
  ]);
  const { rows, missing } = resolveCrate(['3', '2', '1'], byId);
  assert.deepEqual(rows.map((t) => t.id), ['3', '1']);
  assert.equal(missing, 1);
});

test('formatTotalDuration', () => {
  assert.equal(formatTotalDuration([{ durationMs: 30 * 60000 }, { durationMs: 8 * 60000 }]), '38 min');
  assert.equal(formatTotalDuration([{ durationMs: 72 * 60000 }, {}]), '1 h 12 min');
});

test('sanitiseCrates drops malformed entries and duplicate ids', () => {
  const out = sanitiseCrates({
    crates: [{ id: 'a', name: 'Ok', trackIds: ['1', '1', 2, '3'] }, { name: 'no id' }, null],
  });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].trackIds, ['1', '3']);
  assert.deepEqual(sanitiseCrates(null), []);
});
