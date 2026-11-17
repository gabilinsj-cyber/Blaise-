# Blaise V6 RJ — MET Norway/Yr como distribuidor de ECMWF + Copernicus CAMS

**Autorização específica do usuário em 17/11/2026:** utilizar ECMWF/IFS e Copernicus/CAMS indiretamente pela API MET Norway Locationforecast 2.0 para o RJ. ECMWF já era fonte aprovada. A antiga exclusão Copernicus é modificada **apenas para UV de céu limpo disponibilizado pela MET Norway**; não reativar coleta direta, mapas nem outros serviços Copernicus. INEA, Marinha, Windy e demais exclusões permanecem.

## Natureza, origem e qualidade

- Previsões atmosféricas no RJ: MET Norway redistribui modelo ECMWF/IFS. O mesmo ECMWF direto não constitui segunda medição independente. Classificação P (previsão); sensação térmica é estimativa E. Nunca classificar como termômetro observado O.
- UV: o campo ultraviolet_index_clear_sky do serviço é fornecido por Copernicus CAMS. É a previsão do índice UV **em céu limpo**, não UV observado nem índice efetivo com nuvens. Campo próprio uvClearSkyIndex; uvIndex permanece indisponível até receber produto adequado.
- Chuva: precipitation_amount em next_1_hours significa previsão da próxima hora, não chuva observada ou acumulada. Os campos são rainNextHourForecastMm e rainNextHourProbabilityPct.
- Ausência de campo não é zero. Registrar emissão real da fonte, tempo de validade, hora de checagem, tipo O/E/P e fonte específica.
- Créditos: MET Norway / ECMWF e MET Norway / Copernicus CAMS, com URL de origem, licença CC BY 4.0, indicação de adaptações. Não copiar mapas nem logotipos Yr, nem insinuar patrocínio.

## Termos 2026, identificação e cache

- Os Termos de Serviço da MET Norway (05/11/2026) exigem leitura e aceitação por uma pessoa humana com autoridade. Nenhum agente de IA aceita contratos pelo usuário.
- Para localização brasileira, o Locationforecast exige **no mínimo 3 horas entre solicitações idênticas**, também respeitando Expires se posterior. Produto global com atualizações aproximadamente de 6 em 6 horas; não prometer modelo novo em 12 minutos.
- Apenas backend com User-Agent real de Blaise + contato legítimo, If-Modified-Since exato, cache central e intervalo transacional de 3h por município, evitando repetição entre réplicas.
- Limite de tráfego geral abaixo de 20 requisições por segundo por aplicação, distribuído sem rajadas. O Android não contata a MET Norway diretamente.
- Clientes só veem valor realmente validado, fonte específica, horário e natureza; agentes, comparações, medidores e divergências ficam apenas na administração.
- INMET/CEMADEN seguem consulta interna de divergência e nunca alimentam medidores. Agente 13/OpenWeather continua último, com 35 minutos apenas temperatura/sensação e 900 chamadas por dia.

## Situação técnica da PR #157

- backend/src/rj-met-norway-locationforecast.mjs — parser global, validação geográfica/temporal, fetch opcional com aceite humano, User-Agent, Expires e Last-Modified.
- backend/src/rj-met-norway-firestore-store.mjs — cooldown de 3h transacional com cache compartilhado, sem dados pessoais ou TTL pagos.
- backend/src/rj-met-norway-runtime-optional.mjs — apenas dois pontos já verificados: Rio e Niterói; os outros 90 municípios ainda exigem georreferenciamento e altitudes homologados.
- backend/src/rj-met-norway-admin-evidence.mjs — evidencia os dois produtos ECMWF e CAMS sem duplicar temperatura nem inventar UV atual.
- backend/src/rj-meteorological-completeness-audit.mjs — matriz interna ampliada, sem alterar os dados públicos.

**Situação: código opcional de desenvolvimento, sem rota pública, sem agendamento, sem integração de valores ao Android e sem deploy. Nenhuma chamada real à API MET Norway realizada nesta implementação.**

Sinalizadores para futura homologação, nunca preencher automaticamente:
- BLAISE_MET_NORWAY_ENABLED=true após homologação
- BLAISE_MET_NORWAY_TOS_ACCEPTED_BY_HUMAN=true só após aceitação efetiva dos termos pelo responsável
- BLAISE_MET_NORWAY_FIRESTORE_ENABLED=true após teste do banco de dados compartilhado
- BLAISE_MET_NORWAY_USER_AGENT deve incluir BlaiseV6RJ, versão e URL ou e-mail de contato verdadeiro; não usar contato fictício.

Referências oficiais:
- https://docs.api.met.no/doc/TermsOfService.html
- https://docs.api.met.no/2026/11/05/service-distruptions-revised-tos.html
- https://docs.api.met.no/doc/locationforecast/datamodel.html
- https://docs.api.met.no/doc/License.html
- https://api.met.no/weatherapi/locationforecast/2.0/documentation
