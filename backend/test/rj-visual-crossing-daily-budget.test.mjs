import test from 'node:test';
import assert from 'node:assert/strict';

import {planVisualCrossingDaily}
from '../src/rj-visual-crossing-daily-budget.mjs';

test('92 municipios em nove rodadas', () => {
  const p = planVisualCrossingDaily();
  assert.equal(p.requested, 828);
  assert.equal(p.approved, true);
});

test('bloqueia dez rodadas', () => {
  assert.equal(
    planVisualCrossingDaily({rounds: 10}).approved,
    false
  );
});

test('considera consumo anterior', () => {
  assert.equal(
    planVisualCrossingDaily({
      previouslyUsed: 100
    }).approved, false
  );
});

test('bloqueia custo superior', () => {
  assert.equal(
    planVisualCrossingDaily({
      costPerQuery: 2
    }).approved, false
  );
});

test('rejeita valores invalidos', () => {
  assert.throws(() =>
    planVisualCrossingDaily({previouslyUsed: -1})
  );
});

test('mantem coleta e publicacao desligadas', () => {
  const p = planVisualCrossingDaily();
  assert.equal(p.automaticCollection, false);
  assert.equal(p.providerContacted, false);
  assert.equal(p.publicationEnabled, false);
});
