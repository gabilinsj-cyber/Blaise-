# Validação oficial — 06/10/2026

Consulta realizada às 17:02–17:04 de Brasília.

- Alerta Rio: HTTP 200. HTML oficial validado: 33 estações pluviométricas e oito linhas meteorológicas. Leitura meteorológica às 17:00; dados por estação, sem extrapolação para Centro ou Niterói. Ausências preservadas como null. Evidência numérica em OFFICIAL_WEATHER_PROBE_20261006.json.
- Catálogo ArcGIS oficial: HTTP 200, apenas metadados das estações; não comprova temperatura atual.
- Observações INMET A652: HTTP 502. Sem validação real de Niterói.
- CPTEC/INPE previsão Rio (241): HTTP 403.
- CPTEC/INPE UV Rio (241): HTTP 403. A documentação oficial diferencia UV máximo diário previsto de UV atual: https://servicos.cptec.inpe.br/XML/ . Não contornar acesso negado.

O Alerta Rio fornece temperatura, umidade, vento médio, direção e chuva observada. Não fornece neste contrato sensação térmica, UV, probabilidade de chuva, cobertura de nuvens ou rajadas. Chuva medida não equivale à possibilidade de chuva futura; vento médio não confirma vendaval; umidade alta não comprova céu nublado.

Sensação térmica é índice calculado, não uma medição direta. Para incluir um índice, validar fórmula, faixa aplicável, unidade, simultaneidade/localidade das entradas e rotular método e condições (sombra/sol/vento), preservando dados observados. Referência primária: https://www.weather.gov/epz/wxcalc_heatindex . Não usar índice de calor fora do seu domínio nem substituir automaticamente por temperatura.

Incluído parser meteorológico no backend com testes de unidade, ausência, limites, horário inválido, atraso e data futura. Validado contra o HTML oficial recebido. Ainda não está ligado ao assistente Android nem implantado no Cloud Run. O fluxo de áudio depende de teste no celular. Permanecem pendentes Centro, Niterói, sensação térmica, UV, probabilidade de chuva, nebulosidade e rajadas. Este resultado é validação parcial da fonte, não validação ponta a ponta do aplicativo.
