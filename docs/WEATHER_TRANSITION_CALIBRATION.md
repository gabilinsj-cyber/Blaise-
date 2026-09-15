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

## Execução

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

## Estado atual

Os testes unitários usam dados sintéticos somente para validar a matemática e o comportamento fail-closed. **Nenhum backtest histórico real é declarado por este código.** Até um arquivo histórico observado, verificável e revisado ser executado, o estado operacional do estimador continua `UNCALIBRATED_UNTIL_HISTORICAL_BACKTEST` / `NOT_RUN` para confiança de produção.
