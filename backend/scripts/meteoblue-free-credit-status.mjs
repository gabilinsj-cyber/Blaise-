/**
 * Operator-only budget report; does NOT call meteoblue or read API keys.
 * Prints Firestore reservation accounting only, NOT provider balance.
 */
import {createRjMeteoblueFreeFirestoreStore}
 from '../src/rj-meteoblue-free-firestore-store.mjs';
if(!process.argv.includes('--read-firestore-budget')){
 console.log('METEOBLUE_CREDIT_LEDGER=OFFLINE_NO_DATABASE_READ');
 process.exit(0);
}
const project='blaise-v6-rj';
try{
 const {Firestore}=await import('@google-cloud/firestore');
 const store=createRjMeteoblueFreeFirestoreStore({
  db:new Firestore({projectId:project,databaseId:'(default)'})
 });
 console.log('METEOBLUE_LOCAL_BUDGET='+JSON.stringify(
  await store.readLocalBudgetStatus()));
}catch{
 console.log('METEOBLUE_LOCAL_BUDGET=FIRESTORE_UNAVAILABLE');
 process.exitCode=1;
}
