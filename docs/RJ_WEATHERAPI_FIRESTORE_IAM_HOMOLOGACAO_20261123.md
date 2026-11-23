# Blaise V6 RJ — WeatherAPI V2 e Firestore: auditoria IAM de homologação (23/11/2026)

## Escopo preservado

PR #174 permanece **draft**, sem merge nem deploy. Não alterar Cloud Run, tráfego principal **99%/1%**, chaves, Firestore, regras, APK ou backups. Não fazer novas chamadas à WeatherAPI, OpenWeather, Visual Crossing ou Meteoblue, nem liberar dados de clientes. Os 92 municípios, os 14 agentes e a interface original permanecem inalterados em produção.

## Evidência histórica anterior

Em 22/11 às 18h36 (conforme captura do operador):
- Secret Manager `blaise-weatherapi-free-api-key` versão **2**: `ENABLED`.
- Papel **direto**, sem condição, `roles/secretmanager.secretAccessor` para a identidade `blaise-cloud-run-runtime@blaise-v6-rj.iam.gserviceaccount.com`, na política do segredo.
- Banco Firestore `(default)` encontrado com tipo `FIRESTORE_NATIVE`.
- **Nenhum** `roles/datastore.*` atribuído diretamente ao principal **no projeto** foi localizado pela filtragem anterior. Isso **não é prova de falta de acesso efetivo**, porque pode haver papéis mais amplos, herdados, personalizados ou condições e restrições.

## Material de desenvolvimento criado em 23/11

- `backend/scripts/rj-weatherapi-firestore-iam-preflight-readonly.py`: consulta SOMENTE metadados via `gcloud`: políticas IAM de projeto/ancestrais (tenta incluir deny), política direta do segredo, estado da versão 2 e metadados do Firestore `(default)`.
- `backend/test/test_rj_weatherapi_firestore_iam_preflight_readonly.py`: seis testes offline com os comandos `gcloud` simulados.
- `backend/test/rj-weatherapi-firestore-iam-preflight.test.mjs`: executa os seis testes mockados no CI Node/backend.

O relatório retorna apenas nomes de papéis correspondentes à identidade de execução, sinalizadores de revisão e estado do banco/segredo. **Nunca imprime** o conteúdo da chave, tokens de acesso, documentos Firestore ou o texto integral de políticas. Não testa acesso de dados, não reserva franquias, não monta um coletor e não cria revisão ou job.

**Execução manual de leitura após revisar o arquivo na PR #174:**

```bash
python3 backend/scripts/rj-weatherapi-firestore-iam-preflight-readonly.py
```

Executar apenas a partir de um checkout **da branch da PR #174**, com caminho correto e sem trocar automaticamente a branch do diretório de produção. A execução não é necessária para o CI. Não criar ou executar contas de serviço impersonadas, nem fazer leituras reais do segredo ou dos documentos nesta fase.

## Critério de interpretação conservador

- `firestoreDatabaseMetadataFound:true` = banco localizado **pelo usuário que executa gcloud**, não prova leitura pela identidade do Cloud Run.
- `directOrInheritedDatastoreRoleBindings`: vinculações explícitas potencialmente relevantes, com escopo e campo `conditional`. Uma vinculação **não comprova autorização efetiva**.
- `potentiallyBroaderRoleBindings` e `customRoleBindingsRequireInspection`: impedem concluir ausência de permissão só porque não há `roles/datastore.*` direto.
- `policyCoverage:PROJECT_ONLY`, `issues`, grupos, condições, deny e políticas não reconhecidas = **revisão manual necessária**. Não aplicar privilégios nem criar um recurso automaticamente.
- `weatherApiSecretAccessorDirect:true` e `weatherApiSecretV2State:ENABLED` = apenas metadados; acesso efetivo da conta de execução à **versão 2** continua **não comprovado**, pois não se acessa a carga útil.
- `firestoreEffectiveAccess:NOT_PROVEN_BY_IAM_POLICY_LISTING` = comportamento obrigatório, mesmo se encontrar papéis potencialmente suficientes.

O SDK servidor do Firestore é autorizado por **IAM** e não é protegido pelas regras de segurança de clientes web/mobile; essas regras devem ser auditadas separadamente antes de qualquer disponibilização do cache a aplicativos. [Documentação oficial](https://firebase.google.com/docs/firestore/security/get-started).

## Coleções do código a revisar

- `blaise_rj_weatherapi_free_private_current_v1`: cache privado de condições meteorológicas, leitura/escrita apenas em ambiente de homologação autorizado.
- `blaise_rj_weatherapi_free_monthly_ledger`: orçamento atômico mensal **interno**.
- `blaise_rj_weatherapi_city_cooldown`: resguardo por município (25 minutos mínimos).

Importante: a reserva de **80.000 chamadas por mês é um teto interno de desenvolvimento**, não uma garantia do fornecedor. Uso externo e direitos de redistribuição devem ser verificados separadamente, antes de permitir qualquer coleta ou publicação.

## Próximas aprovações separadas (não executadas)

1. Conferir no Cloud Shell o relatório de metadados sem expor chaves ou políticas brutas.
2. Revisar os papéis herdados, permissões efetivas (incluindo negações e condições) e princípio de privilégio mínimo.
3. Validar a licença de redistribuição da WeatherAPI Free e consumo externo, sem chamar a API.
4. Somente depois, submeter plano isolado de prova operacional com autorização explícita e sem tráfego de clientes, mantendo os bloqueios atuais até nova decisão.

**Não há aprovação de implantação ou disponibilização pública nesta documentação.**
