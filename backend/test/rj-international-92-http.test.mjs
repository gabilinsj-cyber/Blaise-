import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaidDashboardDataHttpHandler} from '../src/dashboard-data-http.mjs';
import {RJ_INTERNATIONAL_92_PATH,RJ_INTERNATIONAL_92_CONTRACT} from '../src/rj-international-92-snapshot.mjs';

const now=Date.parse('2026-11-16T15:00:00Z');
const config={
 packageName:'br.com.blaise.rj',monthlyProductId:'monthly.test',annualProductId:'annual.test',
 allowTestPurchases:false,
};
const payload={packageName:'br.com.blaise.rj',purchaseToken:'token-for-test',
 productIds:['monthly.test']};
const verifiedRow={
 ibge:'3304557',latitude:-23.0738,longitude:-43.1987,
 status:'AVAILABLE_PROVIDER_CURRENT_ESTIMATE',
 type:'PROVIDER_MODELED_CURRENT_ESTIMATE_NOT_STATION_MEASUREMENT',
 sourceId:'OPENWEATHER_ONECALL4_CURRENT',officialObservation:false,officialAlert:false,
 radarFrame:false,attributionRequired:true,originalMapPreserved:true,
 validAt:'2026-11-16T14:55:00.000Z',retrievedAt:'2026-11-16T14:56:00.000Z',
 values:{temperatureC:25,providerFeelsLikeC:28,relativeHumidityPct:84},
};
async function runEndpoint({validPurchase=true,enabled=true,rows=[verifiedRow]}={}) {
 let readCount=0;
 const gateway={
   async getSubscription(){return validPurchase ? {
     subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
     acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
     lineItems:[{productId:'monthly.test',expiryTime:'2099-01-01T00:00:00Z'}],
   }:null;},
   async acknowledge(){return true;},
 };
 const handler=createPaidDashboardDataHttpHandler((_req,res)=>{res.statusCode=404;res.end();},{
   config,gateway,
   sourceWorker:{status(){return {enabled:false,started:false}},readSource(){return null}},
   clock:()=>now,
   internationalRowsReader:async()=>{readCount++;return rows},
   internationalLicenseConfirmed:enabled,
 });
 const server=http.createServer(handler);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try {
   const url='http://127.0.0.1:'+server.address().port+RJ_INTERNATIONAL_92_PATH;
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify(payload)});
   return {status:response.status,body:await response.json(),readCount};
 } finally {await new Promise(resolve=>server.close(resolve))}
}
test('paid user receives only verified current international municipalities',async()=>{
 const r=await runEndpoint();
 assert.equal(r.status,200);
 assert.equal(r.body.contract,RJ_INTERNATIONAL_92_CONTRACT);
 assert.equal(r.body.currentMunicipalities,1);
 assert.equal(r.body.municipalities.length,92);
 assert.equal(r.readCount,1);
 assert.equal(r.body.municipalities.find(v=>v.ibge==='3304557').weather.values.temperatureC,25);
 assert.equal(r.body.radarAvailable,false);
});
test('unpaid client gets 403 and does not read international Firestore cache',async()=>{
 const r=await runEndpoint({validPurchase:false});
 assert.equal(r.status,403);assert.equal(r.readCount,0);
});
test('unlicensed or disabled release never publishes international values',async()=>{
 const r=await runEndpoint({enabled:false});
 assert.equal(r.status,503);assert.equal(r.readCount,0);
});
test('valid purchase, no source data: 92 cities all honestly empty',async()=>{
 const r=await runEndpoint({rows:[]});
 assert.equal(r.status,200);
 assert.equal(r.body.currentMunicipalities,0);
 assert.equal(r.body.municipalities.length,92);
 assert.ok(r.body.municipalities.every(v=>v.weather===null));
});
