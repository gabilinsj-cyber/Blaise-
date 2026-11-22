import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRjVisualCrossingRules}
 from '../scripts/visual-crossing-firestore-rules-readonly.mjs';

test('read-only preflight never declares Firestore security verified by textual matches',()=>{
 const rules=`rules_version = '2';
 service cloud.firestore {
  match /databases/{database}/documents {
   match /blaise_rj_visual_crossing_free_private_weather_v1/{doc} {
    allow read, write: if false;
   }
   match /blaise_rj_vc_free_92_future_budget_v1/{doc} {
    allow read, write: if false;
   }
   match /blaise_rj_visual_crossing_free_trial_budget_v1/{doc} {
    allow read, write: if false;
   }
  }
 }`;
 const result=summarizeRjVisualCrossingRules(rules);
 assert.equal(result.paths.length,3);
 assert.ok(result.paths.every(x=>x.explicitPathMention));
 assert.equal(result.suspiciousBroadAllowHeuristic,false);
 assert.equal(result.hasRecursiveWildcard,false);
 assert.equal(result.isSecureVerdict,false);
 assert.equal(result.manualReviewRequired,true);
 assert.match(result.sourceFingerprintSha256,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(result).includes('allow read, write: if false'));
});
test('explicit private deny cannot override overlapping wildcard rule',()=>{
 const rules=`service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
    }
    match /blaise_rj_visual_crossing_free_private_weather_v1/{doc} {
      allow read: if false;
    }
  }
 }`;
 const result=summarizeRjVisualCrossingRules(rules);
 assert.equal(result.hasRecursiveWildcard,true);
 assert.equal(result.suspiciousBroadAllowHeuristic,true);
 assert.equal(result.isSecureVerdict,false);
});
test('invalid rule payload is rejected without external services',()=>{
 assert.throws(()=>summarizeRjVisualCrossingRules(null));
 assert.throws(()=>summarizeRjVisualCrossingRules('x'.repeat(250001)));
});
