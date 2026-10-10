import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjAgentAuditPlan,prepareRjSecurityMilestonePlan} from '../src/rj-agent-audit.mjs';

test('hourly Agent9 review is not misrepresented as deployed live source monitoring',()=>{
  const plan=createRjAgentAuditPlan({mode:'HOURLY_AGENT9',at:Date.parse('2026-10-10T16:00:00Z')});
  assert.equal(plan.agentNumber,9);
  assert.equal(plan.auditScope,'STATIC_CHECKLIST_ONLY');
  assert.equal(plan.autoFix,false);
  assert.equal(plan.autoDeploy,false);
  assert.equal(plan.autoPurchase,false);
  assert.match(plan.operationalStatus,/NEEDS_REAL_METRICS/);
});
test('01h Agent10 checklist covers 500k report, infrastructure and Google Play access',()=>{
  const plan=createRjAgentAuditPlan({mode:'DEEP_AGENT10',at:Date.parse('2026-10-10T04:00:00Z')});
  assert.equal(plan.agentNumber,10);
  assert.equal(plan.targetTimezone,'America/Sao_Paulo');
  assert.equal(plan.softwareUpdateReviewDay,20);
  assert.ok(plan.checkItems.includes('SUBSCRIBER_MILESTONE_500K'));
  assert.ok(plan.checkItems.includes('CLOUD_RUN_CONCURRENCY_COLD_START'));
  assert.equal(plan.needsHumanApproval,true);
  assert.equal(plan.supplierPrices,'NOT_VERIFIED');
  assert.throws(()=>createRjAgentAuditPlan({mode:'DEEP_AGENT10',observedRuntimeMetrics:{active:1}}));
});
test('reports are blocked without authenticated evidence and never trigger a purchase',()=>{
  const blocked=prepareRjSecurityMilestonePlan({verifiedActiveSubscribers:1_000_000});
  assert.deepEqual(blocked.milestonesNeedingReview,[500_000,1_000_000]);
  assert.equal(blocked.reportDelivery,'BLOCKED_NO_AUTHENTICATED_SUBSCRIBER_EVIDENCE');
  assert.equal(blocked.notificationSent,false);
  const verified=prepareRjSecurityMilestonePlan({verifiedActiveSubscribers:1_500_000,
    previousReportedMilestone:1_000_000,
    activeMetricsEvidence:{status:'BACKEND_VERIFIED',referenceId:'billing-metrics-audit-id'}});
  assert.deepEqual(verified.milestonesNeedingReview,[1_500_000]);
  assert.equal(verified.reportDelivery,'READY_FOR_HUMAN_REPORT_REVIEW');
  assert.equal(verified.purchasesExecuted,false);
  assert.equal(verified.notificationSent,false);
});
