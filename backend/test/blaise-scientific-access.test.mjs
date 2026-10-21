import test from 'node:test';
import {strict as a} from 'node:assert';
import {createScientificAccess as make} from '../src/blaise-scientific-access.mjs';
test('somente UID autorizado acessa',async()=>{
const verifyIdentity=async t=>t;
const access=make({verifyIdentity,allowedUids:['admin']});
a.equal(await access('admin'),true);
a.equal(await access('cliente'),false);
a.equal(await access(),false);
a.equal(await make({verifyIdentity})('admin'),false);
const denied=make({
verifyIdentity:async()=>{throw Error('invalid');},
allowedUids:['admin']
});
a.equal(await denied('admin'),false);
});
