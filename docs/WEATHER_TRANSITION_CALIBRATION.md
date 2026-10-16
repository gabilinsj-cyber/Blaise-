# Blaise V6 — calibração histórica do estimador Sul → Sudeste → RJ

## Objetivo

O estimador probabilístico de 24 h / 48 h permanece deliberadamente marcado como não calibrado até existir evidência histórica observada suficiente. Esta camada fornece o backtest que mede a qualidade das probabilidades sem permitir que testes sintéticos ou metadados incompletos liberem rótulos de confiança em produção.

Ela **não cria alertas**, não altera P0 e não substitui fontes oficiais do RJ. O backtest avalia somente a qualidade histórica da orientação probabilística.

## Métricas

`evaluateWeatherTransitionBacktest()` avalia separadamente 24 h e 48 h e produz:

- Brier score;
- Brier skill score contra a climatologia observada no próprio conjunto;
- expected calibration error (ECE) em pontos percentuais;
- máximo erro de calibração entre bins;
- reliability bins de 10 pontos percentuais;
- matriz de classificação no limiar editorial de 50% (`precision`, `recall`, `specificity`);
- quantidade de amostras, resultados positivos/negativos e alvos territoriais distintos.

Os limites atuais são **gates de engenharia conservadores**, não uma alegação científica universal: mínimo de 200 amostras por horizonte, 25 eventos positivos, 25 negativos, 10 alvos distintos, Brier ≤ 0,22, ECE ≤ 10 pp e Brier skill não inferior à climatologia.

## Integridade temporal

Cada amostra exige `issuedAtMillis`, `validAtMillis`, `horizonHours`, `targetId`, `probabilityPercent` e `observedAffected`. O lead time precisa corresponder a 24 h ou 48 h com tolerância máxima de 4 h. Isso impede misturar previsões de horizontes diferentes no mesmo score.

## Gate de evidência

Mesmo quando as métricas estatísticas passam, o rótulo de confiança em produção continua bloqueado até o conjunto possuir simultaneamente:

- `kind: historical_observed`;
- SHA-256 calculado do arquivo de entrada;
- proveniência verificada;
- pelo menos uma fonte observacional identificada;
- período histórico explícito;
- revisão independente aprovada.

Sem esses itens, o resultado pode ser `PASS_STATISTICAL_GATES_BUT_PRODUCTION_LABEL_BLOCKED`, mas `productionConfidenceLabelAllowed` permanece `false`.

## Execução local

Formato do arquivo de entrada:

```json
{
  "datasetEvidence": {
    "kind": "historical_observed",
    "provenanceVerified": true,
    "independentReviewApproved": true,
    "observationSourceIds": ["INMET", "ALERTA_RIO"],
    "periodStartMillis": 1704067200000,
    "periodEndMillis": 1767139200000
  },
  "samples": []
}
```

O digest não precisa ser fornecido no JSON; o runner calcula o SHA-256 dos bytes reais do arquivo:

```bash
cd backend
node scripts/backtest-rj-weather-transition.mjs /caminho/historico.json evidence/weather-transition-backtest.json
```

Para um gate que deve falhar quando a calibração ainda não estiver apta a liberar rótulo de confiança:

```bash
node scripts/backtest-rj-weather-transition.mjs /caminho/historico.json evidence/weather-transition-backtest.json --require-production-pass
```

## Gate manual de conjunto histórico em Cloud Storage

O workflow `.github/workflows/weather-transition-calibration.yml` cria o caminho operacional para executar o backtest com evidência histórica externa sem incluir conjuntos de produção no repositório.

Regras do gate:

- é somente `workflow_dispatch`; não existe `push`, `schedule` ou execução automática;
- `execute_backtest=false` é o padrão e registra `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED`;
- quando aprovado, autentica no Google Cloud exclusivamente por OIDC/WIF, sem chave JSON permanente;
- usa uma identidade separada configurada em `BLAISE_GCP_CALIBRATION_SERVICE_ACCOUNT`, que deve receber apenas leitura do objeto/bucket histórico necessário;
- aceita somente um `gs://...json` explícito e limitado;
- registra metadados do objeto antes e depois do download e falha se a `generation` mudar durante a cópia;
- compara o tamanho declarado do objeto com os bytes realmente baixados;
- gera SHA-256 local dos bytes usados pelo backtest e uma evidência sanitizada de proveniência sem publicar a URI completa do bucket;
- executa sempre `--require-production-pass`; portanto um conjunto estatisticamente insuficiente, sem proveniência válida ou sem revisão independente mantém o workflow bloqueado;
- publica `blaise-weather-transition-calibration-evidence` mesmo em falha, contendo `gate.txt`, relatório do backtest, stderr controlado e proveniência sanitizada quando disponíveis.

Variáveis esperadas para a execução externa:

- `BLAISE_GCP_PROJECT_ID`;
- `BLAISE_GCP_WIF_PROVIDER`;
- `BLAISE_GCP_CALIBRATION_SERVICE_ACCOUNT`.

A identidade de calibração não deve reutilizar permissões amplas de deploy do Cloud Run. O princípio é leitura mínima do conjunto histórico e nenhuma capacidade de alterar fontes, P0, produção ou tráfego.

## Estado atual

Os testes unitários usam dados sintéticos somente para validar a matemática e o comportamento fail-closed. **Nenhum backtest histórico real é declarado por este código.** O workflow manual cria o caminho verificável para executar esse conjunto quando ele existir, mas não converte preparação em evidência de produção. Até um arquivo histórico observado, verificável e revisado ser realmente executado com PASS, o estado operacional do estimador continua `UNCALIBRATED_UNTIL_HISTORICAL_BACKTEST` / `NOT_RUN` para confiança de produção.
