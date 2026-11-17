#!/usr/bin/env node
/**
 * ONE user-authorized live test of One Call 4.0, never a scheduled collector.
 *
 * Execute only in isolated Cloud Shell worktree after confirming that the
 * OpenWeather One Call API subscription is active in the OpenWeather account.
 * Never prints a key, provider request URL or raw provider response.
 * Firestore atomic quota reservation is required before every provider call.
 */
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Firestore } from '@google-cloud/firestore';
import { createRjOpenWeatherAgent13Service } from '../src/rj-openweather-agent13-service.mjs';
import { projectAgent13CurrentEstimate } from '../src/rj-agent13-paid-http.mjs';

const PROJECT='blaise-v6-rj';
const SECRET='blaise-rj-openweather-api-key';
const VERSION='2';
const TARGET=Object.freeze({ibge:'3304557',latitude:-22.9068,longitude:-43.1729});

if (process.argv.slice(2).join(' ') !== '--single-authorized-request') {
  console.log('No call made. Usage: node scripts/validate-agent13-onecall4.mjs --single-authorized-request');
  process.exit(1);
}
const rl=createInterface({input:stdin,output:stdout});
let answer='';
try {
  answer=await rl.question(
    'Confira a assinatura One Call API no painel OpenWeather. Uma chamada pode gerar cobranca se o plano tiver esgotado a franquia. Digite CONFIRMO para permitir apenas uma consulta: '
  );
} finally {rl.close();}
if (answer.trim()!=='CONFIRMO') {
  console.log('CANCELADO: nenhuma chamada realizada.');
  process.exit(0);
}

let key;
try {
  // This process captures the secret from gcloud without sending it to stdout.
  key=execFileSync('gcloud',[
    'secrets','versions','access',VERSION,
    '--secret='+SECRET,'--project='+PROJECT,
  ],{encoding:'utf8',maxBuffer:1024,stdio:['ignore','pipe','ignore']}).trim();
  if(!/^[a-f0-9]{32}$/i.test(key)) throw new Error('invalid_key_format');
} catch {
  console.error('BLOQUEADO: sem permissao de leitura da versao 2, ou formato invalido. Chave nao exibida.');
  process.exit(1);
}

let db;
try {
  db = new Firestore({projectId: PROJECT, databaseId:'(default)'});
  const agent = createRjOpenWeatherAgent13Service({
    env:{
      BLAISE_OPENWEATHER_AGENT13_ENABLED:'true',
      BLAISE_OPENWEATHER_ONECALL4_SUBSCRIPTION_APPROVED:'true',
      BLAISE_OPENWEATHER_API_KEY:key,
    },
    database:db,
  });
  key=undefined; // credential retained only inside the configured closure
  if(!agent.configured){
    console.log('BLOQUEADO: Firestore ou integracao nao configurados.');
    process.exitCode=1;
  } else {
    const now=Date.now();
    const data=await agent.collect({target:TARGET,now});
    const projected=projectAgent13CurrentEstimate(data,TARGET.ibge,now);
    if(!projected){
      console.log('SEM DADO ATUAL VALIDO: '+String(data.reason??'fonte indisponivel').replace(/[^A-Z0-9_]/g,'').slice(0,64));
      if(data.diagnostic&&
          ['PROVIDER_CURRENT_VALUE_STALE','PROVIDER_CURRENT_VALUE_FUTURE'].includes(data.reason)){
        const d=data.diagnostic;
        console.log('DIAGNOSTICO_UTC: '+JSON.stringify({
          sourceValidAt:d.sourceValidAt,checkedAt:d.checkedAt,
          ...(Number.isSafeInteger(d.ageSeconds)?{ageSeconds:d.ageSeconds}:{}),
          ...(Number.isSafeInteger(d.offsetSeconds)?{futureSeconds:d.offsetSeconds}:{})
        }));
      }
      console.log('Nenhum dado meteorologico publicado. Uma nova chamada exige autorizacao separada.');
      process.exitCode=1;
    }else{
      console.log(JSON.stringify({
        status:'ESTIMATIVA_VALIDA_ATE_12_MIN',fonte:projected.source,
        natureza:projected.nature,
        municipioIbge:projected.ibge,
        validAt:projected.validAt,
        retrievedAt:projected.retrievedAt,
        temperatureC:projected.values.temperatureC,
        rainMm1h:projected.values.rainMm1h,
        usage:'Uma chamada no maximo, mediante reserva atomica no Firestore',
      }));
    }
  }
}catch {
  console.error('FALHA SEGURA: sem dado publicado; confira ADC/IAM/Firestore e assinatura. Credenciais ocultas.');
  process.exitCode=1;
} finally {
  await db?.terminate?.().catch(()=>{});
}
