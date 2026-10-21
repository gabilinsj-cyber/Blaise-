import test from 'node:test';
import {strict as a} from 'node:assert';
import {createScientificStore} from '../src/blaise-scientific-store.mjs';

test('relatorios expiram em 24h e stop bloqueia gravacoes',()=>{
let t=0;
const s=createScientificStore({now:()=>t});
try {
s.add({teste:1});
t=86400000-1;
a.equal(s.read().length,1);
t=86400000;
a.equal(s.read().length,0);
s.add({teste:2});
s.stop();
s.add({teste:3});
a.equal(s.read().length,0);
} finally { s.stop(); }
});
