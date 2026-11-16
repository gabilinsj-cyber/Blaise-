import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {SCIENTIFIC_METHODS} from '../src/blaise-scientific-jobs.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=(relative)=>readFileSync(resolve(root,relative),'utf8');

test('Android scientific catalogue includes exactly the 37 actual backend methods',()=>{
  const kotlin=read('app/src/main/java/br/com/blaise/rj/BlaiseScientificCatalog.kt');
  const listed=[...kotlin.matchAll(/BlaiseScientificMethod\("([^"]+)"/g)].map(m=>m[1]);
  assert.equal(listed.length,37);
  assert.equal(new Set(listed).size,37);
  assert.deepEqual([...listed].sort(), [...SCIENTIFIC_METHODS].sort());
  assert.match(kotlin,/NÃO SÃO MEDIÇÕES NEM ALERTAS/);
});

test('Android project records 13 role specifications without claiming running agents',()=>{
  const roles=read('app/src/main/java/br/com/blaise/rj/ScientificDashboardPolicy.kt');
  const ui=read('app/src/main/java/br/com/blaise/rj/MainActivity.kt');
  assert.match(roles,/val allAgents: List<BlaiseAgentUi>/);
  assert.match(roles,/BlaiseAgentUi\(12,/);
  assert.match(roles,/BlaiseAgentUi\(13,/);
  assert.match(roles,/require\(allAgents.size == 13\)/);
  assert.match(ui,/BlaiseAgentDashboard\.allAgents\.forEach/);
  assert.match(ui,/não comprova que todos estejam executando/);
  assert.match(ui,/AdminScientificCatalogPanel\(\)/);
  assert.doesNotMatch(ui,/11 agentes cadastrados/);
});

test('private admin and debug variants have different labels and package suffixes',()=>{
  const gradle=read('app/build.gradle.kts');
  const manifest=read('app/src/main/AndroidManifest.xml');
  assert.match(gradle,/applicationIdSuffix = "\.debug"/);
  assert.match(gradle,/applicationIdSuffix = "\.admin"/);
  assert.match(gradle,/manifestPlaceholders\["appLabel"\] = "Blaise V6 RJ \(Debug\)"/);
  assert.match(gradle,/manifestPlaceholders\["appLabel"\] = "Blaise V6 RJ - Administrador"/);
  assert.match(manifest,/android:label="\$\{appLabel\}"/);
});
