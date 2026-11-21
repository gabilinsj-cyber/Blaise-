# Blaise V6 RJ — execução autorizada: UMA revisão Cloud Run com 0% tráfego

**Autorização explícita da titular:** 21/11/2026, para criar nova revisão de homologação com OpenWeather Secret Manager v2, sem alterar a distribuição 99%/1%, sem ativar coletores nem publicar alertas/dados. **Não autoriza** rollout, merge de PR, atualização de APK, novas consultas meteorológicas intencionais, novo plano ou alteração da chave.

## Resultado do preparatório

- Histórico `blaise-v6-rj-backend-00058-sos`: tag `validacao-rj`, 0% tráfego; `BLAISE_OPENWEATHER_API_KEY` referenciava versão **1 DISABLED** (muito provavelmente responsável pelos 500 HTML, mas não comprovadamente causa única).
- Secret OpenWeather: **v2 ENABLED**; Redemet: **v1 ENABLED**; IAM direta `secretAccessor` identificada (não garante validade do token no fornecedor).
- Segurança: 8 flags explícitas OFF propostas para futura candidata; funcionário histórico `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED` segue true na revisão antiga e nunca é alterado. Plano real de Cloud Shell `REPAIR_PLAN_ELIGIBLE_NOT_DEPLOYED` com blockers `[]`, verificado às 09h19 BRT.
- Dockerfile da branch: `USER node`, `EXPOSE 8080`, `CMD ["node","src/runtime.mjs"]`. Três revisões têm **digests diferentes**; a experiência de homologação deve pinçar o **digest da imagem histórica `00058-sos`**, para testar somente as mudanças de env/secret. Isso **não** testa a imagem da PR #173.
- Método oficial `gcloud run deploy --image ... --no-traffic --update-secrets ... --update-env-vars ...`. **Sem `--tag`**, pois a URL de tag pode ser acessível mesmo com 0% tráfego normal; nenhuma invocação HTTP à candidata ainda. Tags existentes permanecem intocadas.
- O workflow pré-existente `.github/workflows/cloudrun-candidate.yml` **continua bloqueando deploy no backend principal**; este script é uma autorização específica via Cloud Shell autenticado e com guardas de pré/pós verificação. Nunca acionar o workflow de promoção.

## Implementação pronta

- `backend/scripts/rj-openweather-v2-zero-traffic-candidate.mjs`: sem flags faz **preflight somente de leitura**. A execução real exige o parâmetro exato `--execute-approved-zero-traffic`.
- Antes de criar: valida projeto, identidade, região, revisão histórica, estados OpenWeather v1/v2 e Redemet v1, IAM direta, distribuição **99% na 00031-vep e 1% na 00038-pin**, ausência de roteamento *latest*, imagem **@sha256 digest** verificável, 1 contêiner, porta 8080, CPU 1, RAM 512Mi, service account igual, flags propostas OFF, ausência de mínima de instâncias não-zero e inexistência do sufixo de candidata. Se qualquer condição mudou: **bloqueia sem deploy**.
- Criação: usa `gcloud run deploy blaise-v6-rj-backend` com `--no-traffic`, **sem tag**, sufixo fixo `owv2-211126`, imagem **immutável** da revisão histórica, `--update-secrets=BLAISE_OPENWEATHER_API_KEY=blaise-rj-openweather-api-key:2` e 8 overrides `false`; não altera Redemet nem versão antiga, não executa `update-traffic` e não gera APK.
- Depois: confere a existência de `blaise-v6-rj-backend-owv2-211126`, digest do contêiner, vínculo OpenWeather v2, Redemet v1, oito flags OFF, identidade e **exatamente a mesma distribuição 99%/1%**. Se falhar, **não tenta correção/rollback automático**, reporta o conflito. Não faz requisições HTTP ao serviço ou fornecedores.
- Aviso financeiro: criação de revisão pode ter efeitos de provisionamento e custos de infraestrutura conforme configuração da conta. O script não usa créditos meteorológicos diretamente; mesmo com switches OFF, **não constitui prova independente** de que uma imagem histórica não faça chamadas de rede incondicionais na inicialização.

## Execute no Cloud Shell AUTENTICADO (somente após CI aprovado)

A versão `~/blaise-rj-ow-v2-ajuste-20261121` é uma cópia antiga, não sobrescrevê-la. Crie outra worktree separada:

```bash
set +x
cd ~/Blaise-RJ || exit 1
git fetch --no-tags origin feature/rj-meteoblue-full-recovery-admin-ui-20261118 || exit 1
if [ -e "$HOME/blaise-rj-ow-v2-candidate-20261121" ]; then
  echo "CANDIDATE_WORKTREE_EXISTS_NOT_OVERWRITTEN"
  exit 2
fi
git worktree add --detach "$HOME/blaise-rj-ow-v2-candidate-20261121" FETCH_HEAD || exit 1
cd "$HOME/blaise-rj-ow-v2-candidate-20261121/backend" || exit 1
nvm use 24 || nvm install 24
node --test test/rj-openweather-v2-zero-traffic-candidate.test.mjs || exit 1
node scripts/rj-openweather-v2-zero-traffic-candidate.mjs --preflight-only || exit 1
node scripts/rj-openweather-v2-zero-traffic-candidate.mjs --execute-approved-zero-traffic
```

O nome de saída é **`RJ_OPENWEATHER_V2_CANDIDATE`**. Se `BLOCKED_NO_DEPLOY`, não contornar o bloqueio. Se `CREATED_ISOLATED_ZERO_TRAFFIC_PENDING_SMOKE`, a revisão está criada, com 0% de tráfego normal, **ainda sem homologação HTTP**. O processo não publica tag nem implementa exposição de acesso público.

Nunca executar comandos separados `gcloud run deploy`, `services update-traffic`, `secrets versions enable`, `secrets versions access` ou consultar APIs meteorológicas para tentar superar falhas. Compartilhar somente resultado agregado redigido do CLI, nunca chaves/JSON de configuração completo.

## Limites de conclusão

Mesmo com saída de sucesso, NÃO estão validados: chave v2 do fornecedor; efetiva inicialização por Secret Manager; saúde HTTP da candidata (sem tag intencionalmente); CI Android de publicação; segurança P0; coleta real 92/92; licença de redistribuição; custos da conta. Não promover produção nem liberar clientes. Uma futura inspeção (somente leitura) da condição `Ready` da revisão pode ser feita sem tráfego, mas testes HTTP diretos exigem **plano separado de invocação segura**.

Oficial: [Cloud Run - Revisões e rollout](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), [Cloud Run - Secret Manager](https://docs.cloud.google.com/run/docs/configuring/services/secrets), [CLI gcloud run deploy](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy).


## Resultado real do Cloud Shell — 21/11/2026, 09h51 BRT

A titular executou o procedimento aprovado, após passar nos testes locais. O comando **interrompeu-se no preflight**, com:

```text
RJ_OPENWEATHER_V2_CANDIDATE={
 "status":"BLOCKED_NO_DEPLOY",
 "reason":"PREFLIGHT_NOT_SAFE_TO_CREATE",
 "detail":[
  "SERVICE_TEMPLATE_CHANGED_FROM_HISTORICAL_BASE",
  "CURRENT_TEMPLATE_OPENWEATHER_SECRET_NOT_V1",
  "REVISION_MIN_INSTANCES_NOT_ZERO"
 ],
 "releaseAuthorized":false,
 "weatherProviderCalled":false,
 "secretPayloadRead":false
}
```

**Não houve deploy por esse script.** O template atual do serviço é diferente da imagem da revisão histórica, a referência do OpenWeather na configuração atual não é a versão 1 esperada, e há uma configuração de instâncias mínimas diferente de zero. Esses itens podem ser **legítimos em produção**. É proibido ignorar ou remover as travas sem examinar o template e a escala, pois o efeito de `gcloud run deploy` no serviço ativo não estaria suficientemente controlado.

**Ação imediata**: somente consultar o resumo seguro (template versus revisão histórica, versão de referência OpenWeather, localização da configuração minScale, sem ler secret payload nem imprimir valores de ambiente). Não repetir `--execute-approved-zero-traffic`, não alterar min-instances, template, tráfego, segredos ou IAM. Reavaliar o desenho antes de qualquer nova execução. A autorização original não dá permissão para criar serviço diferente, modificar a configuração atual dos clientes, mudar escalonamento ou aumentar custos.


## Resultado real complementar — 21/11/2026, 09h56 BRT

A inspeção **somente leitura** do modelo atual do serviço Cloud Run e da revisão histórica `00058-sos` mostrou:

- `IMAGEM_TEMPLATE_IGUAL_HISTORICA: True` (referência da imagem coincide).
- `OPENWEATHER_TEMPLATE_VERSAO: 2`; `OPENWEATHER_HISTORICA_VERSAO: 1`. **O template atual já referencia a versão 2**, de modo que reaplicar cegamente o reparo de v1 a v2 seria redundante e poderia sobrescrever outras alterações.
- `MIN_INST_TEMPLATE: 1`; `MIN_INST_REVISAO: 1`; `MIN_INST_SERVICO: NAO_DEFINIDO`. São anotações de mínimo no modelo/revisão, não prova do número de instâncias efetivamente em execução nem de cobrança. Copiar esse mínimo à candidata poderia manter instância provisionada mesmo sem tráfego normal.
- `ULTIMA_REVISAO: blaise-v6-rj-backend-00043-hjk` na resposta do serviço; esse valor exige investigação em face da revisão histórica `00058-sos` previamente localizada, sem presumir qual é a mais nova ou alterar o encaminhamento. O gate compara com a histórica e **bloqueou**, corretamente.

**Decisão:** não contornar `SERVICE_TEMPLATE_CHANGED_FROM_HISTORICAL_BASE`, `CURRENT_TEMPLATE_OPENWEATHER_SECRET_NOT_V1` ou `REVISION_MIN_INSTANCES_NOT_ZERO`. A permissão para **uma revisão candidata 0%** não autoriza alterar mínimos de instâncias dos clientes, mudar o modelo ativo, trocar secret bindings já válidos ou criar despesas recorrentes. A próxima etapa é apenas leitura do `latestCreatedRevisionName`/`latestReadyRevisionName`, atributos de escala e distribuição por revisão, sem exibir segredos. O procedimento de implantação atual permanece **bloqueado** e não deve ser reexecutado.
