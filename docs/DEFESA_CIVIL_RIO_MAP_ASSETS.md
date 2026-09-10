# Defesa Civil Municipal do Rio — ativos do mapa de emergência

Este pacote adiciona um contrato fail-closed para os ativos geográficos oficiais da Defesa Civil Municipal do Rio de Janeiro que o Blaise V6 RJ precisa exibir no mesmo mapa de risco.

## Fonte oficial

Host permitido: `pgeo3.rio.rj.gov.br`.

Serviço ArcGIS: `Defesa_Civil/Defesa_Civil/FeatureServer`, item `89bec83021764d0e9c723f30d390908c`.

Camadas usadas:

- `0` — Sirenes do Sistema de Alerta e Alarme Comunitário;
- `1` — Pontos de apoio do Sistema de Alerta e Alarme Comunitário.

A consulta solicita somente HTTPS, `where=1=1`, campos allowlisted, geometria pontual, ordenação por `objectid`, resposta JSON e reprojeção explícita para WGS84 (`outSR=4326`). Redirecionamentos, host diferente, porta não padrão, corpo acima do limite, conteúdo não JSON e resposta ArcGIS com erro são rejeitados pelo contrato comum de fontes.

## Validação

O parser exige:

- geometria `esriGeometryPoint` e referência espacial 4326;
- no máximo 2.000 registros por camada e ausência de `exceededTransferLimit=true`;
- `objectid`, `globalid` e códigos operacionais válidos e sem duplicação;
- nomes e textos limitados, sem caracteres de controle;
- coordenadas finitas dentro de uma caixa geográfica ampla e conservadora para o município do Rio;
- flag de pluviômetro somente `0`, `1` ou ausente.

O resultado normalizado mantém somente os campos necessários para mapa, autoria e orientação do usuário. Cada camada recebe SHA-256 determinístico para detectar mudança de inventário sem depender de histórico de localização do usuário.

## Evidência e execução

O workflow `Defesa Civil Rio Map Assets Probe` é `workflow_dispatch` manual-only. Por padrão ele registra `NOT_RUN_EXPLICIT_APPROVAL_REQUIRED` e não consulta a fonte externa. Quando `execute_live_probe=true`, usa Node 24.20.0, consulta as duas camadas públicas oficiais, valida o contrato e arquiva apenas status, contagens e digests; não arquiva o inventário geográfico completo.

O CI normal cobre parser, limites, duplicação, geometria, URL oficial e wrapper de fetch com respostas simuladas. Um PASS do CI não equivale a um PASS da consulta ArcGIS ao vivo.

## Escopo

Esta integração cobre a infraestrutura de mapa da Defesa Civil Municipal do Rio. Ela não substitui alertas meteorológicos P0, não afirma estado operacional de cada sirene e não extrapola esses dados para outros municípios do Estado. Estado operacional, acionamento de sirene e avisos oficiais continuam exigindo fonte operacional própria e evidência separada.
