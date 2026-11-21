# Blaise V6 RJ — sete campos meteoblue: revisão científica e contrato de publicação (21/11/2026)

**Escopo:** apenas branch `feature/rj-meteoblue-full-recovery-admin-ui-20261118` / PR #173 (draft). Nenhum merge, deploy, scheduler, pedido pago, mudança do APK/serviço atual, gravação no Firestore ou chamada adicional ao fornecedor. O contrato foi anexado ao coletor **privado**; não existe endpoint de publicação para clientes.

## Evidência disponível e limitações

- Uma chamada real `basic-6h`, Rio IBGE 3304557, em 19/11/2026: 29 horários válidos, sete campos estruturais presentes, unidade/horário/modelo/coordenada conferidos. `auditReadyForPrivateReview=true` significa revisão técnica de staging, **não** aprovação para clientes.
- Histórico recuperado do Firestore em 21/11/2026: 29 valores por campo, zero ausências. Chuva total e componente convectivo iguais em todos os 29 períodos à tolerância 0,001 mm; 14 deles com chuva. Exige revisão de semântica/modelagem do fornecedor, sem supor cópia pelo parser.
- Nova versão do parser armazena `sourceField` para diferenciar `data_6h.precipitation` de `data_6h.convective_precipitation`. O cache antigo **não contém** `sourceField`; a revisão marca falta de proveniência em vez de atribuí-la retroativamente.
- Dados são **previsões (P)**, não observações ou alertas. Não houve comparação quantitativa independente com observações regionais ou verificações externas; o direito de publicar dados aos clientes **não foi verificado**.
- O Firestore registrou uma reserva local acumulada de 4.000 créditos e saldo interno não reservado de 7.996.000; isso **não equivale** ao saldo real no fornecedor. Chave original foi exposta anteriormente; a versão 3 do Secret Manager não substitui a chave no serviço meteoblue.

## Sete campos e verificações

| Origem `data_6h` | Significado correto | Faixa técnica conservadora no parser | Revisão adicional |
|---|---|---|---|
| `precipitation` | Acumulado total de precipitação previsto no período precedente, mm/6h | 0–500 mm | Não transformar em chuva observada ou precipitação horária |
| `convective_precipitation` | Parcela convectiva prevista do acumulado, mm/6h | 0–500 mm | Componente > total: revisar; coincidência em todos os períodos úmidos: revisar sem zerar/modificar os valores |
| `precipitation_probability` | Probabilidade prevista, %, informação por ensemble | 0–100% | **Não** declarar erro apenas por discordar do acumulado determinístico |
| `windspeed_mean` | Velocidade média no período, km/h | 0–400 km/h | Unidades reconhecidas m/s são convertidas explicitamente; nunca confundir com rajada |
| `windspeed_max` | Maior velocidade prevista no período, km/h | 0–400 km/h | Valor abaixo da média no mesmo intervalo é sinal de revisão, não justificativa para inventar rajada |
| `relativehumidity_mean` | Umidade relativa média prevista, % | 0–100% | Manter ausências como ausências; não converter `null` em 0% |
| `sealevelpressure_mean` | Pressão média reduzida ao nível do mar, hPa | 800–1.100 hPa | Não confundir com pressão observada em estação |

Faixas são **critérios técnicos conservadores do parser**, não os limites físicos absolutos da atmosfera nem garantias de exatidão do fornecedor.

Além disso, a revisão verifica: `sourceId`, categoria P, IBGE homologado para a única sonda, `basic-6h`, correspondência exata dos sete nomes e `sourceField`, número de períodos por série, 6h exatas entre timestamps UTC, origem, ausência de números inválidos, modelos/horários/unidades/coordenadas e expiração do cache operacional de 6h. Nenhum dado histórico recebe automaticamente condição de atual.

Documentação meteoblue consultada **sem chamar a API de previsão**:
- https://docs.meteoblue.com/en/meteo/variables/weather-variables (acumulados, probabilidade e precipitação convectiva)
- https://docs.meteoblue.com/en/weather-apis/forecast-api/overview (modelrun_utc, modelrun_updatetime_utc e proveniência mLM)

## Contrato de publicação: BLOQUEIO PERMANECE

O módulo puro `backend/src/rj-meteoblue-free-publication-contract.mjs` expõe:
- `assessMeteoblueFreePublication(forecast,...)` — apenas nomes, contagens e motivos de revisão; **nunca imprime valores da previsão, credenciais, URLs assinadas ou dados pessoais**.
- `METEOBLUE_FREE_PUBLICATION_CONTRACT` — descreve staging privado, sete campos P, uso comercial não verificado e aprovação científica/release não concedida.
- `buildMeteoblueFreeClientPayload(...)` — sempre retorna `forecast=null`, `weather=null`, `alerts=null`, `clientPayload=null`, `publishedToSubscribers=false`, independentemente de flags passadas.

O coletor privado `rj-meteoblue-free-collector.mjs` agora referencia explicitamente esse contrato por `collector.publicationContract` e oferece uma projeção **somente bloqueada** em `collector.buildClientPayload`. Isso prepara um futuro limite de saída **sem criar rota pública** e sem ativar a coleta. Nenhum valor pode ser liberado automaticamente por um simples `true` de ambiente, por cache ainda fresco ou pela aprovação da estrutura de dados.

**Mesmo se as sete validações estruturais passarem, o módulo retorna `BLOCKED_PRIVATE_STAGING_ONLY`.** Para outra decisão, seria necessário um futuro processo separado: direitos contratuais, homologação científica verificável, segurança da credencial exposta, comparação com fontes externas autorizadas, revisão do produto, e autorização explícita de implantação. Nenhuma dessas etapas é declarada cumprida aqui.

## Testes sem créditos

`backend/test/rj-meteoblue-free-publication-contract.test.mjs` cobre previsões completas e parciais, origem por campo, dias vencidos, coerência das duas chuvas, vento médio/máximo, probabilidade por ensemble, fraude de flags, dados ausentes e tentativa explícita de publicação. Em `rj-meteoblue-free-collector.test.mjs` existe um teste da projeção bloqueada após parse de sucesso. CI em `.github/workflows/rj-meteoblue-free-offline-ci.yml` executa validações com Node 24, sem API key e sem chamada meteorológica.

**Próximos trabalhos possíveis sem consumo:** inspeção administrativa da licença comercial, documentar limites reais da Free Weather API, revisão independente da semântica convectiva, e conferência final dos resultados de CI. Nunca acionar `--live --one-credit` para executar esses testes.

**Status operacional:** PR #173 draft; coletor público desligado; sem alterações de cliente, Firestore, assinatura ou produção.
