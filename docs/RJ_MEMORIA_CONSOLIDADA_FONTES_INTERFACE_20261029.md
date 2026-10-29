# Blaise V6 RJ — memória técnica consolidada e matriz de integração
Atualizado em 29/10/2026. **Escopo exclusivo: Rio de Janeiro (92 municípios e Atlântico sudeste adjacente).**
Este registro é fonte de continuidade técnica, **não** autorização para deploy nem declaração de coleta LIVE.

## Decisões mais recentes e obrigatórias
1. **Excluir INEA e Marinha do Brasil/CHM do produto ativo**: nenhuma consulta, roteamento, medidor, tabela, resultado ao assinante ou coleta automática deve usá-las. Não reativar por flag; os registros históricos de Git/GitHub podem permanecer como evidência. Remover também Windy e Copernicus da **matriz marítima atual**, sem importar PRs antigos que os reintroduzam.
2. **Sete fontes marítimas aprovadas para futura verificação operacional por produto**: INMET; INPE/CPTEC; CEMADEN; Defesa Civil RJ; NOAA; JAXA/GSMaP; EUMETSAT. Aprovação da matriz não significa ingestão autorizada/ativa em produção. Validar licenças, geolocalização, unidade, UTC, janela, dados/avisos efetivos e independência.
3. **Privacidade da interface**: clientes/assinantes veem medidor, valor real ou indicação de ausência, fonte efetivamente utilizada quando aplicável, horário da última checagem e validade; não recebem catálogo técnico completo nem função individual de cada uma das fontes ou os dez agentes. Somente administradores acessam logs, auditoria e cálculo interno completo.
4. **Dados reais**: não fabricar leituras, não transformar previsão de modelo em observação de sensor ou em aviso oficial, não mostrar dado expirado como atual; validar por município/IBGE, sem misturar RJ com PR ou localidades vizinhas.
5. **Não perder trabalho**: não executar `git reset --hard`, `git clean -fd`, sobrescrever `~/Blaise-RJ` ou `git pull`/merge indiscriminados. Preservar alterações locais e backups.

## Itens prontos ou revisados, mas não necessariamente operacionais
- **PR #97**: integrada à `main` em 10/10/2026 — painel de referência, mapa próprio, motor científico e estrutura de fontes oficiais.
  https://github.com/gabilinsj-cyber/Blaise-/pull/97
- **PR #135**: integrada à `main` em 14/10/2026 — exibição de estados reais de conexão (não simular LIVE).
  https://github.com/gabilinsj-cyber/Blaise-/pull/135
- **Branch NOAA/Android enviada**: `test/rj-noaa-android-20261028`, commit `7086f22df1b2521a8f695afe3947d45ebc04702e`; 12 arquivos alterados, +160/-17 linhas no commit local relatado. Suporte ao medidor `Ondas NOAA`, cache, coleta/validação de GRIB, contratos do painel pago.
- **Testes locais**: 14 testes selecionados backend aprovados; sete testes de política marítima aprovados em `~/blaise-rj-marine-test/backend`. Estes números não certificam o aplicativo completo.
- **Cloud Run encontrado**: projeto `blaise-v6-rj`, serviço `blaise-v6-rj-backend`, região `southamerica-east1`; configurações NOAA anteriores sem `BLAISE_NOAA_WAVE_ENABLED` habilitado nas revisões inspecionadas. **Coleta NOAA contínua na produção e valores reais exibidos no APK não comprovados.**
- **Duas rotas de backend**: `/v1/data/dashboard` = painel pago; `/v1/data/municipalities` = painel estadual. Validar a resposta JSON da rota consumida pelo Android. No painel pago foi encontrado `marine` com `waveHeightM`, `units`, `source`, `nature`, `validAt`, `lastCheckedAt`, `expiresAt`, `latitude`, `longitude`.

## CI verificável da branch NOAA
Android CI: https://github.com/gabilinsj-cyber/Blaise-/actions/runs/40693276973
Executado em 28/10/2026, resultado **failure**:
- Job Android `verify`: `app:prepareDoraVoice`, `Hash mismatch: kokoro.tar.bz2`. Não desativar SHA-256; verificar o artefato upstream/licença/versão antes de alterar hash.
- Job `backend`: testes de sintaxe/unitários e backpressure passaram; build/smoke de contêiner falhou com `noaa_validity_mismatch`, devido à divergência entre hora do arquivo GRIB de teste e a seleção de horizonte. Manter validação real de hora; consertar fixture/teste e reproduzir.
- **Sem APK novo e sem deploy** até CI Android, backend e Runtime verdes.

## Divergência de versões — NÃO mesclar às cegas
`main` e `test/rj-noaa-android-20261028` divergiram (em consulta de 29/10: 62 commits à frente e 36 atrás, tomando main como base). A main inclui recursos que a branch NOAA não incorporou; esta contém trabalho NOAA ausente na main.
PRs posteriores como #101, #126, #129, #131, #132, #137 e #138 permanecem sem merge em suas verificações; **Draft não significa funcionalidade validada**.
Diversas PRs e arquivos históricos ainda citam INEA, Marinha, Windy e Copernicus e não podem ser usados como catálogo atual.

## Último ponto de trabalho local que NÃO está necessariamente no GitHub
Em conversa de 28/10/2026 à noite, arquivo **temporário** `/tmp/official-source-worker-test.mjs` estava em revisão para aposentadoria de INEA e CHM; `node --check` passou nas etapas 9–10, mas restavam referências INEA perto de linhas 505/528/529/551. **O arquivo real `~/Blaise-RJ/backend/src/official-source-worker.mjs` não havia sido confirmado como alterado por essas etapas.** Uma tentativa anterior gerou `SyntaxError: Illegal return statement` e foi revertida de backup. Não assumir que essa remoção foi concluída.
Backup das alterações rastreadas: `~/blaise-rj-safety/noaa-android-20261028.patch` (cerca de 21 KB). Backups `.bak` e arquivos não rastreados ficam fora desse patch.

## Interface aprovada a preservar e integrar somente quando real
- Topo `BLAISE V6 RJ`, botão `LIGADO`, personagem compacto, campo `Como posso ajudar?` com microfone e envio automático ao final da fala.
- Cidade 1 / Cidade 2 distintas, 92 municípios RJ, temperatura, térmica e chuva observadas com tempos; amanhã, 48h e fim de semana quando houver produto válido.
- Faixa de alertas 1–5 por cidade e páginas dedicadas; radar Sumaré real 30 min/2 min por quadro, com fonte e timestamp, sem interpolar ou inventar cobertura.
- Gráficos de histórico/atual, mapa meteorológico RJ próprio, trânsito RJ, Mar e Atlântico, notícias locais/globais e sismos oficiais; privacidade dos dez agentes.
- Janela marítima alvo 15 min (máximo 30 min para observações compatíveis), previsões com validade própria; sem dados deve aparecer ausência de dados, não valores artificiais.

## Plano de integração segura (somente pendências, nenhuma está concluída por este documento)
1. Fazer inventário das diferenças `main` vs branch NOAA e das alterações locais Cloud Shell; criar patch revisável sem apagar nada.
2. Remover referências ativas de INEA/CHM da configuração, filas de tarefas, endpoints, interfaces, conversas, tabelas e testes; não reativar WINDY/COPERNICUS na matriz marítima. Preservar histórico de commits apenas.
3. Rodar testes de política explicitando fontes permitidas nos **30 fenômenos**, 92 IBGE, segurança de expiração e segregação de produto/cliente/admin.
4. Resolver hash do pacote Kokoro sem contornar integridade; corrigir desalinhamento de horários do teste GRIB NOAA e reconstruir contêiner em ambiente de testes.
5. Validar CI backend, Android e Runtime; inspecionar API paga no ambiente de homologação com amostra NOAA verdadeira, sem credenciais no log.
6. Somente após validação de ingestão/atualidade/licença, ativar fontes na produção com rollout seguro e comprovar nos medidores Android.

**Este arquivo é a memória de decisões técnicas e evidências recuperáveis dentro do repositório, não uma alteração automática da interface instalada nem da memória persistente da conta ChatGPT.**
