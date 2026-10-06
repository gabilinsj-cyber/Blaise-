import test from 'node:test';import assert from 'node:assert/strict';
import {reviewBlaiseEvidence,reviewNumericCandidate} from '../src/blaise-source-review.mjs';
const now=Date.parse('2026-10-06T20:00:00Z');
const alert={sourceId:'official',independentSourceId:'official',sourceUrl:'https://example.org',scopeId:'RJ:1',phenomenon:'storm',level:5,validFrom:'2026-10-06T19:00:00Z',validUntil:'2026-10-06T21:00:00Z'};
test('official level5 remains intact alongside Blaise4',()=>{const r=reviewBlaiseEvidence({officialAlerts:[alert],analyses:[{...alert,sourceId:'vector',level:4}],now});assert.equal(r.officialAlerts[0].level,5);assert.equal(r.analyses[0].level,4);assert.equal(r.discrepancies[0].mayDiscardOfficialAlert,false);});
test('expired official alert excluded by validity, not disagreement',()=>{const r=reviewBlaiseEvidence({officialAlerts:[{...alert,validUntil:'2026-10-06T19:30:00Z'}],now});assert.equal(r.officialAlerts.length,0);assert.equal(r.excluded[0].reason,'expired');});
const reading=(id,value)=>({sourceId:id,independentSourceId:id,sourceUrl:'https://example.org',scopeId:'station:1',variable:'temperature',unit:'C',nature:'OBSERVADO',value,observedAt:'2026-10-06T19:59:50Z'});
const opts={now,maxAgeMs:60000,maxSkewMs:10000,tolerance:2};
test('two comparable independent observations quarantine numeric outlier, not prove wrong',()=>{const r=reviewNumericCandidate(reading('a',40),[reading('b',25),reading('c',26)],opts);assert.equal(r.state,'QUARANTINED_FOR_REVIEW');assert.equal(r.provenWrong,false);assert.equal(r.officialAlertAffected,false);});
test('different locations or duplicate origins cannot reject candidate',()=>{for(const peers of [[reading('b',25),{...reading('c',25),scopeId:'Niteroi'}],[reading('b',25),{...reading('c',25),independentSourceId:'b'}]])assert.equal(reviewNumericCandidate(reading('a',40),peers,opts).state,'INSUFFICIENT_EVIDENCE_TO_REJECT');});

import {category5DeliveryGate} from '../src/blaise-source-review.mjs';
test('single official level5 remains silent despite Blaise5',()=>{assert.equal(category5DeliveryGate({officialAlerts:[alert],analyses:[alert],scopeId:alert.scopeId,phenomenon:alert.phenomenon,now}).automaticVoice,false);});
test('two independent official5 plus Blaise5 allow automatic delivery',()=>{const r=category5DeliveryGate({officialAlerts:[alert,{...alert,sourceId:'second',independentSourceId:'second'}],analyses:[alert],scopeId:alert.scopeId,phenomenon:alert.phenomenon,now});assert.equal(r.siren,true);assert.equal(r.officialAlertRemainsVisible,true);});
test('Blaise4 and syndicated origin cannot unlock automatic level5',()=>{assert.equal(category5DeliveryGate({officialAlerts:[alert,{...alert,sourceId:'copy'}],analyses:[{...alert,level:4}],scopeId:alert.scopeId,phenomenon:alert.phenomenon,now}).vibration,false);});
