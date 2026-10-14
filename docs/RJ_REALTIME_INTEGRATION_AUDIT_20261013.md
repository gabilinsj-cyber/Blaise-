# Blaise V6 RJ — auditoria de integração real (13/10/2026)

**Escopo exclusivo:** 92 municípios do estado do Rio de Janeiro, áreas de divisa e Atlântico que possam afetar o RJ. Fonte INEA não é operacional.

## Estado do repositório encontrado

- PR #97 **já incorporada à main** em 10/10/2026.
- A main consultada em 13/10/2026 estava em `fa8cef1646d43fc677c058e612deb7139d106240`, com workflows **Android CI success** (run 38389014139) e **Android Runtime success** (run 38389014116).
- Controles Compose, mapa próprio com 92 municípios, tabelas científicas/meteorológicas, estação INMET local, aviso INMET/Defesa Civil/CEMADEN por cobertura e aviso marítimo regional CHM já estavam no código. CI verde comprova testes automatizados, não todos os 30 fenômenos em produção.
- PR de correção: #132, criada a partir dessa versão principal. Não é um APK instalado, uma aprovação Google Play ou um deploy Cloud Run.

## Correções incluídas na PR #132

1. **UTC no cliente Android INMET.** Antes, o cartão de condições atuais escolhia dia pela hora de Brasília; o gráfico já usava UTC. Agora ambos usam `InmetUtcQueryDates.range()`: datas inicial/final em UTC, inclusive na virada diária e de ano.
2. **Unificação da seleção de estações.** O cartão usa `InmetMunicipalityStationPolicy.select()`, já usado pelo gráfico, e exige código de estação A/B, operador **INMET**, estação **Operante**, coordenadas RJ e município canônico. Pesquisa até 4 estações locais quando uma não tiver leitura recente. Rejeita linhas de outra estação, medições vencidas/futuras ou valores sem variável física válida. Não usa estação de município vizinho.
3. **Cache do catálogo somente.** `InmetStationCatalogCache` armazena por até **15 min** a lista de estações e evita descargas concorrentes do catálogo por vários cartões/gráficos. Medições e avisos meteorológicos **não recebem validade artificial pela duração do catálogo**. Falha de rede não reapresenta catálogo expirado como novo.
4. **Permissão de dados no contrato do backend.** Uma observação real do adaptador INMET ativo e aprovado precisava carregar o indicador `usagePermissionStatus=VERIFIED_FOR_APP_DATA_DISPLAY`; antes, o resolvedor Table 1/2 rejeitava o dado por ausência de metadado. O indicador é acrescentado somente após as duas gates `enabled` e `usageApproved` e a validação do JSON original; não substitui decisão do operador sobre o produto comercial.
5. **Hierarquia operacional explícita.** `rj-operational-source-contract.mjs` diferencia:
   - Consulta municipal operacional de observações: **Alerta Rio (somente cidade do Rio) → Defesa Civil competente → INMET**;
   - Comparação de modelos se divergir: **INPE/CPTEC → Windy**, sempre diferenciando previsão de medição;
   - OpenWeatherMap permanece **3º produto complementar da Tabela 1 para dez fenômenos**, como aprovado, mas não toma o lugar do INMET como fonte de estação observada. O índice visual explica a distinção sem retirar os produtos de mar/Copernicus/EUMETSAT;
   - CEMADEN/ANA/SGB/Marinha/NOAA/USGS continuam rotas específicas de chuva, risco, rios, litoral, ciclones e sismos.
6. **Agentes 1–10.** `planRjPhenomenonCase` registra a hierarquia operacional municipal para que auditoria, cálculo e roteamento usem a mesma distinção entre fontes oficiais e modelos. Não informa que dez processos independentes foram implantados.

## Validação de software

- Testes novos de UTC: janela na noite de Brasília, meia-noite UTC e ano novo.
- Testes de catálogo: cache, expiração, concorrência e falha segura.
- Testes de duas fontes no backend: o **adaptador INMET gated** deve ser aceito tanto pelo resolvedor hierárquico quanto pelo executor das Tabelas 1/2; indicação de licença é obrigatória.
- Teste de política para 92 cidades e fenómenos especializados, sem falsa fonte Alerta Rio fora do Rio.
- **Acompanhar GitHub Actions da PR #132** para status real e eventuais falhas; resultados de teste só podem ser declarados verdes depois do término.

## Limites de produção que não podem ser ocultados

- **Não há prova autenticada de conexão Cloud Run/operador ou 24h de leitura viva** nesta auditoria. O worker oficial de risco/avisos exige variáveis, termos e prova de origem; `GET /v1/internal/rj-sources/readiness` protegido por OIDC serve como verificação.
- O endpoint público `GET /v1/public/rj-status` é **gated** por `BLAISE_RJ_PUBLIC_STATUS_ENABLED` e `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED`; não liga sozinho com CI, nem comprova que todos os 92 municípios têm estação.
- INPE/CPTEC, Windy, OpenWeatherMap, NOAA, Copernicus Marine, EUMETSAT e produtos completos ANA/SGB requerem produto, autorização, adapter/decodificador, horário e cobertura; nomes na matriz não são conexão.
- Mapa base geográfico é próprio, mas **chuva volumétrica de radar** exige grade física real autorizada e calibrada; não criar manchas a partir de pontos.
- CHM METAREA V é aviso **regional marítimo**, não P0 municipal e não atribuição a toda praia.
- Voz feminina/microfone, entitlements de duas contas reais, Google Play e implantação Cloud Run exigem verificação física/credenciais, não estão homologados por GitHub CI.
- Alertas oficiais P0 não dependem de assinatura, medição calculada ou foto ilustrativa.

**Próximos gates operacionais:** CI verde → revisão PR #132 → merge seguro sem release automático → homologação dos produtos e flags → consulta OIDC de prontidão Cloud Run/24h → verificação no aplicativo físico e lojas após aprovação.
