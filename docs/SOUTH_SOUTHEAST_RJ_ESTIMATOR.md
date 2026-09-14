# Blaise V6 — estimador Sul → Sudeste → RJ (24 h / 48 h)

## Objetivo

Esta camada transforma orientação numérica já normalizada em uma **estimativa probabilística de mudança de tempo** para 24 h e 48 h. Ela acompanha sinais que avançam do Sul em direção ao Sudeste e, quando fontes oficiais locais confirmam a chegada ao limite/território do Estado do Rio de Janeiro, recalcula os municípios com evidência local recente.

O resultado é orientação probabilística do Blaise. **Não é alerta oficial, não substitui Defesa Civil/INMET/Alerta Rio/INEA/CHM e nunca pode criar P0 sozinho.** A precedência das fontes oficiais locais do RJ permanece inalterada.

## Entradas

`buildSouthToSoutheastRjEstimate()` recebe um único evento meteorológico (`changeType`) e quatro blocos:

- `southeastGuidance`: orientação por SP/MG/RJ/ES para 24 h e 48 h;
- `rjGuidance`: orientação por código IBGE de município e `subregionId` fornecido pela camada territorial;
- `rjBoundaryEvidence`: confirmação oficial recente de que o sistema alcançou o limite/território do RJ;
- `rjLocalSignals`: observações/radar/alerta oficiais locais, por município, usadas somente depois da confirmação de limite.

Cada orientação de modelo informa a probabilidade já derivada pelo adaptador/modelo, o número de membros de ensemble, a fração de influência atribuída ao Sul (`southInfluence`) e, quando disponíveis, ETA, variação de temperatura, precipitação, rajada e pressão. A função aceita apenas modelos registrados na camada Sul-América e descarta orientação vencida de acordo com a política de frescor da própria fonte.

## Método estatístico

A probabilidade é a média ponderada de fontes/modelos independentes. O peso usa a prioridade registrada da fonte, a influência atribuída ao Sul e a raiz do número de membros do ensemble, evitando que um ensemble grande domine linearmente outro modelo independente.

A incerteza de 90% combina:

1. variância finita da probabilidade de cada ensemble;
2. divergência entre modelos/fontes independentes;
3. piso conservador por horizonte, maior em 48 h e menor quando já existe evidência oficial local recente.

O Blaise devolve `probabilityPercent`, `marginOfErrorPp` e o intervalo `interval90Percent.low/high`. ETA e efeitos meteorológicos também saem como estimativa `±` erro. Os pisos de incerteza são uma política conservadora e **não são uma calibração observacional**.

## Calibração histórica obrigatória

Até existir backtest histórico suficiente por horizonte/região/evento, a saída permanece marcada como `UNCALIBRATED_UNTIL_HISTORICAL_BACKTEST`. Antes de usar rótulos como “alta confiança”, a produção deve verificar confiabilidade com eventos observados (por exemplo Brier score/reliability bins) e ajustar os adaptadores de probabilidade. A camada não mascara essa ausência de calibração.

## Recalculo ao entrar no RJ

Fases operacionais:

- `UPSTREAM_24_48H`: orientação Sul/Sudeste, sem confirmação de entrada no RJ;
- `RJ_BOUNDARY_CONFIRMED_AWAITING_LOCAL_EVIDENCE`: a chegada foi confirmada, mas ainda falta evidência local municipal recente;
- `RJ_BOUNDARY_RECALCULATED_WITH_LOCAL_EVIDENCE`: a confirmação e os sinais locais oficiais estão disponíveis e entram no cálculo com peso maior e decaimento em 48 h.

A confirmação de limite, sozinha, não aumenta artificialmente a probabilidade de todos os municípios. O recálculo municipal só muda com evidência local correspondente.

## Sub-regiões e municípios

O motor valida o código IBGE contra o catálogo canônico dos 92 municípios. `subregionId` não é codificado dentro do estimador: ele vem da camada territorial vigente, evitando congelar uma regionalização que possa mudar. Para cada sub-região o motor entrega:

- percentual esperado de municípios afetados (média das probabilidades municipais);
- margem média de probabilidade;
- quantidade e nomes dos municípios com probabilidade ≥ 50%.

O corte de 50% é apenas uma regra de apresentação de “provável”, não um limiar de alerta.

## Fail-closed

Uma estimativa municipal/estadual exige no mínimo duas fontes de modelo independentes. Com apenas uma fonte, fonte vencida, município desconhecido, horizonte diferente de 24/48 h, evidência local não oficial ou confirmação de limite vencida, a camada falha/retorna insuficiência em vez de fabricar certeza.
