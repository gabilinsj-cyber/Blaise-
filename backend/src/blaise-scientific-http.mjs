import geo from './rj-ibge-92-points.json' with {type:'json'};
const RJ_IBGE=new Set(geo.points.map(x=>String(x.ibge)));

/**
 * Authenticated admin scientific reports + read-only weather source memory.
 * Never a customer data endpoint. The memory callback performs no provider
 * network requests; only already cached/read-only evidence may be returned.
 */
export function createScientificHttpHandler(next, {
  canReadReports,
  store,
  readMeteorologicalMemory=null
}) {
  return async (req, res) => {
    const reports=req.url==='/v1/admin/scientific-reports';
    const memory=typeof req.url==='string'&&
      (req.url==='/v1/admin/meteorological-memory'||
       req.url.startsWith('/v1/admin/meteorological-memory?'));
    if(!reports&&!memory)return next(req,res);
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    let allowed=false;
    try{allowed=await canReadReports(req.headers?.authorization);}catch{}
    if(allowed!==true){
      res.writeHead(403);
      return res.end('{"error":"forbidden"}');
    }
    if(req.method!=='GET'){
      res.setHeader('Allow','GET');
      res.writeHead(405);
      return res.end('{"error":"method_not_allowed"}');
    }
    if(reports){
      res.writeHead(200);
      return res.end(JSON.stringify({reports:store.read()}));
    }
    // Only one optional IBGE code, and only from the 92 audited RJ points.
    // GET is authenticated BEFORE parsing, so unauthenticated callers
    // cannot probe city coverage through error messages.
    const route=/^\\/v1\\/admin\\/meteorological-memory(?:\\?ibge=(\\d{7}))?$/.exec(req.url);
    const ibge=route?.[1]??'3304557';
    if(!route||!RJ_IBGE.has(ibge)){
      res.writeHead(400);
      return res.end('{"error":"invalid_municipality"}');
    }
    if(typeof readMeteorologicalMemory!=='function'){
      res.writeHead(503);
      return res.end('{"error":"private_memory_unavailable"}');
    }
    try{
      const value=await readMeteorologicalMemory({ibge});
      if(value?.contract!=='RJ_ADMIN_METEOROLOGICAL_MEMORY_V1'||
         value.scope!=='ADMIN_ONLY'||
         value.clientPublishingEnabled!==false)
       throw Error('invalid_private_memory_contract');
      const payload=JSON.stringify(value);
      if(Buffer.byteLength(payload,'utf8')>32_000)
       throw Error('private_memory_too_large');
      res.writeHead(200);
      return res.end(payload);
    }catch{
      res.writeHead(503);
      return res.end('{"error":"private_memory_unavailable"}');
    }
  };
}
