# Blaise V6 RJ — auditoria técnica das Tabelas 1/2, mar e dados vivos

**Data:** 13/10/2026. **Escopo exclusivo:** Rio de Janeiro, 92 municípios e litoral/Atlântico adjacente relevante. Sem INEA operacional.

## O que existe na versão principal de 13/10

- **Tabela 1** — 30 fenômenos, matriz de fonte/cobertura e 3 produtos principais para clima municipal: Alerta Rio, Defesa Civil e OpenWeatherMap como complemento das dez variáveis, sem presumir independência de medições republicadas. No backend: `rj-meteorological-homologation.mjs`, `rj-phenomenon-source-policy.mjs` e `rj-table12-five-source-dispute.mjs`. No Android: `RjMeteorologicalTables.kt` e `RjLiveTableEvidence.kt`.
- **Tabela 2** — sequência INPE/CPTEC → INMET → CEMADEN → Windy → NOAA, por produto aplicável. Quando duas medições oficiais distintas, válidas e comparáveis concordam, média simples ou ponderada quando pesos têm proveniência. Quando um modelo é comparado com uma observação, **mostrar ambos e os seus tipos distintos, nunca fazer média entre previsão e medição**.
- **Interface** — seção Mais → Matriz Meteorológica, vínculos entre as 30 linhas da Tabela 1 e os critérios pertinentes da Tabela 2, leitura pontual INMET/Alerta Rio onde houver medição vigente, chance de recalcular sensação térmica com entradas adequadas e tabela marítima de 5 categorias.
- **Mar e Ondas** — avisos regionais CHM obtidos por `GET /v1/public/rj-status` **somente** quando o worker e o produto estiverem válidos, habilitados e com uso autorizado. Informações de onda/ressaca só quando constarem do boletim CHM, não um alerta automático por limiar numérico.
- **Ainda NÃO implementado/validado ao vivo para todos os painéis:** dados quantitativos de maré, swell, correntes e TSM; NOAA/Copernicus Marine/EUMETSAT/INPE/Windy/OWM em produção; radar espacial georreferenciado ao vivo; sismos, trânsito, notícias e qualidade do ar completos; operação simultânea comprovada de todos os produtos em 92 municípios.

## Inconsistência legada a tratar na homologação

`rj-hierarchical-weather-resolution.mjs` preserva regra antiga (Alerta Rio → Defesa Civil → INMET → INPE → Windy), enquanto a **Tabela 1 + Tabela 2 canônica cadastrada no aplicativo e no contrato novo** usa 3 fontes da Tabela 1 (Alerta Rio, Defesa Civil, OpenWeatherMap complementar) e cinco referências da Tabela 2 (INPE, INMET, CEMADEN, Windy, NOAA). Não apresentar dois mecanismos como se ambos estivessem em produção ou como resultados de um único desempate. Antes de um orquestrador único assumir todas as consultas ao vivo, homologar qual política será autoridade operacional, com evidências e versão exposta ao Android.

## Correções desta PR

1. A publicação de boletim CHM regional **não depende mais de INMET/CEMADEN atuais** quando houver um produto CHM próprio, autorizado e fresco. O backend reporta o produto `chm-marine` junto das fontes disponíveis; CHM vencido e todas as outras fontes vencidas continuam devolvendo 503. O teste exige exatamente isso e veda avisos marítimos CHM como P0 municipal.
2. Adaptador de estação **INMET real** (`rj-inmet-live-hierarchy-adapter.mjs`) agora inclui ponte explícita para a **Tabela 2 canônica**, validando `enabled` + `usageApproved`, estação e município fluminense exatos, período e proveniência antes de entregar o registro. Não cria novos dados, não consulta fontes sem autorização e não autoriza alertas.
3. Reforço dos testes da ponte INMET/consulta de fontes canônicas com fixtures. Todos os testes em CI devem aprovar antes de merge.

## Condições operacionais que exigem evidência antes de dizer “tempo real”

- Confirmar endereço HTTPS público e ambiente Android: `BLAISE_RJ_PUBLIC_STATUS_BASE_URL` (se vazio, cliente não consulta o endpoint). `BLAISE_ENTITLEMENT_VERIFY_URL` é **separado** e protege serviços pagos, não deve ser requisito para avisos públicos.
- No Cloud Run validar `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED`, a seleção de coletores da fonte CHM/CEMADEN/INMET e ambos os gates `BLAISE_RJ_PUBLIC_STATUS_ENABLED=true`, `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED=true` **somente após autorização de uso do produto**. Não ativar permissões unilateralmente.
- Fazer leitura autenticada `/v1/internal/rj-sources/readiness` com OIDC de operador, inspecionar `schedulerStarted`, horário de cada coleta, `freshSourceCount`, `completedSourceTaskCount` e cadência real; verificar o `/v1/public/rj-status` via GET após autorização e confirmar tipo, prazo e cobertura dos dados.
- Confirmar dados recebidos **por produto/variável, município e horário**; 92 municípios cadastrados não equivale a 92 medições. A tela deve exibir `Sem leitura atual` quando não houver material validado. Nenhum valor ilustrativo, extrapolação não justificada ou mapa de chuva colorido sem grade real.
- Confirmar em dispositivo físico voz feminina/microfone e compra/entitlement com Google Play após aprovação do console. Nenhuma assinatura premium pode ser presumida ativa, e avisos oficiais P0 permanecem independentes da compra.

**Estado:** alterações em branch de desenvolvimento para revisão/CI. Elas não alteram sozinhas o Cloud Run, não ativam licenças ou credenciais, não instalam APK e não comprovam monitoramento de todos os painéis em produção.
