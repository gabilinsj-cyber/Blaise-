import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';

const path = new URL('../../app/src/admin/assets/blaise-rj-knowledge/question-bank-recovered-20261006.json',import.meta.url);

test('only recovered owner prompts are represented, never 800 fictitious entries',()=>{
  const catalog=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(catalog.declaredPlannedQuestionCount,800);
  assert.equal(catalog.recoveredQuestionCount,170);
  assert.equal(catalog.missingQuestionCount,630);
  assert.equal(catalog.recoveredVerifiedAnswerCount,0);
  assert.equal(catalog.questions.length,170);
  assert.equal(catalog.colloquialVariants.length,70);
  assert.deepEqual(catalog.questions.map(x=>x.id),Array.from({length:170},(_,i)=>i+1));
  assert.deepEqual(catalog.colloquialVariants.map(x=>x.id),Array.from({length:70},(_,i)=>i+1));
  assert.ok(catalog.questions.every(x=>x.answerStatus==='REQUIRES_OFFICIAL_SOURCE_AND_TIME'));
  assert.equal(catalog.access,'ADMIN_ASSETS_ONLY');
  assert.equal(existsSync(new URL('../../app/src/main/assets/blaise-rj-knowledge/question-bank-recovered-20261006.json',import.meta.url)),false);
  assert.equal(existsSync(new URL('../../app/src/release/assets/blaise-rj-knowledge/question-bank-recovered-20261006.json',import.meta.url)),false);
});
