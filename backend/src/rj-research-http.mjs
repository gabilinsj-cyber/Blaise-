/**
 * On-demand research POST endpoint. Disabled until the operator wires
 * subscription authorization, abuse throttling, source licensing and an
 * independently verified research/synthesis provider.
 * Never reads raw audio or stores question history.
 */
export const RJ_RESEARCH_PATH='/v1/public/assistant/research';
export const RJ_RESEARCH_MAX_BODY=3500;
const GEOGRAPHIES=new Set(['RIO_DE_JANEIRO','SUDESTE_BRASIL','ATLANTICO_SUL','GLOBAL_CLIMA_RELEVANTE_RJ']);
function respond(res,status,body) {
  res.statusCode=status;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type']??''))
    throw new TypeError('content_type');
  if(Number(req.headers?.['content-length'])>RJ_RESEARCH_MAX_BODY)
    throw new TypeError('too_large');
  let bytes=0,chunks=[];
  for await(const piece of req) {
    bytes+=piece.length;
    if(bytes>RJ_RESEARCH_MAX_BODY)throw new TypeError('too_large');
    chunks.push(piece);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createRjResearchHttpHandler(next, {
  enabled=false,agent=null,verifySubscriber=null,rateLimit=null,
  approveSynthesis=null,clock=Date.now
}={}) {
  if(typeof next!=='function'||typeof enabled!=='boolean'||
    typeof clock!=='function'||(agent!==null&&typeof agent.answer!=='function'))
    throw new TypeError('invalid_research_http_handler');
  return async(req,res)=>{
    if(req.url?.split('?',1)[0]!==RJ_RESEARCH_PATH)return next(req,res);
    if(req.method!=='POST'){respond(res,405,{error:'method_not_allowed'});return;}
    if(!enabled||agent?.enabled!==true||typeof verifySubscriber!=='function'
      ||typeof rateLimit!=='function'||typeof approveSynthesis!=='function') {
      respond(res,503,{error:'authorized_research_provider_not_configured'});return;
    }
    const now=clock();
    if(!Number.isSafeInteger(now)||now<0){respond(res,503,{error:'research_clock_unavailable'});return;}
    try {
      const identity=await verifySubscriber(req);
      if(typeof identity?.subject!=='string'||identity.subject.length<3
        ||identity.isActive!==true){respond(res,403,{error:'subscription_required'});return;}
      if(await rateLimit({subject:identity.subject,at:now})!==true) {
        respond(res,429,{error:'research_rate_limit'});return;
      }
      const query=await readJson(req);
      if(!query||typeof query.question!=='string'
        ||query.question.trim().length<4||query.question.length>600
        ||!GEOGRAPHIES.has(query.geography)
        ||query.timeZone!=='America/Sao_Paulo'){
        respond(res,400,{error:'invalid_research_question'});return;
      }
      const askedAt=Date.parse(query.requestedAt);
      if(!Number.isFinite(askedAt)||Math.abs(now-askedAt)>300000) {
        respond(res,400,{error:'invalid_question_timestamp'});return;
      }
      const research=await agent.answer({
        question:query.question,geography:query.geography
      });
      if(research?.status!=='EVIDENCE_GROUNDED_DRAFT'
        ||!Array.isArray(research.evidence)||research.evidence.length<1) {
        respond(res,503,{error:'no_verified_live_research'});return;
      }
      // Model-generated citation IDs alone cannot guarantee factual support.
      // A separately deployed semantic verifier must approve every claim.
      if(await approveSynthesis({research,asOf:now})!==true) {
        respond(res,503,{error:'research_not_semantically_verified'});return;
      }
      respond(res,200,{
        contract:research.contract,status:'ANSWER_WITH_CITATIONS',
        geography:research.geography,asOf:research.asOf,
        answer:research.answer,evidence:research.evidence,
        officialAlert:false
      });
    } catch {
      respond(res,503,{error:'research_unavailable'});
    }
  };
}
