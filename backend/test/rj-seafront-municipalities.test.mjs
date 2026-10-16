import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RJ_SEAFRONT_CONTRACT,
  RJ_SEAFRONT_MUNICIPALITIES,
  RjSeafrontError,
  classifyRjSeaFacingMunicipality,
  isRjSeaFacingMunicipality,
} from '../src/rj-seafront-municipalities.mjs';
import { findRjMunicipality } from '../src/rio-municipalities.mjs';

test('IBGE RJ seafront catalog contains exactly 25 canonical municipalities', () => {
  assert.equal(RJ_SEAFRONT_MUNICIPALITIES.length, 25);
  assert.equal(new Set(RJ_SEAFRONT_MUNICIPALITIES.map((city) => city.ibge)).size, 25);
  assert.equal(new Set(RJ_SEAFRONT_MUNICIPALITIES.map((city) => city.name)).size, 25);

  for (const city of RJ_SEAFRONT_MUNICIPALITIES) {
    assert.deepEqual(findRjMunicipality(city.ibge), city);
  }
});

test('classifies Rio, Niterói and São Gonçalo as IBGE sea-facing municipalities', () => {
  for (const ibge of ['3304557', '3303302', '3304904']) {
    const result = classifyRjSeaFacingMunicipality(ibge);
    assert.equal(result.seaFacing, true);
    assert.equal(result.sourceEdition, '2024');
    assert.equal(result.contract, RJ_SEAFRONT_CONTRACT);
  }
});

test('keeps known RJ municipalities outside the IBGE seafront catalog false', () => {
  for (const ibge of ['3305109', '3301876', '3305208']) {
    assert.equal(isRjSeaFacingMunicipality(ibge), false);
  }
});

test('fails closed on malformed or unknown RJ-looking IBGE codes', () => {
  assert.throws(
    () => classifyRjSeaFacingMunicipality('33'),
    (error) => error instanceof RjSeafrontError && error.code === 'rj_seafront_ibge_invalid',
  );
  assert.throws(
    () => classifyRjSeaFacingMunicipality('3399999'),
    (error) => error instanceof RjSeafrontError && error.code === 'rj_seafront_unknown_rj_municipality',
  );
});
