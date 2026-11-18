# Blaise V6 RJ — arquivo mestre de continuidade: memória, ciência, 14 agentes e interface

**Data da consolidação:** 18/11/2026 (BRT). **Projeto:** Blaise V6 RJ — Clima e Tempo, 92 municípios do Rio de Janeiro e Atlântico adjacente. **Natureza:** índice auditável de documentos/código/histórico, **não** transcrição literal de todos os chats, cópia de todas as imagens/arquivos ou prova de 14 agentes ativos/implantação.

## Regra de integridade permanente

- **Não apagar nem sobrescrever:** `main`, `~/Blaise-RJ`, `~/blaise-rj-safety/`, worktrees anteriores, aplicativos instalados, APK/AAB, revisões de produção Cloud Run ou credenciais no Secret Manager. Sem `reset --hard`, `clean -fd`, deploy, merge, rota de tráfego ou compra não autorizada.
- Não misturar projeto RJ com Paraná ou “Blaise & Ben — Alemanha”.
- Nenhum dado meteorológico ilustrativo recebe status real: falta/expiração/erro = **Indisponível**, nunca zero; O = observação, E = estimativa, P = previsão, com origem, licença, município, unidade e carimbo/rodada.
- Código de cálculo, painel de arquivo e CI verde **não comprovam dados vivos, agendamento, APK liberado ou 14 processos autônomos**.
- Memória/ciência/cotas, histórico de checagens e parâmetros administrativos ficam apenas no APK ADMIN + backend com autenticação; não guardar histórico de voz, localização ou uso pessoal.
- Fontes antigas do repositório **não** são autorização de reativação. Política recente: DWD/ICON para previsão térmica, OpenWeather/Agente 13 como contingência térmica, HG Brasil Pro somente após contrato, NOAA para mar/satélite/raios, meteoblue Free mLM `basic-6h` somente comparação privada. INMET/CEMADEN para comparação interna; órgãos oficiais e portais segundo política atual de *links de consulta*, não medidores. EUMETSAT, NASA, JAXA, INEA, Marinha, Windy, Copernicus direto e Zoom Earth excluídos da coleta atual.

## 1. Fontes do acervo técnico — não perder partes em branches distintas

### Branch `main` (história original preservada, mas com fontes antigas)
- [Registro original de dez agentes](https://github.com/gabilinsj-cyber/Blaise-/blob/main/backend/src/rj-agent-registry.mjs) — contrato `SPECIFIED_NOT_AUTONOMOUSLY_DEPLOYED`, papéis 1–10, sem processos ativos comprovados.
- [Plano original de orquestração](https://github.com/gabilinsj-cyber/Blaise-/blob/main/backend/src/rj-agent-orchestration.mjs) — roteamento condicionado, não execução automática.
- [Especificação mestre 10/10](https://github.com/gabilinsj-cyber/Blaise-/blob/main/docs/BLAISE_V6_RJ_MASTER_SPEC_20261010.md) — nomes/categorias/funcionalidades; contém fornecedores excluídos depois.
- [Calculadora científica original](https://github.com/gabilinsj-cyber/Blaise-/blob/main/backend/src/rj-scientific-calculator.mjs), [física avançada](https://github.com/gabilinsj-cyber/Blaise-/blob/main/backend/src/blaise-rj-advanced-physics.mjs) e [política Android original](https://github.com/gabilinsj-cyber/Blaise-/blob/main/app/src/main/java/br/com/blaise/rj/ScientificDashboardPolicy.kt). **Esses três arquivos não estão na branch de desenvolvimento atual**; comparar/testar antes de portar. Nunca copiar cegamente, pois têm contexto e fontes desatualizados.

### Branch de desenvolvimento ativa desta consolidação (PR #173, draft)
- [PR #173](https://github.com/gabilinsj-cyber/Blaise-/pull/173) -> base PR #172 -> base PR #171: `feature/rj-meteoblue-full-recovery-admin-ui-20261118`.
- `backend/src/blaise-scientific-kernels.mjs`, `backend/src/blaise-marine-kernels.mjs`, `backend/src/blaise-scientific-jobs.mjs`, `backend/src/blaise-scientific-access.mjs`, `backend/src/blaise-scientific-http.mjs`, `backend/src/blaise-scientific-store.mjs`.
- `app/src/admin/java/br/com/blaise/rj/ScientificMemoryPolicy.kt`, `AdminScientificActivity.kt`, `AdminCollectorReadiness.kt`, **`AdminAgentsArchive.kt`**. Tests in `app/src/testAdmin/java/br/com/blaise/rj/`.
- `app/src/main/java/br/com/blaise/rj/MainActivity.kt`, `FinalDashboardSpec.kt`, `OfficialAlertRibbonPolicy.kt`, `WeatherSourceResponsibility.kt`; IBGE original `app/src/main/java/br/com/blaise/rj/geo/RjMunicipalMap.kt`.
- Referências completas: `docs/RJ_HG_BRASIL_CHAT_RECOVERY_AND_UI_20261118.md`, `docs/RJ_BLAISE_V6_CROSS_CHAT_RECOVERY_20261118.md`, `docs/RJ_METEOBLUE_RECUPERACAO_TOTAL_INTERFACE_PREPARACAO_19NOV_20261118.md`, `docs/RJ_ADMIN_SCIENTIFIC_MEMORY_OFFICIAL_ALERTS_20261117.md`, `docs/RJ_CIENTIFICO_MEMORIA_E_ALERTAS_SUPERIORES_20261117.md`.
- Biblioteca do usuário: `Referencia_Definitiva_Blaise_V6_RJ_atualizada.md` (imagem oficial `1000007912.png`, aprovada 28/09), `Blaise_V6_RJ_Memoria_Consolidada_2026-11-17.md`, `Blaise-V6-RJ-consolidacao-interface-2026-10-28.md`, `Blaise_V6_RJ_Perguntas_Assistente.md`, Baseline Técnica Mestre v1.2.0. **Arquivos Library não foram movidos/copiados para GitHub**, apenas indexados.

## 2. Inventário histórico de 14 agentes (sem afirmar 14 processos ativos)

O primeiro registro verificado no código de `main` contém **dez papéis funcionais**. Conversas posteriores do projeto especificaram os papéis **11–14**; o inventário novo registra os 14 **no aplicativo administrador** sem ligá-los em execução. Os nomes 9–10 são rótulos funcionais do histórico, não nomes próprios originais confirmados.

| Nº | Papel | Responsabilidade principal | Estado sustentado |
|---:|---|---|---|
| 1 | **Blaise Sentinel RJ** | Integridade/licença/horário/território das fontes | Bibliotecas e contratos parciais; execução autônoma não comprovada |
| 2 | **Blaise Vector RJ** | Física e cálculos científicos | Kernels reais testáveis, mas sem entradas operacionais para todos |
| 3 | **Blaise Fusion RJ** | Fontes comparáveis e divergências | Bibliotecas condicionais; pesos reais dependem de calibração |
| 4 | **Blaise Track RJ** | Trajetória, direção, velocidade, ETA | Kernels condicionais; radar real e skill pendentes |
| 5 | **Blaise Hydro RJ** | Chuva, rios, cotas, cheias, alagamentos | Integrações instrumentais pendentes |
| 6 | **Blaise Ocean RJ** | Ondas, swell, SST, ciclones e ressacas | NOAA staging; publicação não comprovada |
| 7 | **Blaise Seismo RJ** | Sismos e avaliação condicionada de tsunami | Requer monitoramento/alerta independente |
| 8 | **Blaise Audit RJ** | Verificações científicas e risco de alarme falso | Testes parciais; sem executor autônomo confirmado |
| 9 | **Correção Horária RJ** | Regressões e integridade periódica | Rótulo funcional; agendamento não comprovado |
| 10 | **Auditoria Profunda RJ** | Segurança, escala, contingência e custos | Rótulo funcional; sem compras ou auditoria autônoma comprovadas |
| 11 | **IA Pesquisa RJ** | Pesquisa documental e comparação técnica | Papel especificado posteriormente; executor não confirmado |
| 12 | **GeoFusion RJ** | 92 municípios, IBGE, estações e mapa próprio | Papel posterior; cartografia e validação parcial |
| 13 | **OpenWeather — contingência térmica** | Temperatura/sensação E, quota e cache | Código condicional preparado; ativação real pendente |
| 14 | **Auditor Meteorológico Internacional RJ** | Auditoria de produtos internacionais, INMET apenas comparação administrativa | Papel posterior; execução autônoma não confirmada |

Status de TODOS no inventário desta branch: `autonomouslyRunningVerified=false`. Isto **não elimina o código funcional** que existe em kernels/coletores; apenas recusa a alegação de 14 agentes rodando sem prova. Não converter as descrições legadas de agentes 1–10 em permissões atuais de fontes aposentadas.

## 3. Memória e calculadora científica — conteúdo preservado

### 19 métodos backend (bibliotecas numéricas)
1. **Termodinâmica/hidrologia (5):** `equivalentPotentialTemperatureApprox` (θe aproximada), `clausiusClapeyronDerivative`, `precipitableWater` (PWAT da camada fornecida), `referenceEvapotranspirationDaily` (FAO56), `soilWaterBalance`.
2. **Vento/tempestade/radar (7):** `neutralMeanWindProfile`, `calibratedTurbulentGust`, `bulkWindShear`, `stormRelativeHelicity`, `horizontalWindDiagnostics`, `stationPressureTendency`, `calibratedKdpRainRate`.
3. **Estatística/calibração (2):** `calibratedMos`, `scalarKalmanUpdate`.
4. **Oceano/física marinha (5):** `oceanWindStress`, `tropicalCycloneHeatPotential`, `significantWaveSpectrum`, `linearWaveDispersion`, `conditionalMarineTravelTime`.

**Restrições:** algoritmos calibrados exigem parâmetros locais/entradas reais, SRH/cisalhamento não confirmam tornado, KDP não é radar operacional por si, TCHP não prova intensificação, ondas e propagação não são alerta de tsunami. Não classificar esses 19 como 19 simuladores meteorológicos operacionais.

### Cinco diagnósticos no APK administrativo
- Magnus: ponto de orvalho.
- VPD: déficit de pressão de vapor.
- Stull: bulbo úmido estimado.
- Rothfusz: índice de calor, somente no domínio aplicável.
- Vento-frio: sensação estimada para frio e vento suficientes.

Local: `ScientificMemoryPolicy.kt` na variante `admin`, com autenticação `blaise_admin`; entrada manual não é observação meteorológica nem previsão, não gera alerta nem é publicada. Estado sem entradas reais: **Indisponível**. Não exibir fórmulas internas nem painel privado no cliente. Cálculo automático atual tem restrições de fonte e validade; não inferir resultados de dados sintéticos.

### Ciência histórica adicional
As extensões anteriores documentam CAPE/CIN, LCL/LFC/EL, radar polarimétrico, advecção, razão de mistura, hipsometria, perfis, gradientes, correntes e simulações condicionadas. **Nem todos estes algoritmos têm executor ou dados de produção nesta branch.** Preservar documentação e código `main` para revisão de portabilidade, sem prometer capacidade pronta.

## 4. Interface original completa — referência, não clone nem números de exemplo

- **Identidade:** azul-marinho com detalhes dourados/neon; `Blaise V6 RJ — Clima e Tempo`, **LIGADO** verde por padrão, modo silencioso manual, avatar/voz, microfone e perguntas em português (“Blaise” = *bleiss*).
- **Composição:** cidade 1 à esquerda, mapa do RJ próprio (92 IBGE) dominante no centro, cidade 2 à direita quando espaço permitir; vertical responsivo em celular. Não diminuir mapa ou gráficos para “cabê-los” nem substituir layout aprovado por versão primitiva.
- **Navegação:** Início, Cidades, Mapa, Alertas, Trânsito, Mar e Ondas, Qualidade do Ar, Notícias, Histórico, Mais.
- **Painéis:** temperatura, sensação, chuva atual e prevista quando disponíveis, vento/rajadas, umidade, pressão, UV, mar e ondas, riscos hidro/geológicos, notícias RJ e uma internacional, dois eventos sísmicos e botão Mais; gráficos com séries **reais** e dados classificados O/E/P.
- **Radar:** quadros reais na janela de 30 min, fonte e hora por quadro, play/pause, sem inventar frames ou copiar mapa de terceiro. A política atual não autoriza reativar coleta municipal por simples existência de interface.
- **Alertas:** escala Blaise 1–5 somente com evidência, até 4 cartões prioritários e página de adicionais, frases próprias e links oficiais, nunca alertas inferidos de um link. Política de avisos pode variar entre registros históricos (2 ou 4 portais); a implementação atual `FinalDashboardSpec.officialAlertReferralIds` tem quatro links de consulta, que **não** tornam fontes oficiais provedoras de medições.
- **Cliente:** informação que passou por auditoria (valor, unidade, fonte específica, validade/hora) ou indisponível; não mostrar agentes, debate entre fontes, fórmulas ou saldo privado. No protótipo de desenvolvimento ainda há telas incompletas/controles de espera e testes de fidelidade visual/funcional pendentes.
- **Admin:** calculadora/memória, agora arquivo dos 14 papéis e status, relatórios de provedores/meteoblue e auditorias; acesso exclusivo do APK `br.com.blaise.rj.admin`, role Firebase e verificação de backend a implementar onde houver API administrativa.
- **Distribuição:** cliente até 400 MB; admin pode exceder. Não atualizar instalados ou publicar loja sem testes e aprovação.

## 5. Meteorologia, cotas, plano gratuito e outras decisões atuais

- Meteoblue Free Weather API: pacote `basic-6h`, 7 campos P privados, **10 milhões** de créditos gratuitos segundo registro de conta, expiração exibida 18/11/2027; **1 chamada / 4.000 créditos** documentados no painel por feed entre 03–18/11. Limite diário de chave exibido **10 milhões** (isto **não** é saldo real). Usuário **aprovou a intenção de reduzir para 4.000/dia na chave atual, sem troca**, mas **a alteração no painel ainda não está comprovada por nova captura**.
- Firestore de proteção: `trial_2026_11_18` com **0 reservas** quando consultado; teto interno 8M, 4 chamadas máximas UTC/dia, 24h/município, cache 6h; rede/admin real OFF. A chamada antiga de 4.000 ocorreu **fora** desse ledger.
- Chave meteoblue foi exibida em screenshot anterior. A escolha atual é manter a chave; isso não remove o risco de acesso indevido. Recomendação de proteção: limite externo 4.000/dia e rotação assim que permitido, sem revelar valor em chat, Git, APK ou logs.
- HG Brasil Pro: autorização escrita de uso comercial no app de assinantes, **R$49,90/mês anunciado**, 100 cidades, 20.000 chamadas/dia, 15 dias de previsão; **não contratado**. Climatempo Advisor: orçamento solicitado, nenhum plano contratado.
- DWD/ICON 92 pontos IBGE em PRs #163/#165; NOAA ondas/SST/GLM em PRs #166/#168/#170. São referências de código/staging, **não medidores reais de todos os 92 municípios em produção**. Agente 13 quota 900/dia, térmico apenas; sem ativar.
- Conectividade Cloud Run/Secret Manager/Firestore foi preparada anteriormente; não deslocar tráfego de produção, não afirmar que chave cloud ou plano não renovável está seguro sem auditoria real.
- Material detalhado da meteoblue em `docs/RJ_METEOBLUE_RECUPERACAO_TOTAL_INTERFACE_PREPARACAO_19NOV_20261118.md`, com histórico de testes e créditos.

## 6. Como retomar sem refazer ou perder nada

1. No GitHub, preservar `main`, branch PR #173 e outras PRs: cópia histórica original **não** equivale à branch de desenvolvimento consolidada. Para trazer cálculos legados, comparar arquivos lado a lado, atualizar contrato de fontes e escrever testes antes de portar.
2. Testar CI Android/back-end no commit que inclui este inventário; um workflow concluído em SHA anterior não prova o commit atual.
3. Confirmação no painel meteoblue de **limite diário configurado em 4.000** antes de teste live; conta Free e chave atual preservadas até decisão posterior. Não rodar `--live` enquanto a chave está exposta e o limite é 10M/dia.
4. Depois, uma única auditoria real privada com Firestore transacional, credencial do Secret Manager e sem dados pessoais; verificar sete campos/IBGE/unidades/horários/custo, não publicar resultados sem homologação.
5. Validação dos coletores DWD, NOAA, rios, alertas e contratos administrativos; completar mapa/gráficos/voz dos 92 municípios somente com dados e direitos verificados.
6. Inspecionar interface em aparelhos físicos, CI, APK cliente <=400MB, segurança/assinatura/cobrança/lojas, backups e release canário. O cliente original **não** deve ser sobrescrito antes de revisão explícita.

**NOTA:** preservar documentação é diferente de guardar todas as falas/imagens do chat. Este manifesto contém os melhores pontos de ligação verificados entre fontes, código, histórico e decisões; os arquivos e chats anteriores continuam em suas origens.
