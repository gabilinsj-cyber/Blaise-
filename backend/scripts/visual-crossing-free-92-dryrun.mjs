/**
 * Print the operator-only, key-free 92 municipality projection.
 * No Secret Manager, Firestore access, weather HTTP or scheduling.
 */
import {createVisualCrossing92DryRunPlan}
 from '../src/rj-visual-crossing-free-92-rollout.mjs';

const day=process.argv.find(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))||
 new Date().toISOString().slice(0,10);
const plan=createVisualCrossing92DryRunPlan({dayUtc:day});
console.log('VISUAL_CROSSING_92_DRYRUN='+JSON.stringify({
 status:plan.mode,dayUtc:plan.dayUtc,
 municipalities:plan.municipalityCount,
 refreshRounds:plan.rounds,intervalHours:plan.proposedCadenceHours,
 estimatedRecords:plan.expectedDailyRecords,
 internalDailyCap:plan.maximumInternalRecords,
 providerFreePlanAdvertised:plan.freePlanAdvertisedRecords,
 internalHeadroom:plan.internalBudgetHeadroom,
 currentConditionsTtlMinutes:30,forecastTtlHours:6,
 providerExtraCreditIndicator:'ZERO_SHOWN_MEANING_NOT_CONFIRMED',
 exposedKeyRotation:'REQUIRED_BEFORE_ENABLE',
 approved:false,automaticCollection:false,clientPublishing:false
}));
