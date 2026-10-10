import { BLAISE_RJ_AGENTS, subscriberScaleReview } from './rj-agent-registry.mjs';

/**
 * Audit PLAN, not a live device/security scan. Runs without privileged tokens
 * and cannot repair source code, buy services or send unsolicited reports.
 * A production audit needs actual CI, SLO, Cloud Run, IAM, Play and metrics.
 */
export function createRjAgentAuditPlan({
  mode='HOURLY_AGENT9', at=Date.now(), observedRuntimeMetrics=null,
}={}) {
  if(!['HOURLY_AGENT9','DEEP_AGENT10'].includes(mode))throw TypeError('rj_invalid_agent_audit_mode');
  if(!Number.isFinite(at))throw TypeError('rj_invalid_agent_audit_clock');
  const agentNumber=mode==='HOURLY_AGENT9'?9:10;
  const agent=BLAISE_RJ_AGENTS[agentNumber-1];
  const checks=mode==='HOURLY_AGENT9'
    ? ['CI_ERRORS_AND_TEST_REGRESSIONS','OFFICIAL_SOURCE_DOMAIN_AND_FRESHNESS',
      'ANDROID_UI_CONTRACTS','ERROR_RATES_AND_AVAILABILITY','SECURITY_PATCH_READINESS']
    : ['IAM_LEAST_PRIVILEGE','CLOUD_ARMOR_RATE_LIMIT_AND_ABUSE',
      'FIREBASE_ACCOUNT_BOUND_BILLING','CLOUD_RUN_CONCURRENCY_COLD_START',
      'STORAGE_BACKUPS_ENCRYPTION','DEPENDENCY_AND_SECRETS_SCANS',
      'INCIDENT_RESPONSE','MONTHLY_UPDATE_REVIEW_DAY20',
      'SUBSCRIBER_MILESTONE_500K'];
  // Do not let a caller pass unverified metric counts or invented vendor prices.
  if(observedRuntimeMetrics!==null)throw TypeError('runtime_metrics_require_authenticated_provider_connector');
  return Object.freeze({
    project:'Blaise V6 RJ',agentNumber,agentName:agent.name,
    checkedAt:new Date(at).toISOString(),
    auditScope:'STATIC_CHECKLIST_ONLY',
    runtimeSignalStatus:'UNAVAILABLE_NO_AUTHENTICATED_LIVE_CONNECTOR',
    checkItems:Object.freeze(checks),
    operationalStatus:'NEEDS_REAL_METRICS_AND_DEPLOYED_JOB',
    autoFix:false,autoMerge:false,autoDeploy:false,
    autoPurchase:false,needsHumanApproval:true,
    supplierPrices:'NOT_VERIFIED',
    purchasesExecuted:0,
    targetTimezone:'America/Sao_Paulo',
    softwareUpdateReviewDay:20,
  });
}
export function prepareRjSecurityMilestonePlan({
  verifiedActiveSubscribers, previousReportedMilestone=0,
  activeMetricsEvidence=null,
}={}) {
  // A subscriber count is not proof until an authenticated billing backend
  // attests it; review requirements are still calculated locally.
  const milestones=subscriberScaleReview({verifiedActiveSubscribers,previousReportedMilestone});
  if(activeMetricsEvidence?.status!=='BACKEND_VERIFIED' || !activeMetricsEvidence?.referenceId) {
    return Object.freeze({
      ...milestones,
      reportDelivery:'BLOCKED_NO_AUTHENTICATED_SUBSCRIBER_EVIDENCE',
      notificationSent:false,
      procurementStatus:'REQUIRES_HUMAN_APPROVAL',
    });
  }
  return Object.freeze({
    ...milestones,
    reportDelivery:milestones.recommendedReview?'READY_FOR_HUMAN_REPORT_REVIEW':'NO_NEW_MILESTONE',
    evidenceReference:activeMetricsEvidence.referenceId,
    notificationSent:false,
    procurementStatus:'REQUIRES_HUMAN_APPROVAL',
  });
}
