# Blaise V6 RJ — validação das APIs Free Visual Crossing e WeatherAPI.com (22/11/2026)

**Trabalho isolado:** branch `feature/rj-free-visualcrossing-weatherapi-validation-20261122`, filha da PR #174. Nenhuma atualização Cloud Run, App Cliente, Google Play, cobrança, deploy, merge, alteração de credenciais ou tráfego 99%/1%. Os 14 agentes, calculadora científica Blaise, 92 municípios e interface original permanecem intocados por esta auditoria. Chaves jamais são mostradas em logs, captura, APK ou Git.

## Resultado consolidado por fonte

| Fonte | Evidência real | Última constatação | Estado para cliente |
|---|---|---|---|
| **Visual Crossing Free** | **SIM**, 19/11/2026, consulta única `PRIVATE_REAL_SAMPLE_READY`, `queryCost=1`, 36 horas de previsão, 7/10 campos atuais E numéricos, coordenadas e horário verificados | Firestore `staging_one_rio_20261119`: 1/1 chamada reservada. Painel da Visual Crossing: 1 consulta, custo 1, 0 falhas. Chave anteriormente exibida em captura; não repetir nem rotacionar sem autorização. Reavaliar antes de nova coleta | Sem publicação, sem cache real desta amostra e sem prova 92/92 |
| **WeatherAPI.com Free** | **NÃO**, nenhuma resposta real autenticada exibida/registrada até esta recuperação | E-mail WeatherAPI.com de 20/11: conta pronta, chave ainda sem primeira chamada. Página oficial Free: 100.000 chamadas/mês, 10/s, corrente e previsão 3 dias, uso comercial com atribuição, API atual estimativa E e previsão P | Novo parser e teste único OFF, 0 solicitações reais por esta PR |
| **OpenWeather / Agente 13** | Usuária confirmou em 22/11 que chave foi validada e que o limite **operacional aprovado pelo projeto é uma única chamada por dia** | Ajustadas as constantes do projeto para **1/dia UTC global** e a transação Firestore para aceitar exclusivamente `maximum=1`. Antigos cálculos de 900 não autorizam uso. Regra de fallback térmico e chave Cloud Run v2 mantidas; **não** executar consulta agora | Contingência OFF sem autorização de release; não usar para 35 minutos em 92 cidades |

### Visual Crossing: 7 campos reais e pendências

A resposta do ensaio de 19/11 forneceu **temperatura, sensação térmica, umidade, ponto de orvalho, vento médio, probabilidade de precipitação e pressão**. Ausentes na leitura de corrente: rajada, chuva atual e risco severo. **NULO NÃO É ZERO.** CurrentConditions são agregados E, previsões horárias P, não observações de estação física O. A consulta de um registro já consumiu sua reserva, portanto não há autorização para outra tentativa hoje. Os resultados foram validados sem persistência como valores atuais para cliente: uma validação histórica NÃO pode ser mostrada como medição de hoje.

`backend/src/rj-visual-crossing-free-92-rollout.mjs` permanece em dry-run com Firestore futuro: 92 cidades, até oito rodadas de três horas (736 registros/dia), teto interno 800/1000 no plano. A política explícita do usuário é preservar a chave existente; somente rotação quando autorizada. Condições de uso comercial, atribuição, origem e tempo precisam ser novamente checadas antes de publicar.

### WeatherAPI.com: código de validação preparado

- `backend/src/rj-weatherapi-free-private.mjs`: parser sem rede por padrão de **uma chamada `forecast.json?days=1`** para Rio IBGE 3304557, que traz `location`, `current` e `forecast` horário juntos. Verifica latitude/longitude, `last_updated_epoch` (até 60 minutos, meta 30 minutos), unidades e plausibilidade física, temperatura `temp_c`, sensação `feelslike_c`, umidade, nebulosidade, vento, rajadas, pressão, chuva agregada, UV e códigos de condição de céu. Campos ausentes => `null`, nenhum alerta oficial.
- `backend/src/rj-weatherapi-free-one-shot-budget.mjs`: **uma única reserva atômica Firestore para toda a campanha**, não restabelecida à meia-noite. Falha Firestore/entitlement/segredo => **nenhuma chamada**. Reserva não reembolsável, inclusive caso HTTP/parse falhe.
- `backend/scripts/weatherapi-free-private-audit.mjs`: **sem parâmetros = `OFFLINE_NO_NETWORK`**, logs apenas status, campos presentes, idade do current, contagem de horas, origem E/P e status 30 min. **Somente** `--live --one-call --private-staging` com conta Free confirmada, sem top-up/cobrança, chave em variável de ambiente do Cloud Shell, Firestore autorizado e autorização consciente do operador. Nunca imprimir URL (a chave fica em query).
- `backend/test/rj-weatherapi-free-private.test.mjs`: simula localização, timestamps, campo nulo, céu parcialmente nublado/sol/nublado/chuva/trovoada, quota persistente entre dias e bloqueio quando falta segredo. Não toca a API.
- `backend/src/rj-weatherapi-free-92-plan.mjs`: planejamento antigo preservado: **92 × 24 × 31 = 68.448 chamadas/mês** (horário); 92 a cada 30 min = 136.896/mês (**acima do Free**). Uma camada 30 min apenas para duas cidades selecionadas poderia acrescentar ~1.488 chamadas/mês sobre a base horária se houver cache compartilhado, mas sem autorização de auto coleta ou garantia de observações novas.

### Proteção do segredo WeatherAPI.com

E-mail de boas-vindas **não comprova chave cadastrada no Secret Manager** nem o saldo na conta. Por esse motivo, a branch **não faz uma chamada real por conta própria**. Para avançar, no Google Cloud Shell consultar **somente metadados**:

```bash
gcloud secrets describe blaise-weatherapi-free-api-key --project=blaise-v6-rj --format='value(name)'
```

Se o segredo não existir, a titular precisará cadastrá-lo de modo protegido no Secret Manager, sem mostrar a chave em prints ou chat. Não rotacionar ou apagar outras chaves. Verificar no painel que a conta está Free (ou ainda Business Trial **gratuito de sete dias**), sem pagamento/top-up automático e há margem de 1 chamada. A execução real de **uma** consulta só deve ocorrer após essa confirmação e leitura da versão secret pelo operador, com flags explícitas e contador transacional. Não existe chamada paga executada por esta PR.

**Referências oficiais:**
- WeatherAPI.com Free: https://www.weatherapi.com/pricing ; contrato: https://www.weatherapi.com/terms ; campo atual: https://www.weatherapi.com/docs/realtime-api/ ; previsão: https://www.weatherapi.com/docs/forecast-api/
- Visual Crossing Free: https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/ ; Timeline queryCost: https://www.visualcrossing.com/resources/documentation/weather-api/what-is-the-querycost-parameter/

## Publicação permanece bloqueada

Nenhuma resposta WeatherAPI.com real, chave/segredo Firestore de backend validado, saldo mensal, nem atualização garantida a cada 30m para todos os 92 municípios; não ligar automaticamente. Visual Crossing validada historicamente, mas não ativa para todos; OpenWeather uma única chamada diária em todo o Blaise. Sem dado verificado, o aplicativo mostra `Indisponível`.
