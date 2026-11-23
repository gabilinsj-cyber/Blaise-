import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL(
 './test_rj_weatherapi_firestore_iam_preflight_readonly.py', import.meta.url));

test('WeatherAPI V2 / Firestore IAM metadata preflight passes six offline tests only',()=>{
 // The Python unit tests mock every gcloud interaction. No real project
 // access, provider call, secret read, IAM mutation, or Firestore document.
 const result=spawnSync('python3',[script],{
  encoding:'utf8',timeout:20_000,
  env:{PATH:process.env.PATH??'',PYTHONNOUSERSITE:'1'}
 });
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,
  'offline IAM unit tests failed: '+String(result.stderr??'').slice(0,1500));
 assert.match(result.stderr,/Ran 6 tests/);
 assert.match(result.stderr,/OK/);
});
