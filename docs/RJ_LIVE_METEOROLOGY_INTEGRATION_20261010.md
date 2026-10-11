# Blaise V6 RJ — integração meteorológica viva e regras de liberação

**Projeto único:** Blaise V6 RJ. 92 municípios do Rio de Janeiro; divisas sem confusão com observações de outros estados. INEA segue excluído. Base: PR #97 incorporada à `main` em 2026-10-10. Alterações novas: PR #98, sem deploy/publicação automática.

## Implementado em código nesta PR

1. **INMET observações de estações:** `backend/src/rj-inmet-observation.mjs` lê catálogo de estações automáticas `https://apitempo.inmet.gov.br/estacoes/T` e `/estacao/{data-inicial}/{data-final}/{id}`, em **HTTPS, origem fixa e sem redirecionamento**. Somente estação operacional explicitamente nomeada como município fluminense, com coordenada RJ, IBGE coerente, código real e hora UTC legível. Temperatura instantânea, umidade, vento médio/rajada e chuva acumulada 1 h, cada uma com unidade e hora por estação. Rejeita 9999, ausências, valor fisicamente implausível, dado antigo, outro estado e municípios sem estação coincidente. **Ter código de município não significa existir estação nele**.
2. **Cache e frequência:** catálogo a cada até 60 min; uma única consulta do dado de estação para as cinco variáveis a cada até 5 min, compartilhada por município/estação e deduplicada em chamadas simultâneas. Dados horários fornecidos pelo INMET não são artificialmente transformados em observações a cada 30 segundos.
3. **Reconciliador científico já existente:** a leitura entra no `consultRjSourcesUntilTwo` (`backend/src/rj-hierarchical-weather-resolution.mjs`). Ordem conforme localidade: Alerta Rio (apenas Rio), Defesa Civil, INMET; INPE/CPTEC como primeiro desempate de **previsão** e Windy se o INPE não permitir selecionar contexto. **Nesta PR só a ingestão de medições INMET foi acrescentada**; as demais integrações não são falsamente anunciadas. O reconciliador não pode fabricar uma segunda fonte.
4. **Backend público** `GET /v1/public/rj-meteorology?ibge=3304557&variable=TEMPERATURA_C` com variantes `UMIDADE_PERCENTUAL`, `VENTO_KMH`, `RAJADA_KMH` e `CHUVA_MM_1H`. Resposta com contrato, localidade, estado da fonte, valor e tipo, hora UTC e estação, ou indisponibilidade real. Sem compra ou conta, mas publicável **somente depois de autorização da operadora**.
5. **Android** `RjMeteorologicalHttpsClient` liga o mesmo endpoint aos cartões Rio/Cidade 1/Cidade 2. Sem substituir os dados já vindos de `OfficialWeatherClient`: usa apenas medição INMET validada para completar campos ausentes, com identificação do horário/estação. Consulta no máximo as três cidades distintas e cinco variáveis a cada 5 minutos. Uma configuração ausente ou erro 503 deixa o dado sem valor, sem extrapolar prazo.
6. **Risco e alertas públicos (já no código anterior):** `/v1/public/rj-status` e seu cliente Android oferecem riscos municipais do CEMADEN/Defesa Civil e avisos INMET com código IBGE quando a autorização de publicação, a fonte e o trabalhador estiverem ativos. **P0 oficial é independente de assinatura.**

## Condições exigidas para ativação

Todas as flags abaixo são **false por padrão**. Não forneça credenciais no GitHub em texto aberto nem configure serviços externos sem aprovação das condições do respectivo produto.

### Backend / Cloud Run (exemplos de variáveis, não instruções para execução imediata)
- `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=true`: serviço coletor histórico. Cada produto especializado tem habilitação própria: `BLAISE_CEMADEN_RJ_ENABLED`, `BLAISE_INMET_WARNINGS_ENABLED`, `BLAISE_CHM_WARNINGS_ENABLED`, `BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED`.
- `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED=true`: declaração operadora **somente depois** de confirmar as licenças do produto publicado; não é licença por si só.
- `BLAISE_RJ_PUBLIC_STATUS_ENABLED=true`: permite painel público risco/avisos, somente com a flag acima e com dados atuais.
- `BLAISE_RJ_INMET_STATION_TERMS_APPROVED=true`: confirmação específica de acesso automatizado do INMET e condições de uso no aplicativo; **o INMET indica canal `api@inmet.gov.br` para solicitar acesso à API** ([contatos oficiais](https://portal.inmet.gov.br/fale-conosco)). Chaves/quotas eventualmente fornecidas exigem integração em Secret Manager, política de acesso e teste, nunca GitHub em aberto.
- `BLAISE_RJ_METEOROLOGY_ENABLED=true`: permite o endpoint meteorológico somente com ambas as aprovações de termos anteriores.
- **Build Android:** `BLAISE_RJ_PUBLIC_STATUS_BASE_URL=https://<domínio-real-aprovado-do-backend>` (somente origem HTTPS). O cliente compõe as rotas `/v1/public/rj-status` e `/v1/public/rj-meteorology`. Se vazio, ambas as integrações novas permanecem desativadas.
- **Billing:** não alterar IDs/preços de assinatura para liberar dados públicos. Backend legado de assinatura exige ainda configuração própria para iniciar; não há autorização nesta PR para habilitar cobrança/lojas.

## Matriz de disponibilidade real

| Categoria | Fontes | Integração comprovada em código | Pendências |
|---|---|---|---|
| Temperatura/UR/vento/rajada/chuva horária de estação | INMET; Alerta Rio no município do Rio | Android consulta direta INMET/Alerta Rio; nova ponte backend INMET com cache e validações | Confirmar autorização de acesso API, configurar gates e testar serviço real; cobertura onde houver estação, **não** 92 sensores |
| Risco hidrológico/avisos por município | CEMADEN RJ/Defesa Civil e INMET CAP | Workers + snapshot público opt-in; Android lê a fonte por IBGE | Permissões, Worker ligado, Cloud Run validado e vigência real |
| Desempate por previsão | INPE/CPTEC e Windy | Algoritmos + testes do reconciliador | Autorização/licença por produto, identificador do modelo, corrida, habilidade histórica e HTTPS confiável; **não integrado ao vivo** |
| Rios, cota, vazão, cheias | ANA e SGB/SACE | Matriz de fontes/políticas, sem série de observações conectada | Serviços autorizados, mapeamento da estação/bacia e testes |
| Litoral, ressaca, ondas, avisos | Marinha/CHM, NOAA | Worker de avisos CHM e outros módulos existentes; radar não simulado | Cobertura RJ, produto específico, licenças, grade marítima e testes |
| Sismos, tsunami | USGS, NOAA, autoridades marítimas | Cadastro e painel com lacunas explícitas | API sísmica e competência de alerta/testes |
| Trânsito, deslizamentos e notícias | COR.Rio, CET-Rio, Defesa Civil e fontes jornalísticas | UI e fontes especializadas parcialmente registradas | Feeds oficiais e autorizações, links, cobertura por município |
| Radar e gráfico colorido do mapa **próprio** | Observações e grade permitidas | Desenho geográfico próprio e gráfico pontual de INMET | **Grade/frames espaciais reais licenciados**, sem pintar chuva fictícia |

## Gates para afirmar “integração completa”

1. Passar backend, Android, unit tests e emulador do commit exato.
2. Confirmar por logs de teste real, sem credenciais expostas, que serviços de entrada realmente responderam com horário de medição presente e identificador de estação.
3. Obter e documentar termos/licenças/quotas por fonte e configurar credenciais em Secret Manager.
4. Testar indisponibilidade, limite de tempo, sobrecarga, resposta 429/503, dado 9999, atualização de origem e município em divisa.
5. Testar canais público e pago separadamente: **P0 gratuito**; sem mascarar 503 como “sem alertas”.
6. Homologar voz no aparelho físico e assinatura com conta de teste oficial Google Play depois da aprovação do desenvolvedor. **Não baixar outro APK grande no telefone**.
7. Revisão e merge PR #98 após os gates; deploy Cloud Run e publicação em lojas exigem verificação própria.

**Nenhum dado novo, assinatura, licença ou endpoint é apresentado como “já ao vivo em produção” apenas por existir no GitHub.**
