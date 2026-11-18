/**
 * Purely offline audit of a previously saved real provider JSON response.
 * Reads a LOCAL file; makes ZERO network calls, ZERO Firestore reservations,
 * ZERO API-credit spends. Does not display raw payload, API key or values.
 * Only a file saved by the owner from a genuine prior API response counts as
 * real-world evidence; test fixtures do not.
 *
 * Usage: node scripts/meteoblue-free-validate-saved-json.mjs /safe/path/response.json
 */
import {readFile,stat} from 'node:fs/promises';
import {parseMeteoblueBasic6h} from '../src/rj-meteoblue-basic6h-parse.mjs';
import {prepareMeteoblueFreeRjProbe} from '../src/rj-meteoblue-free-connection.mjs';

const output=(x)=>console.log('METEOBLUE_SAVED_RESPONSE_AUDIT='+JSON.stringify(x));
const path=process.argv[2];
if(!path||process.argv.length!==3){
 output({status:'NO_LOCAL_RESPONSE_FILE',providerContacted:false,creditsReserved:0});
 process.exitCode=2;
}else{
 try{
  const file=await stat(path);
  if(!file.isFile()||file.size<20||file.size>900_000)throw Error('FILE_NOT_APPROPRIATE');
  const raw=JSON.parse(await readFile(path,'utf8'));
  const target=prepareMeteoblueFreeRjProbe({
    ibge:'3304557',freeTrialConfirmed:true,autoTopUpDisabled:true,
    operatorApprovedSingleCreditUse:true,serverEnvironment:true
  }).targetCoordinates;
  if(!target)throw Error('POINT_UNAVAILABLE');
  const r=parseMeteoblueBasic6h({
    payload:raw,ibge:'3304557',
    latitude:target.lat,longitude:target.lon,nowMs:Date.now()
  });
  const fields=r.values??[];
  output({
   status:r.status,
   reason:r.reason??null,
   origin:'OPERATOR_SUPPLIED_LOCAL_FILE_NOT_INDEPENDENTLY_AUTHENTICATED',
   providerContacted:false,creditsReserved:0,
   privateAuditReady:r.auditReadyForPrivateReview===true,
   validForecastSlots:r.validTimes?.length??0,
   metadataRunVerified:r.metadataRunVerified??false,
   unitMetadataVerified:r.unitMetadataVerified??false,
   sourceCoordinatesVerified:r.sourceCoordinatesVerified??false,
   sevenFieldsPresent:r.completeFieldCoverage??false,
   fieldCoverage:r.coverage??null,
   nonNullNumericCounts:Object.fromEntries(fields.map(f=>[
    f.field,f.values.filter(v=>typeof v==='number'&&Number.isFinite(v)).length
   ])),
   auditBlockers:r.auditBlockers??[],
   publishedToSubscribers:false,officialObservation:false
  });
  if(r.status!=='FORECAST_PARSED_PRIVATE_STAGING'||
     r.auditReadyForPrivateReview!==true)process.exitCode=1;
 }catch{
  output({status:'FILE_INVALID_OR_UNREADABLE',providerContacted:false,creditsReserved:0});
  process.exitCode=1;
 }
}
