/**
 * One manual Cloud Shell key check. Do not run through GitHub Actions logs
 * and never copy the secret to GitHub, ChatGPT, Android or a plaintext .env.
 *
 * Usage with the key already injected from Google Cloud Secret Manager:
 *   BLAISE_METEOBLUE_FREE_TRIAL_CONFIRMED=true \
 *   BLAISE_METEOBLUE_AUTOTOPUP_DISABLED=true \
 *   BLAISE_METEOBLUE_ONE_SHOT_TEST_APPROVED=true \
 *   node backend/scripts/check-meteoblue-free-one-shot.mjs --live --spend-one-free-request
 */
import {checkMeteoblueFreeKeyOnce}
 from '../src/rj-meteoblue-free-key-check.mjs';
if(!process.argv.includes('--live')||
   !process.argv.includes('--spend-one-free-request')){
 console.log('METEOBLUE_FREE_API_STATUS=OFFLINE_NO_NETWORK');
 process.exit(0);
}
const result=await checkMeteoblueFreeKeyOnce({env:process.env});
console.log('METEOBLUE_FREE_API_STATUS='+JSON.stringify(result));
process.exitCode=result.state==='KEY_ACCEPTED_BY_PROVIDER_SAMPLE_RECEIVED'?0:1;
