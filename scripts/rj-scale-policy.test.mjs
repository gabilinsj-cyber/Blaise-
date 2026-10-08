import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateScaleReadiness} from './rj-scale-policy.mjs';

const now=new Date('2026-10-08T20:00:00.000Z');
const observedAt='2026-10-08T19:59:00Z';
const check=(count)=>evaluateScaleReadiness({activeSubscribers:count,observedAt,now});

test('missing metrics do not assume 500k subscribers',()=>{
 assert.equal(evaluateScaleReadiness({now}).status,'NOT_CONFIGURED');
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,now}).status,'NOT_CONFIGURED');
});
test('400k early trigger and 500k review trigger',()=>{
 assert.equal(check(0).status,'BELOW_THRESHOLD');
 assert.equal(check(399999).status,'BELOW_THRESHOLD');
 assert.equal(check(400000).status,'EARLY_REVIEW_400K');
 assert.equal(check(499999).status,'EARLY_REVIEW_400K');
 assert.equal(check(500000).status,'REVIEW_REQUIRED_500K');
 assert.equal(check(1500000).status,'REVIEW_REQUIRED_500K');
});
test('invalid, stale and future counts cannot trigger a review',()=>{
 assert.equal(check(-1).status,'INVALID_INPUT');
 assert.equal(check('500000.1').status,'INVALID_INPUT');
 assert.equal(check('500000extra').status,'INVALID_INPUT');
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,observedAt:'2026-10-06T20:00:00Z',now}).status,'STALE_METRIC');
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,observedAt:'2026-10-08T20:03:00Z',now}).status,'INVALID_INPUT');
});
test('verdict is advisory, never a purchase or deployment',()=>{
 assert.equal(check(500000).action,'CAPACITY_SECURITY_STORAGE_AND_COST_REVIEW');
 assert.ok(!JSON.stringify(check(500000)).includes('PURCHASE_AUTHORIZED'));
});
