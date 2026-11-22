# Blaise V6 RJ — auditoria geral meteorológica e decisão de produção (GO / NO-GO)

**Data-base:** 21 de novembro de 2026 (BRT). **Código:** PR #173, branch `feature/rj-meteoblue-full-recovery-admin-ui-20261118`, sobre a cadeia de PRs #157–#172 (DRAFT, não integradas individualmente a `main`). **Escopo de homologação:** somente NOVOS coletores/fontes meteorológicas/alertas/medidores e publicação de dados aos assinantes; a versão original em produção não deve ser modificada por esta revisão.

## Decisão fundamentada

**QA DE CÓDIGO = APROVADO no SHA da avaliação inicial. HOMOLOGAÇÃO METEOROLÓGICA/RELEASE = NÃO AUTORIZADO (NO-GO).** O primeiro SHA auditado `b8d0c3bb2473545f6ab3a61b5afd9532a378796a` exibiu **8 workflows concluídos com sucesso**, inclusive Android CI (backend + verify), DWD, meteoblue, NOAA ondas/SST/GLM, Visual Crossing e WeatherAPI offline. Sucesso de testes automatizados não prova credenciais/execução contínua/atualidade em produção, termos de redistribuição, cobertura efetiva de 92 municípios, radar/pluviômetro observado nem P0. Reavaliar CI para o último SHA após este inventário.

Foi implementado um gate **offline e somente leitura**:
- `backend/src/rj-meteorological-production-readiness.mjs` — enumera 19 papéis/famílias de fontes e requisitos externos.
- `backend/scripts/rj-meteorological-production-readiness.mjs --assert-private` — retorna sucesso APENAS quando as travas existentes ainda estão fechadas; `--require-production` retorna bloqueio até evidência externa. Não implementa nenhum bypass para cliente.
- `backend/test/rj-meteorological-production-readiness.test.mjs` — cinco testes sem rede/chave/crédito.
- Workflow `.github/workflows/rj-meteorological-production-readiness.yml` — verificação automática sem deploy.

**Não é uma aprovação futura automática:** o código desse gate está deliberadamente configurado como `meteorologicalProductionHomologated:false`. Uma eventual liberação demanda nova revisão, evidência assinada e autorização humana separada.

## Matriz de evidências reais vs. pendências (19 famílias/papéis)

| Fonte / setor | Evidência na branch, até 21/11 | Pendência bloqueante antes de publicar |
|---|---|---|
| MET Norway / ECMWF IFS | Adaptador de previsão e catálogo com produto indicado | Demonstrar leitura recente para RJ, carimbo, licenciamento/atribuição CC BY, User-Agent/identificação e integração end-to-end |
| DWD ICON Global | Código de ingestão v1/grade dos 92 IBGE em staging, testes CI | Pesos CDO oficiais e SHA-256, regrade por coordenadas, rodada atual válida, verificação 92/92, catálogo de atributos/licença |
| NOAA GFS atmosférico | Leitor GRIB e testes de staging privados | Atualização do modelo, QA do pixel, município/coordenadas, valores P/O classificados, publicação autorizada |
| NOAA GFS-Wave | Amostras reais de staging em **3 pontos oceânicos**, testes | Ciclo atual, altura de onda e período de swell, ausência de extrapolação para 92 municípios em terra, atribuição |
| NOAA GOES-19 GLM | Teste com arquivo real, sem polling autorizado | Cobertura/cadência real, tempo UTC, QA de flash e política de alertas; não transformar raios históricos em alerta oficial |
| NOAA CoastWatch SST / GOES-19 | Staging de SST E com três pontos oceânicos e teste de qualidade | Pixel QA alto, mascaramento nuvem/terra, validade, direitos e separação estrita de temperatura do ar |
| meteoblue Free basic-6h | **1 consulta real**, 29 períodos, 7/7 campos; 4.000 créditos reservados internamente; contrato hard-deny testado | Coincidência 29/29 dos campos de chuva total e convectiva; chave exposta; direitos para redistribuição/cache/atribuição a assinantes não esclarecidos; ausência 92/92; proibição de usar previsão antiga |
| OpenWeather / Agente 13 | Coletor condicional com cache, quota interna 900/d e testes | Credencial/conta/licença, coleta real válida, limite de frescor, contingência térmica não automática em produção |
| HG Brasil Pro | Resposta comercial escrita para exibição em app; 100 cidades, 20 mil consultas/dia, sem fonte de estação individual | Plano Pro **não contratado** por decisão da titular; sem chave e sem dados vivos; verificar termos e atribuição antes de publicar |
| Visual Crossing Free | Um ensaio privado real (7/10 campos atuais E e 36 períodos P), controle 92 cidades **dry run** | Chave anteriormente exposta, reconciliação de uso, rotação, reserva atômica, persistência real e licença/atribuição no app |
| WeatherAPI.com Free | Planejamento offline para 92 municípios; teto interno mensal 80 mil de 100 mil anunciados | Sem credencial, teste real, ledger mensal, atribuição/TTL, integração e contrato de dados por campo |
| Climatempo Advisor | Orçamento enviado, sem contrato | Sem proposta final, licença, chave ou dados reais; **não** ativar plano pago |
| ECMWF Waves | Candidato de comparação marítima | Endpoint específico aberto/termos e verificação real oceânica inexistentes |
| CAMS clear-sky UV via MET Norway | Exceção indireta registrada no código | Não confundir UV previsto de céu limpo com UV observado; validar política/atribuição e se exceção ainda é permitida |
| CEMADEN RJ | Parsing de catálogo e REDEC, probe manual default OFF | Freshness operacional, origem por estação, contrato de uso em backend e P0 não homologados; comparação administrativa apenas |
| INMET | Comparação científica administrativa prevista | Sem autorização de publicação numérica automática no cliente dentro da política atual |
| ANA / SGB SACE | Catálogo hidrológico e páginas oficiais | Solicitar acesso aplicável à API ANA HidroWebService, estação correta, nível real e cadência; boletins não equivalem a dados de sensores autorizados |
| Alerta Rio / Defesa Civil RJ | Encaminhamento por frase e link para as páginas oficiais | Não converter conteúdo de terceiros em medidor/alerta interno sem fonte e licença; P0 automático não homologado |
| RAMMB/CIRA SLIDER | Apenas link externo para visualizador GOES | Não copiar imagens/mapas nem extrair precipitação em mm; não é nova fonte independente da NOAA |

### Lacunas funcionais por fenômeno
- **Chuva observada atual (O), acumulado de pluviômetro e radar com até 30 min:** nenhum instrumento licenciado, identificável, atual e validado está homologado para o novo app. Exibir indisponível até prova.
- **Granizo/tornado/rajadas observadas/ressaca/nível de rio/sirenes:** cálculos, modelo, imagem e catálogo não equivalem a detecção/alerta confirmado. P0 só com contrato oficial de entrega e testes reais de severidade/validade/revogação/FCM.
- **Comparação entre fontes:** ECMWF, DWD, NOAA e mLM podem compartilhar modelos subjacentes. Não contar mLM como quarto modelo independente em voto ponderado.
- **Cobertura geográfica:** 92 entradas IBGE e testes de grade não provam 92 estações, dados de agora para 92 locais ou atualização contínua. Tratar por produto, coordenadas e tempo.
- **Qualidade do ar e tráfego:** parte do UI, mas fora da homologação meteorológica e ainda requer verificação de dados e licenças separadas.

## Política de fontes obsoletas (não reativar)
A matriz `RJ_SOURCE_MATRIX_POLICY.expresslyExcludedDirectSources` mantém excluídos **EUMETSAT, INEA, Marinha, Windy, Copernicus direto, JAXA GSMaP, NASA GPM/MUR/SAT e Zoom Earth**. A presença de código/PRs antigos é histórico, **não permissão para merge ou ingestão**. Alerta Rio e Defesa Civil RJ: **somente encaminhamento oficial por link**, não observação meteorológica. INMET/CEMADEN: comparação administrativa. CAMS/UV via MET Norway permanece exceção indireta sujeita a nova revisão.

## Regras de direitos e acesso verificadas nas páginas oficiais

- **MET Norway** oferece dados CC BY incluindo uso comercial, mas demanda **identificação por User-Agent**, respeito a cache/requisições e atribuição: https://api.met.no/doc/TermsOfService .
- **NOAA/NWS** disponibiliza a maior parte de seu material governamental em domínio público, salvo ressalvas específicas e sem falso endosso; identificar o produto específico antes da redistribuição: https://www.weather.gov/disclaimer .
- **Visual Crossing Free** permite aplicações comerciais e cache sob condições contratuais/atribuição, sem transformar o app em redistribuidor de dados brutos/serviço concorrente: https://www.visualcrossing.com/weather-service-terms/ .
- **WeatherAPI.com** anuncia 100.000 requisições/mês no Free para uso comercial; seus termos limitam cache de atuais a 60 min e previsão a 24 h: https://www.weatherapi.com/terms .
- **meteoblue Free** anuncia uso comercial, mas há lacuna sobre direitos específicos de retenção/reprodução e redistribuição em aplicativo para pagantes; consultar https://business.meteoblue.com/terms-conditions e solicitar esclarecimento escrito sem assumir necessidade de plano pago.
- **ANA HidroWebService** requer solicitação de acesso à API para automatizar dados segundo o portal da ANA: https://www.snirh.gov.br/hidroweb/acesso-api . **SGB/SACE** publica boletins e informações hidrológicas, mas os relatórios não validam o conector de cada estação: https://sace.sgb.gov.br/ .
- **CEMADEN** informa que pluviômetros publicam acumulados em mm no mapa interativo; isso não autoriza converter visualização em dado numérico comercial do aplicativo sem comprovar contrato e acesso: https://www2.cemaden.gov.br/pluviometros-automatico/ .

Esta checagem pública **não inclui** aceites de conta, contratos privados, autenticação no fornecedor ou aprovação jurídica profissional.

## Critérios GO/NO-GO antes de uma nova fonte chegar a assinantes

1. Fonte/produto/variável/URL de contrato e uso comercial **documentados**; regras de cache, licença, redistribuição e atribuição verificadas; chave protegida em Secret Manager sem exposição ou chave antiga rotacionada.
2. Resposta real recente para cada produto e amostras dos 92 IBGE onde aplicável, com O/E/P, unidade, município, coordenadas, data de emissão e de validade; escalas geográficas e qualidade de observação preservadas.
3. Datas vencidas, ausência, confiança incerta ou conflito de medição bloqueiam a apresentação e nunca são convertidos em zero, observação ou alerta.
4. Quotas, contabilidade compartilhada e limites do fornecedor comprovados; custos não inventados; nenhum plano pago contratado sem decisão expressa.
5. Backend e cliente integrados atrás de autenticação/entitlement; testes Android em aparelhos reais e administrativo separados, acessibilidade, voz, radar, mapa próprio e interface visual validada.
6. P0/FCM com autoridade competente, atualização, expiração, revogação, testes de falha e inexistência de alarmes falsos.
7. Produção/segurança: production preflight REAL, Cloud Run IAM/Secret Manager/egress, smoke HTTPS, carga/performance, monitoramento, canário e plano de rollback validado **antes** do release.
8. Gate de assinatura e loja; APK cliente <=400 MB, aprovação do desenvolvedor, compliance e auditoria de permissões.
9. Revisão explícita da nova evidência e autorização humana separada no SHA candidato; PR draft permanece sem merge, sem deploy e sem modificação do app original.

## Situação técnica concluída nesta revisão

- Workflows no SHA inicial `b8d0c3bb2473545f6ab3a61b5afd9532a378796a`: **8/8 concluídos em sucesso**, incluindo Android CI com job `backend` e `verify`.
- A PR #173 é **DRAFT e não mesclada**; várias branches #157–#172 são uma cadeia de PRs em rascunho, o que não comprova publicação na branch `main`.
- Foi criado um gate **somente leitura** na própria PR e respectivos testes CI; os próximos resultados valem para o SHA em que esses arquivos forem executados, não automaticamente para outros SHAs.
- A conta e as máquinas Cloud Run/Firestore/Secret Manager reais não foram auditadas por esta conversa, pois as ferramentas disponíveis não têm acesso direto ao ambiente; evidências de screenshots anteriores são históricas.
- **GO para continuar QA privado; NO-GO para liberar novas fontes meteorológicas e alertas ao cliente.**

**Preservação:** não apagar `~/Blaise-RJ`, `~/blaise-rj-safety/`, PRs anteriores, APK original, Cloud Run atual ou chaves; não fazer `reset --hard`, `clean -fd`, merge/deploy, publicar alertas ou realizar compras.
