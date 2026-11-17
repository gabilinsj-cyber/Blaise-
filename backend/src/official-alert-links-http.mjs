// Referencias publicas: nao representa verificacao de alertas ativos.
export const OFFICIAL_ALERT_LINKS_PATH = '/v1/public/official-alert-links';
export const OFFICIAL_ALERT_LINKS_CONTRACT = 'BLAISE_RJ_OFFICIAL_LINKS_V1';

export const OFFICIAL_ALERT_LINKS = Object.freeze([
  Object.freeze({
    id: 'defesa-civil-rj',
    name: 'Defesa Civil RJ',
    message: 'Consulte os avisos oficiais de riscos e emergencias no estado do Rio de Janeiro.',
    url: 'https://defesacivil.rj.gov.br/',
  }),
  Object.freeze({
    id: 'alerta-rio',
    name: 'Alerta Rio',
    message: 'Consulte os avisos oficiais de chuvas intensas e deslizamentos na cidade do Rio.',
    url: 'https://www.sistema-alerta-rio.com.br/alertas/',
  }),
  Object.freeze({
    id: 'inmet-avisos',
    name: 'INMET',
    message: 'Consulte diretamente os avisos meteorologicos oficiais e suas areas de validade.',
    url: 'https://avisos.inmet.gov.br/',
  }),
  Object.freeze({
    id: 'cemaden-rj-riscos',
    name: 'CEMADEN-RJ',
    message: 'Consulte diretamente os niveis oficiais de risco hidrologico e deslizamento no RJ.',
    url: 'https://painelcemadenrj.defesacivil.rj.gov.br/monitoramento/v2/mapa/',
  }),
]);

export function createOfficialAlertLinksHttpHandler(delegate) {
  if (typeof delegate !== 'function') throw new TypeError('invalid_official_links_delegate');
  return (req, res) => {
    if (req.url !== OFFICIAL_ALERT_LINKS_PATH) return delegate(req, res);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Allow', 'GET, HEAD');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.end();
      return;
    }
    const payload = JSON.stringify({
      contract: OFFICIAL_ALERT_LINKS_CONTRACT,
      alertStatus: 'NOT_CHECKED',
      links: OFFICIAL_ALERT_LINKS,
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'HEAD') return res.end();
    res.end(payload);
  };
}
