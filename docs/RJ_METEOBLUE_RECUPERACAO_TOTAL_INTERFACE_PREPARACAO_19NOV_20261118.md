# Blaise V6 RJ — recuperação completa Meteoblue Free e preparação para 19/11/2026

**Registro técnico criado em 18/11/2026, horário de Brasília.** Na sessão de recuperação, o relógio local disponível marcava **18/11/2026 15:52 BRT**. Portanto, **19/11/2026 ainda não havia começado**: não atribuímos implementações, mensagens ou medições ao dia 19 sem evidência posterior. Este documento preserva o material existente e fornece um ponto de retomada para 19/11. Não é uma transcrição literal de conversas nem prova de implantação.

**Projeto único:** Blaise V6 RJ — Clima e Tempo (92 municípios do RJ + Atlântico adjacente). Não misturar app “Blaise & Ben” Alemanha, Paraná ou sistemas de outros estados.

**Código original preservado:** `main`, `~/Blaise-RJ`, `~/blaise-rj-safety/`, APK original e revisões Cloud Run que atendem os clientes. **NÃO** resetar, limpar, sobrescrever, mesclar, publicar nas lojas ou migrar tráfego por conta desta recuperação. Nenhum plano pago é autorizado.

## 1. Onde está cada parte recuperada

| Material | Arquivo / referência | Natureza |
|---|---|---|
| PR #171 — coletor gratuito | https://github.com/gabilinsj-cyber/Blaise-/pull/171 | Draft, código não implantado |
| PR #172 — HG Brasil, interface original/ADM | https://github.com/gabilinsj-cyber/Blaise-/pull/172 | Draft, não implantação |
| Registro cruzado de chats | `docs/RJ_BLAISE_V6_CROSS_CHAT_RECOVERY_20261118.md` | Decisões e links |
| Chat HG Brasil e interface | `docs/RJ_HG_BRASIL_CHAT_RECOVERY_AND_UI_20261118.md` | Decisões comerciais/UI |
| Coletor + créditos | `docs/RJ_METEOBLUE_FREE_COLLECTOR_AND_CREDIT_BUDGET_20261118.md` | Operação e bloqueios |
| Preparação secreta/nuvem | `docs/RJ_METEOBLUE_FREE_SECURE_ACTIVATION_20261118.md` | Secret Manager, uma auditoria |
| Comparativo de campos | `docs/RJ_METEOBLUE_COMPARATIVO_27_CAMPOS_20261117.md` | Estudo candidato; não habilita produtos pagos |
| Matriz climática completa | `docs/RJ_METEOROLOGICAL_COVERAGE_20261117.md`, `docs/RJ_METEOROLOGIA_MATRIZ_TESTES_REAIS_20261117.md` | Cobertura e lacunas |
| Proposta sem assinatura HG | `backend/src/rj-hgbrasil-pro-plan.mjs` | Gate de assinatura |
| Interface aprovada | Library: `Referencia_Definitiva_Blaise_V6_RJ_atualizada.md`, imagem oficial `1000007912.png` | Referência visual, números não reais |
| Continuidade 17/11 | Library: `Blaise_V6_RJ_Memoria_Consolidada_2026-11-17.md` | Histórico antigo, subordinado a decisões recentes |

**Branch desta etapa:** `feature/rj-meteoblue-full-recovery-admin-ui-20261118`, derivada da branch da PR #172. Todos os arquivos anteriores permanecem no Git/GitHub. Apenas conteúdo não conflituoso e decisões mais recentes são aplicados nesta branch; não recuperar fontes excluídas só porque figuram em PR ou documentação antiga.

## 2. Histórico Meteoblue verificado

1. 17/11: estudos de comparação de campos meteorológicos, lacunas de medidores e cotação HG/Climatempo; **sem compra**.
2. 18/11: conta do operador registra **Free Weather API**, **10 milhões de créditos promocionais**, expiração indicada **18/11/2027**; pacote `basic-6h`, previsão de 6 em 6 horas.
3. Teste manual no Cloud Shell da usuária obteve **HTTP 200 e 29 carimbos de tempo de previsão** para um ponto Rio. Este resultado **não confirma os sete valores numéricos, unidades, saldo atual, nem cobertura dos 92 municípios**.
4. Google Cloud, projeto `blaise-v6-rj`: segredo `blaise-meteoblue-free-api-key` versão 1 habilitada; identidade de runtime autorizada para ler o segredo conforme capturas. Revisão preparada com vínculo ao segredo **0% tráfego**, enquanto antigas mantinham 99%/1% no registro anterior. Isto **não foi rechecado diretamente na Cloud neste trabalho**. A chave tinha sido exposta em screenshot: **rotacionar antes de uso contínuo**.
5. PR #171: parser, coletor OFF por padrão, reserva Firestore transacional, cache, teste único auditável privado, scripts offline, testes CI.
6. Um **teste legado de chave sem contabilidade compartilhada** foi posteriormente desativado, permanecendo apenas caminho via coletor com reserva Firestore. Nunca usar script legado para nova chamada.
7. PR #172: catálogo Android corrige `meteoblue NEMS10` para `meteoblue Free • mLM 6h`, exclui EUMETSAT da lista; interface original foi preservada; status de HG e outros provedores entraram no ADM.
8. Esta branch acrescenta interface **administrativa** explícita para os sete campos e limites de créditos e oculta diagnósticos completos dos assinantes.

## 3. Os sete campos que `basic-6h` permite auditar

| Chave JSON meteoblue | Campo interno de previsão | Unidade | Restrição |
|---|---|---|---|
| `precipitation` | `forecastPrecipitationSixHourMm` | mm | Total **previsto** 6h, não chuva observada |
| `convective_precipitation` | `forecastConvectivePrecipitationSixHourMm` | mm | Parcela **prevista**, não raio/trovoada detectados |
| `precipitation_probability` | `forecastPrecipitationProbabilitySixHourPct` | % | Probabilidade prevista no intervalo 6h |
| `windspeed_mean` | `forecastWindMeanSixHourKmh` | km/h | Vento **médio previsto**, não anemômetro |
| `windspeed_max` | `forecastWindMaxSixHourKmh` | km/h | Vento **máximo previsto**, **não rajada observada** |
| `relativehumidity_mean` | `forecastHumidityMeanSixHourPct` | % | Média prevista no intervalo 6h |
| `sealevelpressure_mean` | `forecastSeaLevelPressureMeanSixHourHpa` | hPa | Pressão média prevista reduzida ao nível do mar |

**Classe meteorológica: `P`.** O produto gratuito usa meteoblue mLM/multimodelo; não é observação direta `O` e não deve ser contabilizado como quarto modelo independente quando incorpora DWD/NOAA/ECMWF. Não usar para temperatura do ar atual, sensação, chuva atual/acumulado observado, rajadas instrumentais, alertas oficiais, medições de estação, maré, SST ou raios.

Parser: `backend/src/rj-meteoblue-basic6h-parse.mjs`. Exige tempo de 6h crescente, faixas físicas plausíveis, quantidade de valores igual ao número de instantes, coordenadas originais, metadados de emissão/rodada quando presentes e evidência de unidade; ausência fica `null`, não 0. Mesmo depois de parse, `scientificallyHomologated:false` e `publishedToSubscribers:false` até homologação. Nenhum teste fixture representa observação real.

## 4. Arquivos exatos da implementação meteoblue

- `backend/src/rj-meteoblue-free-connection.mjs` — preparação da chamada para ponto IBGE conhecido e `basic-6h`.
- `backend/src/rj-meteoblue-free-key-check.mjs` — verificação legada **inativada, zero HTTP**.
- `backend/scripts/check-meteoblue-free-one-shot.mjs` — antigo wrapper, agora também incapaz de criar chamada via módulo legado.
- `backend/src/rj-meteoblue-basic6h-parse.mjs` — sete campos tipados, cronologia, ranges e metadados.
- `backend/src/rj-meteoblue-free-firestore-store.mjs` — transação global de crédito + cache privado.
- `backend/src/rj-meteoblue-free-collector.mjs` — no máximo uma chamada após reserva, falha fechada e cache.
- `backend/src/rj-meteoblue-runtime-optional.mjs` — inicialização opcional, OFF.
- `backend/src/runtime.mjs` — importação do módulo opcional, sem rota pública ou scheduler.
- `backend/scripts/meteoblue-free-private-field-audit.mjs` — script administrativo, offline até comando explícito com gates.
- `backend/scripts/meteoblue-free-credit-status.mjs` — leitura do contador **local Firestore**, não saldo do fornecedor.
- `backend/test/rj-meteoblue-free-collector.test.mjs`, `backend/test/rj-meteoblue-free-key-check.test.mjs` — testes sem créditos reais.
- `.github/workflows/rj-meteoblue-free-offline-ci.yml` — CI que não usa API real.
- `backend/src/rj-source-sector-matrix.mjs` — setor privado `METEOBLUE_FREE_FORECAST_6H`.

## 5. Créditos e validação econômica

| Campo | Implementação / limite | Ressalva |
|---|---:|---|
| Créditos promocionais no cadastro | **10.000.000** | Saldo **atual** fornecedor desconhecido |
| Teto interno coletor | **8.000.000** | Contador de reservas Firestore, não saldo do fornecedor |
| Margem de segurança planejada | **2.000.000** | Não é saldo certificado |
| Custo `basic-6h` | **4.000** por chamada | Rever documentação/conta se o fornecedor mudar tarifa |
| Máximo de requisições | **4 por dia UTC** global | Distribuído/atômico em várias réplicas |
| Cooldown geográfico | **24h** por município IBGE | Não por assinante/pessoa |
| Cache | **6h** privado | Não permite nova chamada em caso de falha Firestore |
| Término de uso gratuito indicado | **18/11/2027** | Sem renovação automática nem compra |
| Preço contratado | **R$ 0** de meteoblue paga | Infraestrutura Google pode ter custo separado |

92 municípios × 4.000 = **368.000 créditos por passagem**. 10 milhões cobrem apenas **27 passagens completas** (aproximadamente), nunca uma atualização de todas as cidades a cada 6h durante 12 meses. O coletor mLM grátis deve continuar limitado a **comparação privada esparsa**. No Android/ADM, **“saldo atual” e “reservas reais” ficam `NÃO CONSULTADO`**, não 10M, 0 ou outro número inventado.

**Segurança:** Secret Manager exclusivo do servidor, nenhum segredo no Android/CI/chat/logs; top-up automático não autorizado, nenhuma integração a produtos pagos Nowcast, Current, Sea, Measurements, Warnings ou History. Falha do Firestore/credencial/data/IBGE resulta `UNAVAILABLE`, sem usar contador por instância, sem retry sobre erro com cobrança incerta. Somente uma auditoria real privada, com aprovação explícita e reserva de 4.000 créditos, pode avançar depois de checar dashboard, chave e permissões.

## 6. Interface e APK do Blaise V6 RJ

Referência de produto: painel azul-marinho, dourado e neon, botão verde **LIGADO**, assistente feminina/voz pt-BR, duas cidades laterais (Rio e cidade 2), mapa próprio IBGE/RJ central dominante, radar/chuvavento/nuvens sob dados reais, alertas, mar, qualidade do ar, trânsito, previsão, gráficos e notícias. **A referência oficial é `1000007912.png`** e as regras `Referencia_Definitiva_Blaise_V6_RJ_atualizada.md`. Seus números e boletins de exemplo **não** são medições.

**Mudanças desta branch de desenvolvimento (não APK publicado):**

1. `app/src/admin/java/br/com/blaise/rj/AdminCollectorReadiness.kt`: sete campos tipados `AdminMeteoblueForecastField`, limite anual, cooldown, cache, campos de saldo e reserva reais **nulos** até evidência autenticada. Não executa nenhuma requisição.
2. `app/src/admin/java/br/com/blaise/rj/AdminScientificActivity.kt`: após claim Firebase admin válida, painel **“METEOBLUE FREE • 7 CAMPOS DE PREVISÃO”**, status por campo, explicação P e limites; sem valores inventados e sem ativação.
3. `app/src/main/java/br/com/blaise/rj/FinalDashboardSpec.kt` + `MainActivity.kt`: diagnósticos internos completos O/E/P são reservados ao APK ADM. O cliente tem informação simples de proveniência e **“Indisponível”** quando não há medição válida. Não exibir agentes, quadro de orçamento ou cálculos internos ao assinante.
4. Testes de unidade `AdminCollectorReadinessTest.kt` e `FinalDashboardSpecTest.kt`: sete campos, unidades, nulos, não publicação, isolamento admin e ausência de uso pago.
5. Mantém os bloqueios da PR #172 às consultas de estações domésticas no aplicativo público. O APK original instalado e o tráfego Cloud Run **não foram modificados**. Não há alteração de layout estrutural ou imagem de referência; interface original preservada.

## 7. Fontes e planos que não devem ser confundidos

- **DWD ICON**: previsão de temperatura 2m a 92 pontos IBGE em PRs #163/#165; validar migração para endpoint v1, pesos CDO oficiais SHA-256 e dados recentes antes do cliente.
- **OpenWeather/Agente 13**: estimativa de temperatura/sensação E, com limite interno 900/dia e gates de elegibilidade; sem licença/credenciais/coletores comprovados, fica indisponível.
- **HG Brasil Pro**: fornecedor respondeu por escrito permitindo uso comercial em app de assinantes, cache e atribuição, **não identifica estação física por campo**, até 100 cidades, 20.000 req/dia, 15 dias previsão, R$ 49,90/mês anunciado. Assinatura adiada até lançamento.
- **Climatempo Advisor**: orçamento solicitado, nenhum plano contratado ou coletor ativado.
- **NOAA**: GFS Wave para ondas/swell, CoastWatch SST/QA, GOES-19 GLM raios satelitais. Não usar SST oceânica ou GLM para temperatura/sensação urbana/alertas oficiais.
- **RAMMB/CIRA SLIDER**: apenas visualizador externo NOAA GOES, não sensor novo nem mapa copiável.
- **INMET/CEMADEN**: somente análise privada de comparação. **Alerta Rio e Defesa Civil RJ**: uma frase própria e link oficial, não coleta meteorológica.
- **Retirados da coleta meteorológica atual:** EUMETSAT, NASA, JAXA, INEA, Marinha/CHM, Windy, Copernicus direto e Zoom Earth. Históricos antigos permanecem no Git, mas não reautorizar integração.

## 7A. Correção de rigor da auditoria (continuação nesta etapa)

A revisão do coletor encontrou uma ambiguidade: o parser conseguia retornar `FORECAST_PARSED_PRIVATE_STAGING` com somente alguns campos ou com metadados insuficientes, e o coletor podia rotular esse conteúdo como `PRIVATE_STAGING_FORECAST_READY`. O parser continua aceitando conteúdo parcial **para inspeção privada**, mas agora produz condições adicionais:

- `completeFieldCoverage`: exige presença de **ao menos um valor numérico** em cada um dos sete campos `basic-6h`, sem converter `null` em zero.
- `auditReadyForPrivateReview`: somente `true` quando os sete campos têm cobertura, emissão/model run, coordenadas e unidades verificáveis; `auditBlockers` informa quais requisitos faltam sem revelar valores, chaves ou URL da consulta.
- O parser rejeita também datas de calendário impossíveis (como 30 de fevereiro), em vez de deixar JavaScript ajustar automaticamente a data.
- Se metadados ou campos falharem, o coletor retorna `PRIVATE_STAGING_AUDIT_INCOMPLETE` e o cache `PRIVATE_STAGING_CACHE_AUDIT_INCOMPLETE`; **não** retorna READY, não publica e não tenta outra chamada durante o cache válido. Uma falha de auditoria não estorna os 4.000 créditos reservados.
- `meteoblue-free-private-field-audit.mjs` imprime **apenas** estatísticas de cobertura e nomes dos bloqueios e termina com código de erro quando a auditoria não estiver completa.
- Cache de staging passa a ficar **indisponível a partir do fim do período gratuito**, mesmo se o TTL de seis horas ainda não houver terminado.
- Vento com metadados `m/s` ou `ms-1` é **convertido numericamente para km/h (×3,6)** e revalidado nas faixas físicas. Se a unidade for desconhecida, o campo é omitido na auditoria, em vez de copiar um número com rótulo `km/h` falso. Strings numéricas não são aceitas como medições.
- A unidade hPa pode constar na chave compartilhada de metadados `pressure` ou `sealevelpressure`; ambas são reconhecidas quando equivalentes. Unidades individuais contraditórias bloqueiam a conclusão.
- Testes offline acrescentados para falta de `modelrun_utc`, unidades individuais contraditórias, latitude ausente, campo numérico integralmente nulo, calendário inválido, repetição via cache e vencimento do plano.

Mesmo um resultado `auditReadyForPrivateReview=true` **não** é homologação científica nem disponibilidade em produção; confirma apenas integridade privada do pacote recebido. A confirmação de origem, saldo do fornecedor, custo vigente e direitos permanece manual. A tarifa operacional prevista é 4.000 créditos por solicitação; conferir no configurador da conta porque **a documentação oficial informa que o custo é dependente do pacote**.

Para avaliar esta versão, usar a branch `feature/rj-meteoblue-full-recovery-admin-ui-20261118` em uma worktree **separada**, sem reset/pull/checkout destrutivo no diretório original. O coletor continua OFF, sem agendador, sem endpoints do assinante e sem consulta externa nesta alteração.

## 7B. Evidência nova do painel do fornecedor — 18/11/2026, 16h34 BRT

**Fonte:** capturas fornecidas pela titular da conta, da tela “Exibir chave da API” e de “Estatísticas de uso da API” da meteoblue. **NÃO** anexar nem replicar as capturas neste Git: uma delas mostrou a credencial integralmente. Nenhuma chave ou fragmento dela foi transcrito.

- API de Previsão: **Ativado**; API de Imagem: **Ativado**; API de Pacote, de Mapas, de Conjunto de Dados e de Medição: **Desativado** na tabela de permissões. O HTTP 200 anterior para `/packages/basic-6h` indica que o endpoint já respondeu; não ligar outros produtos no painel sem evidência.
- **Limite diário de créditos da chave exibido: 10 milhões**. ATENÇÃO: isto é o **teto diário configurado**, NÃO um saldo remanescente, NÃO o teto total da avaliação. Com a chave vazada, o limite do fornecedor precisa ser reduzido imediatamente.
- Intervalo do gráfico selecionado: **03/11/2026–18/11/2026**; consumo agregado visto: **4.000 créditos** (pico de uso no final do intervalo), compatível com o teste HTTP 200 anterior. Não atribuir com certeza a cada chamada sem log do fornecedor. A projeção de saldo promocional de 9.996.000 seria **hipotética**, não saldo certificado.
- O ledger Firestore consultado pela titular registrou **0 reservas, 0 chamadas hoje e orçamento interno disponível de 8.000.000** para a campanha. Isto não contradiz 4.000 créditos no provedor: o teste anterior ocorreu fora do coletor que possui reserva atômica. Os dois contadores representam escopos diferentes.
- Proteções da chave exibidas: **segredo compartilhado**, **proteção de origem/referência** e **lista de permissões IP** estavam **não habilitados** no instante da captura. Não habilitá-los sem implementar a assinatura e/ou egress IP fixo no backend, pois isso pode interromper a conexão; primeiro reduzir limite diário e **rotacionar chave**.
- **Medida imediata para evitar consumo excessivo:** na tela da chave atual, usar **Atualizar** e reduzir o limite diário de **10.000.000** para **4.000 créditos** por dia para a próxima auditoria única, ou desativar a chave se houver essa opção até a rotação. Isto cobre no máximo uma chamada `basic-6h` estimada por dia. O limite de quatro chamadas/dia (16.000 créditos) permanece apenas no ledger interno e não justifica deixar a credencial externa com 10 milhões/dia.
- **Rotação segura:** criar nova chave no fornecedor; configurar o limite diário de 4.000 antes de uso; registrar uma **nova versão** no Google Cloud Secret Manager (`blaise-meteoblue-free-api-key`) sem colocar valor em Git, screenshot, chat ou terminal com histórico; verificar somente no backend/admin privado e então revogar a antiga. Manter as flags do coletor OFF até validação. Qualquer revisão Cloud Run antiga com chave original continua sendo risco; revisar vínculos e nunca mover tráfego durante esta rotação.
- **Não comprar créditos**, não habilitar auto top-up nem pacotes pagos. Cloud Run e Firestore podem gerar custos de infraestrutura separados dos créditos meteoblue.

A documentação oficial esclarece que o limite diário por chave bloqueia solicitações após atingir o teto e que chaves podem ser geridas no Weather API Manager: https://docs.meteoblue.com/en/weather-apis/accounting-api/weather-api-manager .

**Status após as capturas:** registro externo de 4.000 créditos consumidos no período; saldo real global restante **não exibido**; collector Firestore **0 reservas**; risco de exposição de chave ainda exige ação manual. Não realizar a auditoria `--live` enquanto a chave e o limite externo não estiverem seguros.

## 8. Evidência dos testes, limites de conclusão e próximo ato

- HEAD da PR #171 (`d0429a65...`) tinha **meteoblue offline CI e Android CI aprovados**, sem gastar créditos da API.
- A PR #172 (`5526f0cb...`) tinha job **backend aprovado**; `verify` Android ainda constava como em execução na última consulta de 18/11. Não declarar CI completo concluído sem nova leitura.
- Esta branch adiciona testes novos; CI do **novo HEAD** deve ser consultado depois. Um CI verde valida o código de teste, **não prova coleta real** nem autoriza publicação.
- Não houve consulta de saldo ao provedor, leitura real do Secret Manager/Firestore, novo consumo de créditos, produção, pagamento, merge, Play Store ou APK por esta recuperação.
- Para a retomada de **19/11**, checar saldo verdadeiro no painel meteoblue e top-up desligado, identificar se o segredo precisa ser rotacionado, verificar Firestore e executar **auditoria offline**; somente então considerar 1 chamada `basic-6h` controlada (4.000 créditos). Validar os sete valores/unidades/rodada/IBGE/cache em privacidade e não publicar nada sem licença.
- Em seguida rever os 92 campos geográficos DWD, mar/NOAA e demais medidores sem reaproveitar fonte excluída; atualizar os componentes reais do cliente somente após gates científicos e de segurança.

**Links oficiais para conferência:** https://docs.meteoblue.com/en/weather-apis/free-weather-api/overview e https://my.meteoblue.com/packages/openapi.json .

**Regra final:** preservar tudo de valor, sem transformar planejamento em produção nem números de exemplo em dados meteorológicos reais; não executar trabalhos fictícios atribuídos a 19/11.
