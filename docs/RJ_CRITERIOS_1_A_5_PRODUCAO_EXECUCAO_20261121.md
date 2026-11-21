# Blaise V6 RJ — execução real dos cinco critérios de produção

**Data:** 21/11/2026 (BRT). **PR #173 Draft**, sobre a cadeia de PRs #157–#172. Sem alterações no app dos clientes ou Cloud Run, sem merge/deploy, compra, Secret Manager payload ou API meteorológica paga.

## Resumo da decisão

- **APROVADO:** testes automatizados do backend Android em SHA anterior (`32395ed197ec76638ec48a8eda4372c0d03a6c88`); gate privado das 19 famílias/16 setores; testes de controle Cloud Run somente leitura; DWD e NOAA possuem algumas evidências reais pontuais.
- **BLOQUEADO para produção:** coleta contínua 92/92 por produto, observações com origem instrumental, NOAA SST, P0/FCM reais, licença de redistribuição meteoblue, chave previamente exposta, auditoria da conta Cloud Run/Secret Manager/Scheduler, preflight externo completo, integração nos celulares, canário/rollback. Sem evidência não se publica.
- **NÃO realizado:** nenhuma nova consulta meteoblue, HG Brasil, OpenWeather, Visual Crossing, WeatherAPI ou Climatempo; nenhum pagamento, deploy, mudança de tráfego, notificação a cliente, instalação APK ou acesso à chave.

### Critério 1 — origem e dados reais, 92 municípios

**Leitura dos logs do GitHub Actions em 21/11/2026:**

| Produto | Evidência REAL com horário UTC | Conclusão |
|---|---|---|
| DWD ICON Global T_2M | `BLAISE_DWD_RJ_92_REAL_RESULT` `FULL`, 92 validados, 0 indisponíveis; rodada **06:00Z**, previsão válida **10:00Z**, checada **10:02:36Z**; RJ 25,07 °C previsto | **Um ciclo real de previsão para 92 pontos**, não termômetros observados; workflow ainda define `BLAISE_DWD_ALLOW_LEGACY_WEIGHTS_STAGING=true` e `altitudeVerified=false`. Homologação operacional NÃO |
| NOAA GFS-Wave | `NOAA_RJ_MARINE_LIVE` `FULL`, 3 alturas previstas + 3 períodos de swell, emissão **06:00Z**, validade **10:00Z**, checagem **10:01:35Z** | **Três pontos oceânicos, não 92 cidades nem operação contínua** |
| NOAA GOES-19 GLM | `VALIDATED_ONE_FILE`, arquivo de **10:01:00Z**, validado em **10:01:35Z**, 242 flashes válidos no arquivo, **0 na área retangular RJ** analisada | **Uma cena de ~20 segundos**; zero nesse recorte ≠ ausência de raios atuais ou por município. Alertas NÃO |
| NOAA CoastWatch SST | `UNAVAILABLE`, `NOAA_COASTWATCH_RECENT_L3C_FILE_MISSING`; 0 pixels verificados | **Sem SST numérica válida**, mesmo que o workflow CI tenha conclusão verde |
| meteoblue Free basic-6h | Captura histórica real 19/11: 7 campos, 29 períodos 6h, 4.000 créditos reservados no ledger | **Previsão antiga, não atual**. Chuva total e convectiva coincidem 29/29; termos de redistribuição e chave pendentes |
| Visual Crossing Free | Ensaio isolado privado com campos agregados e previsão; 92 cidades só dry-run | Sem cache automático e credencial antiga exposta |
| MET Norway / ECMWF, NOAA GFS atmosfera, OWM Agente 13 | Adaptadores/controles existentes, sem evidência equivalente de aprovação ponta a ponta nesta revisão | Não promover a produção |
| ANA/SGB, INMET/CEMADEN, Alerta Rio/Defesa Civil | Catálogos, comparação administrativa ou links oficiais, conforme política | Não inferir estações, chuva observada, P0 nem alarmes automáticos |

**Referência:** links Actions para os dados pontuais do SHA anterior:
- DWD: https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44892298397
- Ondas: https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44892298237
- GLM: https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44892298250
- SST: https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44892298256

A evidência da rodada não prova próximo ciclo, 92 sensores, atualização em aparelho ou licença. Não repetir chamada meteoblue ou contornar quota com outra chave.

### Critério 2 — credenciais, licenças e custos

**HG Brasil:** e-mail formal de 17/11/2026, recebido em 18/11 UTC, autoriza exibição de dados em app comercial com assinantes **no plano Pro**, cache temporário e atribuição; **não permite revender dados brutos como produto independente**. Até 100 cidades, 20.000 requisições/dia, dados atualizados até 1h. Não identifica estação individual da variável: condições atuais agregadas são **E**, não medição instrumental **O**. Ainda **não contratado**, sem chave no momento do e-mail de boas-vindas.

**Climatempo Advisor:** pedido de proposta enviado em 18/11, sem resposta comercial confirmada na busca da caixa de correio desta auditoria. **Sem contrato, sem chave, sem preço final**.

**meteoblue Free:** Free API anuncia uso comercial, mas não houve resposta específica sobre cachê, reprodução/redistribuição a assinantes, atribuição e a igualdade convectiva. **Sem permissão de publicação comprovada**, e chave anteriormente exposta requer plano de rotação antes de recorrência. Não alterar credencial sem aprovação separada.

**MET Norway:** Termos revisados em **05/11/2026** exigem User-Agent que identifique aplicativo, respeito a cabeçalhos de cache e atribuição CC BY; chamadas diretas de celulares desaconselhadas. https://docs.api.met.no/doc/TermsOfService

**Visual Crossing:** plano Free aceita aplicações comerciais com atribuição sob Termos, mas não a redistribuição de dataset bruto como serviço concorrente; recomenda cache conforme regras. https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/

**WeatherAPI:** uso comercial disponível no Free; condições atuais podem ser cacheadas no máximo 60 min e previsões 24h, sujeito a termos. https://www.weatherapi.com/terms

**ANA HidroWebService:** autenticação e manual de acesso específico; serviço antigo encaminhado para API nova. https://www.ana.gov.br/hidrowebservice/swagger-ui/index.html e https://telemetriaws1.ana.gov.br/Contato.aspx

Não registrar tokens, apikey, project numbers, secret versions com payload, e-mails pessoais ou dados de assinantes no GitHub.

### Critério 3 — auditoria de Cloud Run, Secret Manager e Scheduler SEM ALTERAR recursos

Novo código:
- `backend/src/rj-production-control-plane-audit.mjs` — reduz **metadados** a estados agregados; omite nomes, links, service account, valores da chave, payloads, usernames.
- `backend/scripts/rj-production-cloud-readonly-probe.mjs` — por padrão OFFLINE; com `--gcloud-readonly`, usa SOMENTE `gcloud projects describe`, `gcloud run services list/describe`, `gcloud secrets versions list`, `gcloud scheduler jobs list`, sem escrever nenhum recurso; com `--health-readonly`, faz **GET** em `/healthz` e `/readyz` do endereço HTTPS que o Cloud Run forneceu, nunca URLs digitadas nem APIs meteorológicas.
- Testes `backend/test/rj-production-control-plane-audit.test.mjs` e CI protegido, sem credencial Google. A verificação de status de versão de segredo **não comprova a rotação da chave no fornecedor**.
- Resultado real Cloud Shell **AINDA NÃO OBTIDO**. Sem acesso direto a `blaise-v6-rj` nesta sessão de ferramentas.

Execute no seu **Cloud Shell**, em cópia de trabalho isolada, sem tocar no app original (não copiar/colar segredos):

```bash
set +x
cd ~/Blaise-RJ
git fetch --no-tags origin feature/rj-meteoblue-full-recovery-admin-ui-20261118
if [ ! -d "$HOME/blaise-rj-readonly-20261121" ]; then
  git worktree add --detach "$HOME/blaise-rj-readonly-20261121" FETCH_HEAD
fi
cd "$HOME/blaise-rj-readonly-20261121/backend"
nvm use 24 || nvm install 24
node --test test/rj-production-control-plane-audit.test.mjs test/rj-meteorological-production-readiness.test.mjs
node scripts/rj-meteorological-production-readiness.mjs --assert-private
node scripts/rj-production-cloud-readonly-probe.mjs --gcloud-readonly --health-readonly
```

Se `cloudRunRegionKnown=false`, obter a região **real** do serviço pela interface: https://console.cloud.google.com/run?project=blaise-v6-rj ; configurar SOMENTE na sessão do terminal `export BLAISE_AUDIT_CLOUDRUN_REGION='REGIAO_REAL_AQUI'` (substituir por região verificada) e repetir apenas o último comando. Se houver múltiplos serviços, obter o nome real do serviço autorizado e configurar `BLAISE_AUDIT_CLOUDRUN_SERVICE`; **não escolher uma instância ao acaso**.

O relatório `RJ_CLOUD_PRODUCTION_READ_ONLY` informa apenas a existência do projeto, condições de prontidão, tráfego agregado, número de bindings secretos, versões habilitadas, jobs e checks HTTP (quando disponíveis). **`READY` do Cloud Run não garante coleta meteorológica ou entrega de FCM real.** Se `401/403`, classificar autenticação necessária, não declarar serviço offline.

O ledger privado meteoblue pode ser conferido separadamente usando `node scripts/meteoblue-free-credit-status.mjs --read-firestore-budget`, lembrando que é **reserva local**, NÃO saldo/cobrança no fornecedor. Evitar log de valores meteorológicos no canal público.

### Critério 4 — testes de alerta, interface e dispositivos

No SHA avaliado antes deste incremento, Android CI (jobs `verify` e `backend`) passou; testes unitários do gate de publicação meteoblue e fonte/medidor passaram. A execução do **novo SHA** requer nova conclusão CI.

**NÃO FEITOS nesta sessão:** aparelhos físicos Android / Firebase Test Lab, consentimento/entitlements ao vivo, FCM/P0 em dispositivos controlados, interface real horizontal/vertical, alertas de severidade/expiração/revogação em situação real, acessibilidade e latência sob uso de milhões. Sem Test Lab real e sem teste de usuários, NÃO homologar experiência final nem notificação crítica.

O sistema não deve inventar aviso ativo nem converter ausência de coleta em risco zero. Alerta Rio e Defesa Civil RJ apenas link/frase oficiais enquanto não houver contrato para ingestão.

### Critério 5 — preflight, canário e rollback

Os scripts `scripts/production-preflight.sh`, `scripts/cloudrun-readiness-preflight.sh`, `scripts/cloudrun-promotion-preflight.sh`, `scripts/cloudrun-rollback-preflight.sh`, `scripts/release-gate.sh` já existem; `scripts/test-production-preflight.sh` e afins verificam **configuração de teste**, não a conta real. O `Production Preflight` manual prova configuração real e endpoints HTTPS **somente quando acionado com variáveis configuradas**. O workflow `Cloud Run WIF Readiness Gate` permite `execute_probe=true` somente com permissões WIF; não faz deploy, mas o acesso externo precisa ser homologado.

**NÃO realizar canário ou rollback neste momento:** são atos de mutação da produção, incompatíveis com proteção do tráfego atual e com as evidências externas faltantes. Assim que critérios 1–4 estiverem comprovados, homologar revisão candidata, realizar preflight, obter aprovação humana específica e só então executar canário isolado e teste de rollback controlado.

## GO/NO-GO

**GO** para CI, pesquisa documental, diagnóstico gcloud read-only, consulta HTTP de saúde e QA privado. **NO-GO** para implantar novas fontes, mudar tráfego, emitir P0, atualizar APK dos clientes ou criar pagamento. Os cinco critérios foram encaminhados e testados onde havia acesso: as partes dependentes de identidade do projeto, fornecedores, aparelhos e produção **continuam sem prova externa**.

**Regra permanente:** não apagar/sobrescrever/resetar `~/Blaise-RJ`, `~/blaise-rj-safety/` ou APK original. Não executar `git reset --hard`, `git clean -fd`, `gcloud run deploy` nem `gcloud run services update-traffic` sem etapa separada de liberação.
