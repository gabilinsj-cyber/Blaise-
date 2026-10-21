export function createScientificHttpHandler(next, {
  canReadReports,
  store
}) {
  return async (req, res) => {
    if (req.url !== '/v1/admin/scientific-reports') {
      return next(req, res);
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let allowed = false;
    try {
      allowed = await canReadReports(req.headers?.authorization);
    } catch {}


    if (allowed !== true) {
      res.writeHead(403);
      return res.end('{"error":"forbidden"}');
    }
    if (req.method !== 'GET') {
      res.setHeader



('Allow', 'GET');
      res.writeHead(405);
      return res.end('{"error":"method_not_allowed"}');
    }
    res.writeHead(200);
    res.end(JSON.stringify({reports: store.read()}));
  };
}
