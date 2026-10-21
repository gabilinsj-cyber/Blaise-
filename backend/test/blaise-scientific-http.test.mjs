import test from 'node:test';
import {strict as a} from 'node:assert';
import {createScientificHttpHandler as make} from '../src/blaise-scientific-http.mjs';
test('negado nao le relatorios',async()=>{
let n=0;
const h=make(()=>{},{
canReadReports:async()=>false,
store:{read(){n++;return [];}}
});
const r={setHeader(){},writeHead(c){this.c=c},end(){}};
await h({
url:'/v1/admin/scientific-reports',
method:'GET',headers:{}
},r);
a.equal(r.c,403);
a.equal(n,0);
});
