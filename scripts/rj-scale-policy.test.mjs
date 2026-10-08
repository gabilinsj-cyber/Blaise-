import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateScaleReadiness} from './rj-scale-policy.mjs';

const now=new Date('2026-10-08T20:00:00.000Z');
const observedAt='2026-10-08T19:59:00Z';
const check=(count,lastReportedMilestone=0)=>evaluateScaleReadiness({activeSubscribers:count,observedAt,now,lastReportedMilestone});

test('missing verified metrics do not assume any subscriber milestone',()=>{
 assert.equal(evaluateScaleReadiness({now}).status,'NOT_CONFIGURED');
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,now}).status,'NOT_CONFIGURED');
});
test('early review, then a new report at each 500k increment',()=>{
 assert.equal(check(0).status,'BELOW_THRESHOLD');
 assert.equal(check(399999).status,'BELOW_THRESHOLD');
 assert.equal(check(400000).status,'EARLY_REVIEW_400K');
 assert.equal(check(499999).status,'EARLY_REVIEW_400K');
 for(const count of [500000,1000000,1500000,2000000,2500000,3000000,10000000]) {
   const prev=count-500000, report=check(count,prev);
   assert.equal(report.status,'MILESTONE_REPORT_DUE');
   assert.deepEqual(report.pendingMilestones,[count]);
   assert.equal(report.nextMilestone,count+500000);
 }
});
test('do not resend when already reported; catch up missed markers safely',()=>{
 assert.equal(check(500000,500000).status,'MILESTONE_ALREADY_REPORTED');
 assert.deepEqual(check(2000000,500000).pendingMilestones,[1000000,1500000,2000000]);
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,observedAt,now}).status,'REPORT_HISTORY_NOT_CONFIGURED');
});
test('invalid stale and future data cannot trigger report',()=>{
 assert.equal(check(-1).status,'INVALID_INPUT');
 assert.equal(check('500000.1').status,'INVALID_INPUT');
 assert.equal(check('500000extra').status,'INVALID_INPUT');
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,observedAt:'2026-10-06T20:00:00Z',now,lastReportedMilestone:0}).status,'STALE_METRIC');
 assert.equal(evaluateScaleReadiness({activeSubscribers:500000,observedAt:'2026-10-08T20:03:00Z',now,lastReportedMilestone:0}).status,'INVALID_INPUT');
 assert.equal(check(500000,1).status,'INVALID_INPUT');
 assert.equal(check(500000,1000000).status,'INVALID_INPUT');
});
test('verdict is advisory; no purchase or deployment authorization',()=>{
 assert.equal(check(500000).action,'RESEARCH_SECURITY_CAPACITY_STORAGE_QUOTE_USD_EUR_AND_REQUEST_OWNER_APPROVAL');
 assert.ok(!JSON.stringify(check(500000)).includes('PURCHASE_AUTHORIZED'));
});
