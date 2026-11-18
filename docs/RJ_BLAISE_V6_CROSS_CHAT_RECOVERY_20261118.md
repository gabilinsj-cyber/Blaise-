# Blaise V6 RJ — retomada entre chats sem perda de trabalho

**Consolidação:** 18/11/2026. **Projeto exclusivo:** Blaise V6 RJ, 92 municípios do Rio de Janeiro e Atlântico adjacente. Este é um índice auditável de decisões, implementações e pendências, **não uma transcrição integral** dos chats nem prova de que todos os dados já chegaram aos clientes.

## 1. Repositório, ambiente e preservação

- Repositório original: https://github.com/gabilinsj-cyber/Blaise- ; principal: `main`.
- **Branch desta consolidação:** `feature/rj-meteoblue-free-credential-gate-20261118` ; PR **#171**, aberta e **draft**, sobre #170 (não sobre main diretamente): https://github.com/gabilinsj-cyber/Blaise-/pull/171
- **NUNCA** apagar/recriar/sobrescrever/resetar `~/Blaise-RJ`, `~/blaise-rj-safety/`, APK original, backups, instalações do cliente, código local NOAA ou worktrees existentes. Não executar `git reset --hard`, `git clean -fd`, `pull`, `checkout`, `merge` ou deploy às cegas.
- Evidência de operador em 18/11/2026: Cloud Run `blaise-v6-rj-backend` tinha duas revisões antigas com 99%/1% do tráfego e uma nova preparação vinculada ao segredo com **0%**. Isto não foi revalidado nesta consolidação; nada aqui altera tráfego ou publica APK.
- Artefato anterior preservado na Library: `Blaise_V6_RJ_Memoria_Consolidada_2026-11-17.md`; documento adicional `Blaise-V6-RJ-consolidacao-interface-2026-10-28.md`. A política mais recente deste documento prevalece sobre fontes antigas registradas nesses arquivos.
- Limite de APK cliente: **até 400 MB**; variante administrativa separada e interna, com controles de autenticação e auditoria.

## 2. Decisões de fontes mais recentes (17–18/11/2026)

- **Previsão atmosférica principal / candidatos técnicos**: DWD ICON (priorizar dados reais P com fonte/ciclo/validade), ECMWF IFS via caminho licenciado, NOAA GFS atmosférico sob restrições de classe e produto. Um catálogo, uma PR ou uma fixture não confirmam coleta e publicação contínuas.
- **meteoblue Free Weather API**: apenas `P`, previsão meteoblue mLM para comparação **privada**, pacote barato `basic-6h`. Não contar como modelo independente de DWD/ECMWF/NOAA; nunca usar como observação `O` ou preencher medições atuais, estação, alerta oficial ou interface sem homologação.
- **OpenWeather/Agente 13**: último recurso de temperatura e sensação térmica, com idade/município/licença/limite de chamadas, sem se transformar em pluviômetro, fonte de alerta ou substituto cego. Vento e umidade citados como planejamento, não autorização de publicação.
- **HG Brasil Pro**: autorização comercial por e-mail de 17/11 para dados no aplicativo de assinantes com condições e atribuição; planejamento 92 municípios, até 100 localidades, 20.000 consultas/dia e previsões de 15 dias. **NÃO contratado**; não ativar sem assinatura vigente, códigos de cidade e testes reais. Preço em planejamento da PR #158: R$ 49,90/mês (confirmar no momento de contratação).
- **Climatempo Advisor**: apenas pedido de orçamento enviado em 18/11/2026, **nenhuma contratação**.
- **NOAA oceânica**: GFS Wave para ondas/período do swell, CoastWatch GOES-19 para SST oceânica, GOES/ABI nuvens e GOES-19 GLM para raios conforme produto. Nem SST nem flashes GOES são temperatura do ar, sensação, boia observada ou alerta de descarga ao solo.
- **RAMMB/CIRA SLIDER**: visualizador complementar do satélite NOAA, **não** um sensor independente nem permissão para copiar imagens/mapas no app. Zoom Earth descartado.
- **INMET e CEMADEN**: comparação e auditoria **internas**, não inserir valores nem estações deles na interface pública meteorológica. **Alerta Rio e Defesa Civil RJ**: exceção somente de aviso oficial com UMA frase curta e UM link direto à página oficial, não uma fonte pública de medição meteorológica.
- **Exclusões atuais**: EUMETSAT (remoção técnica tratada na PR #169); NASA, JAXA (substituídas operacionalmente pela opção NOAA/SLIDER em 17/11); INEA, Marinha/CHM, Windy, Copernicus e Zoom Earth. Código/histórico antigo pode mencionar esses nomes; isso **não** permite reativação. O método de dados licenciado e a ausência de cópia de terceiros prevalecem.

## 3. Cadastro / código que merece reaproveitamento (não igual a produção)

| Referência | O que há / limite |
|---|---|
| PR #141 (merged) | Unificação da aquisição municipal para cards, gráficos, mapa e assistente; mantém timestamps reais |
| PR #142 (merged) | Notícias, USGS, controle de validade e histórico de alertas |
| PR #145 (draft) | Catálogo PNBOIA e ponte autenticada condicionada a licença |
| PR #152 (merged para branch de testes) | Interface original adaptativa, mapa IBGE próprio, sem valores demonstrativos publicados |
| PR #153 (merged para branch de testes) | Gate de tamanho APK cliente de 400 MB, voz pt-BR preservada |
| PR #157 (draft) | Contingência Agent 13, limite interno 900/dia, 35min, duas variáveis térmicas; MET Norway experimental |
| PR #158 (draft) | Matriz de HG Pro e 92 municípios sem assinatura |
| PR #159 (draft) | APK admin QA e coleta NOAA GFS atmosférica de staging |
| PR #163 (draft) | DWD/ICON T_2M: uma grade e pontos IBGE para os 92, auditoria privada |
| PR #164 (draft) | Controle de validade OpenWeather; bloqueio de HG sem assinatura ativa |
| PR #165 (draft) | Migração de DWD ICON para Open Data v1, pesos oficiais e hash verificado; nunca presumir cutover sem prova |
| PR #166 (draft) | NOAA GFS Wave HTSGW/SWPER em três áreas oceânicas, sem inventar dados faltantes |
| PR #168 (draft) | NOAA CoastWatch GOES-19 SST com controle de qualidade; disponibilidade real não confirmada |
| PR #169 (draft) | Remoção de EUMETSAT, NOAA oceânica única conforme aprovação mais recente |
| PR #170 (draft) | Experiência NOAA GOES-19 GLM privada, sem alarmes de raios no app |
| PR #171 (draft) | meteoblue `basic-6h`, parser, Firestore, cache, testes e segurança |

Obs.: PRs de desenvolvimento podem estar empilhadas e **não devem ser mescladas isoladamente ou em ordem arbitrária**. Um workflow com sucesso não é implantação real. Links: `https://github.com/gabilinsj-cyber/Blaise-/pull/NUMERO`.

## 4. meteoblue: conta e nuvem, fatos vs pendências

- Plano Free Weather API, **10 milhões de créditos de API** por um ano, expiração na tela de conta em **18/11/2027**, custo do pacote `basic-6h` documentado como **4.000 créditos/requisição**. O ano gratuito **não é renovável** como outra avaliação gratuita; só possível considerar créditos pré-pagos/outro acordo depois, sem compra autorizada agora.
- Em 18/11/2026 o operador verificou **HTTP 200 e 29 horários de previsão** em uma solicitação Cloud Shell anterior. Isto não audita os sete campos numéricos, saldo real atual ou contas.
- Projeto Google Cloud `blaise-v6-rj`; segredo `blaise-meteoblue-free-api-key` versão 1 registrado; identidade esperada `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`; revisão com segredo preparada a 0% do tráfego. **Não guardar valores da chave em Git, chat, APK, logs ou comando impresso**. Chave exposta em screenshot anterior deve ser rotacionada antes de uso contínuo/produção.
- A variável `BLAISE_METEOBLUE_FREE_COLLECTOR_ENABLED` fica **OFF** em produção. O único teste real adicional elegível é a auditoria de um ponto, manual/privada, com confirmação de plano Free, top-up desabilitado, Firestore disponível e reserva de créditos **ANTES** do HTTP. Nunca scheduler, 92-city polling ou publicação.
- O caminho legado `checkMeteoblueFreeKeyOnce` / `check-meteoblue-free-one-shot.mjs` foi **desativado** nesta retomada: antes era capaz de solicitar dados sem contador Firestore. Prova de regressão verifica **zero HTTP** até com as flags antigas. Usar apenas `backend/scripts/meteoblue-free-private-field-audit.mjs` conforme documento de orçamento.
- **Não** confundir gratuidade dos créditos meteoblue com gratuidade de Cloud Run, Firestore, rede, Secret Manager ou demais serviços Google Cloud.

## 5. Sete campos de `basic-6h` validados por parser offline

| JSON meteoblue | Campo privado Blaise | Semântica |
|---|---|---|
| `precipitation` | `forecastPrecipitationSixHourMm` | total previsto 6h (mm) |
| `convective_precipitation` | `forecastConvectivePrecipitationSixHourMm` | componente convectiva prevista 6h (mm) |
| `precipitation_probability` | `forecastPrecipitationProbabilitySixHourPct` | probabilidade de precipitação 6h (%) |
| `windspeed_mean` | `forecastWindMeanSixHourKmh` | vento médio previsto no intervalo (km/h) |
| `windspeed_max` | `forecastWindMaxSixHourKmh` | máximo do vento previsto no intervalo, **não rajada observada** |
| `relativehumidity_mean` | `forecastHumidityMeanSixHourPct` | umidade relativa média prevista (%) |
| `sealevelpressure_mean` | `forecastSeaLevelPressureMeanSixHourHpa` | pressão reduzida ao nível do mar média prevista (hPa) |

Validação offline: matriz de 6 em 6h, cronologia estritamente crescente, tamanhos, faixas plausíveis, coordenadas, rodada/metadados quando presentes, unidades se fornecidas, nulos preservados, categoria **P**. Sem fonte real homologada, **não** preencher chuva atual, acumulado observado, temperatura, sensação, rajadas, maré, ondas, descargas reais, estações ou alertas oficiais a partir destes sete campos.

## 6. Orçamento defensivo de créditos

| Regra no coletor | Valor | Estado |
|---|---:|---|
| Oferta de referência | 10.000.000 créditos totais | Conta do operador, saldo atual não consultado |
| Teto reservado ao coletor | 8.000.000 créditos | Implementado no Firestore, teste offline |
| Margem fora do coletor | 2.000.000 créditos | Reserva planejada; não saldo confirmado |
| Pacote `basic-6h` | 4.000 créditos/requisição | Verificar custo atual com fornecedor |
| Chamadas máximas | 4 por dia UTC (global) | Transação Firestore |
| Município | Máx. 1 chamada por 24h rolantes | Transação Firestore |
| Cache | 6 horas | Firestore privado |
| Validade da conta | até 18/11/2027 | Bloqueio temporal no código |
| Resposta do saldo do fornecedor | desconhecida | Verificar no dashboard meteoblue, não inventar |

**Dimensionamento:** 92×4.000 = **368.000 créditos por varredura**; 10M permitem ~27 passagens completas (sem nenhum outro gasto), insuficientes para atualizar as 92 cidades a cada 6 horas no ano. Mesmo 4 chamadas/dia por 365 dias totalizariam no máximo 1.460 chamadas / **5.840.000 créditos** no contador local, caso executadas, antes de descontar chamadas externas. O limite operacional é deliberadamente mais conservador do que o teto da oferta.

As reservas são registradas mesmo se a requisição falhar, não há reembolso automático porque o fornecedor pode debitar mesmo sob erro de rede. Firestore ausente/erro → **bloqueio seguro**, nunca contador local por instância. Dados privados não incluem identidade de clientes, posição GPS individual, voz ou histórico pessoal.

## 7. Testes e atualizações verificadas

- PR #171, commit anterior à correção do legado `f2ed5bbdf4a1c3a7274d28c69a6de01e5c6551d4`: GitHub Actions Android CI run `44361766869`, backend+verify **sucesso**, 648 testes backend aprovados; gate meteoblue run `44361766892` **sucesso**, 16 testes offline aprovados / 0 falhas.
- Esta retomada desativou teste antigo que bypassava Firestore e adaptou testes; **o novo commit precisa de CI verde novamente** (não presumir).
- Nenhuma chamada real à meteoblue, leitura do segredo, lançamento Android, consumo de créditos ou consulta do saldo da conta foi feita nesta etapa de revisão pelo assistente.
- Documentos de operação: `docs/RJ_METEOBLUE_FREE_COLLECTOR_AND_CREDIT_BUDGET_20261118.md` e `docs/RJ_METEOBLUE_FREE_SECURE_ACTIVATION_20261118.md`.
- Teste final vivo restrito: 1 município, 1 chamada `basic-6h` privada, campos/metadata e cache auditados **sem exibir valor numérico não validado**; nunca executar sem acesso seguro a Secret Manager/Firestore, orçamento e confirmação do operador.

## 8. Próxima execução sem afetar clientes

1. Confirmar CI **do commit mais recente** da PR #171 e revisar dependências empilhadas, licenças e exclusões.
2. Verificar no provedor o **saldo verdadeiro**, custo vigente `basic-6h`, ausência de top-up automático e chave não comprometida; depois conferir quota/controle de custos Google Cloud.
3. No **Cloud Shell de confiança**, em worktree separada (sem alterar `~/Blaise-RJ`), executar auditoria **OFFLINE** e ledger local; nenhuma chave no terminal compartilhado, APK ou Git.
4. Uma única auditoria real opcional, privada, com Firestore + Secret Manager: validar os sete campos reais, unidades, horários e repetição via cache; descontar **4.000 créditos previstos**. Sem permissão/infraestrutura, registrar `UNAVAILABLE`, não inventar.
5. Depois validar a matriz por 92 códigos IBGE, fontes DWD/NOAA/Agent 13, conectores administrativos, mapa, voz, testes de segurança/performance e release canário sem tocar produção original.
6. HG Pro e outros contratos **somente mais perto da publicação**, após orçamento e autorização explícita. Não fazer pagamento antecipado.

**Fontes externas:** documentação oficial meteoblue
- https://docs.meteoblue.com/en/weather-apis/free-weather-api/overview
- https://business.meteoblue.com/ai-instructions
- https://my.meteoblue.com/packages/openapi.json

**Regra de prevalência:** decisões recentes explícitas > documentação histórica > código de PRs antigas. Cada dado real requer origem, classe O/E/P, local, período de validade, licença e evidência; ausência nunca é zero.
