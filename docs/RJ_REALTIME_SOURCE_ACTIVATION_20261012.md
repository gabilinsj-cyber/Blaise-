# Blaise V6 RJ — implantação de fontes reais (12/10/2026)

**Escopo:** Rio de Janeiro, 92 municípios, divisas estaduais e Atlântico adjacente. A PR da interface #97 foi incorporada ao `main`; esta PR é uma continuação incremental, não um novo aplicativo.

## A diferença entre "conector programado" e "operação em tempo real"

A declaração "todas as fontes estão operando" **só é válida** após demonstrar em Cloud Run:
1. tarefa de coleta configurada, habilitada e agendada no serviço efetivamente implantado;
2. conexão HTTPS autorizada pelo proprietário da informação, sem raspagem proibida;
3. resposta recente e **dados semânticos válidos** (origem, produto, horário, local, prazo de validade, qualidade);
4. tratamento de falhas, limite de chamadas, cache, registros de operação e indisponibilidade;
5. acesso Android ao **mesmo endpoint de produção** e captura de teste em dispositivo/emulador;
6. evidência de atualização repetida conforme frequência da **fonte**, não apenas do relógio do app.

Fazer requisição a cada 30 s **não** significa que a instituição publique nova observação a cada 30 s. No Cloud Run, instâncias sem CPU sempre alocada ou gatilho externo podem parar de executar polling após uma resposta; é preciso configurar execução contínua elegível, Cloud Scheduler/Jobs ou tarefa externa com controles adequados e IAM mínimo.

## Matriz de implementação e bloqueios por produto

| Fonte | Produto aplicável RJ | Código existente / adicionado | Condições para operar |
|---|---|---|---|
| Alerta Rio | Chuva por estações do município do Rio | `alerta-rio-source.mjs` e worker de chuva | `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=true`; verificar licença/uso de dados para o aplicativo; cobertura **somente município do Rio** |
| Defesa Civil / CEMADEN-RJ | Boletim municipal de risco hidrológico, 92 localidades conforme boletim | `cemaden-rj-source.mjs` | Ativar `BLAISE_CEMADEN_RJ_ENABLED=true` após validar fonte e termos, não transformar nível de risco em milímetros de chuva |
| INMET | Avisos CAP por área; estações de temperatura/vento/chuva no Android | `inmet-source.mjs`, `OfficialWeatherClient.kt` | `BLAISE_INMET_WARNINGS_ENABLED=true` para worker de **avisos**; leituras de estação ainda exigem coverage/time QA no app, não equivalem a cobertura total dos 92 municípios |
| Defesa Civil municipal Rio | Localização de sirenes e pontos de apoio | `defesa-civil-rio-assets.mjs` | `BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED=true`; **cadastro de sirenes não é aviso ativo** |
| Marinha CHM | Inventário de avisos de mau tempo em áreas marítimas | `chm-source.mjs` | `BLAISE_CHM_WARNINGS_ENABLED=true`; verificar zona/validade e autorização de redistribuição |
| USGS | Dois maiores abalos recentes globais, sem inferir impacto RJ | **NOVO:** `usgs-rj-earthquakes.mjs`, `rj-earthquakes-http.mjs`, app | Habilitar `BLAISE_USGS_EARTHQUAKES_ENABLED=true` e `BLAISE_RJ_USGS_PUBLIC_ENABLED=true` após testes; fonte USGS GeoJSON oficial e domínio permitido; **não gera aviso de tsunami** |
| INPE/CPTEC | Previsão por localidade; primeiro desempate por modelo | Hierarquia e reconciliação implementadas; **coletor vivo não integrado** | Obter URL HTTPS e código de cidade verificáveis, validar termos de integração comercial, horário/rodada de previsão |
| Windy | Previsão comparativa subsidiária | Hierarquia existente; **sem API autenticada em produção** | API/licença comercial, segredo no backend, identidade do modelo, hora de previsão, cotas e calibração independente |
| ANA / HidroWeb | Nível, vazão e histórico dos rios | Matriz, calculadora e regras; **sem coletor vivo confirmado** | Acesso ao serviço/API autorizado, IDs das estações RJ, unidade e atualidade |
| SGB/SACE | Níveis de cheia e avisos hidro | Regras; **sem coletor vivo confirmado** | Contrato do produto/boletim, identificação de estações e bacias, integração e testes |
| NOAA | Produtos satelitais, Atlântico, massa de ar, ciclone, meteotsunami quando aplicável | Regras; **sem grade/ingestão ao vivo confirmada** | Identificar produto oficial, extensão RJ, resolução, política de uso e licenciamento; nunca usar modelo como sensor |
| Copernicus Marine | Ondas, correntes, temperatura do mar, swell | Painel/especificação; **sem serviço autenticado em produção** | Credenciais de dados e produto, fontes e atribuição, direitos e limites |
| EUMETSAT | Nuvens, ciclones/Atlântico | Especificação; **sem serviço autenticado em produção** | Licença e produto aplicável, georreferenciamento/tempo; imagens externas não são necessárias para mapa próprio |
| COR.Rio/CET-Rio | Trânsito, alagamento, interdição | Interface e especificação; **sem ocorrências geográficas ao vivo confirmadas** | Feed oficial público/API autorizada, horário, tipologia e condições de redistribuição |

**INEA excluído da operação:** não reativar rotinas históricas pela presença de arquivos legados.

## Duas fontes e desempate

Temperatura, vento e chuva seguem **Alerta Rio (só cidade Rio) → Defesa Civil competente → INMET → INPE/CPTEC (previsão para contextualizar divergência) → Windy (quando INPE inconclusivo)**. Dois sensores oficiais realmente compatíveis podem embasar cálculo ponderado; uma previsão não substitui uma medição nem compõe média observacional. Evento/aviso de tempestade não se determina por média numérica. O sistema deve preservar fonte e horário e identificar dados inválidos, vencidos ou conflitantes. Sem medições reais não existe medição científica inventável.

## Gate do backend e aplicativo

Coleta: `backend/src/official-source-worker.mjs` usa tarefas opt-in e `60_000ms` normal / `30_000ms` severo, sujeitos ao intervalo de publicação e às permissões de cada agência. A leitura interna `GET /v1/internal/rj-sources/readiness` é protegida por **Google OIDC** e indica tarefas/estados dos produtos efetivamente recentes; **nenhum sinal de um único conector autoriza afirmar que todas as fontes funcionam**.

USGS (novo):
- Feed oficial `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson`; a documentação USGS descreve feeds atualizados regularmente e uso programático.
- Sem imagem copiada e sem tokens de assinatura; a rota `GET /v1/public/rj-earthquakes` responde somente quando a tarefa real e o endpoint foram explicitamente habilitados e o feed está atual.
- Android usa a mesma base HTTPS de `BLAISE_RJ_PUBLIC_STATUS_BASE_URL`, com repetição a cada 60 s enquanto o app está visível e ligado. A tela mostra os dois maiores eventos do dia que vieram da fonte real, ou o texto "consulta não ativada/sem resposta".
- **Jamais** inferir maremoto, tsunami, sensação no Brasil ou risco RJ com base apenas na propriedade `tsunami` da USGS.

## Faltam para homologação total

- Infraestrutura/credenciais e verificação de **Cloud Run real**, configurações das flags e CPU/gatilho para polling contínuo;
- Autorizações por produto, incluindo INPE/Windy e eventuais redistribuições de avisos oficiais;
- Integrações reais ANA, SGB/SACE, INPE, Windy, NOAA, Copernicus, EUMETSAT e trânsito;
- Dados espaciais meteorológicos quantitativos suficientes para o **mapa de radar próprio**;
- Testes de rede, dispositivo físico, voz feminina e loja/assinatura antes do lançamento.

A conclusão desta PR será **código integrado e testes automatizados**, não uma falsa alegação de que todas as agências já transmitem dados à versão publicada.
