# Blaise V6 RJ — integração meteorológica na memória e interface original

**Consolidação de desenvolvimento:** 19/11/2026 (PR #173, DRAFT), **não implantação**. Preservar `main`, worktrees, backups, APK original, Cloud Run/tráfego, chaves e configurações de loja. Sem contrato pago ou ativação para clientes.

## O que entrou na branch

1. **Meteoblue Free mLM `basic-6h`:** uma resposta **REAL** de 19/11/2026 09h42 BRT foi validada em Cloud Shell com **7/7 campos**, **29 períodos de 6 horas**, modelo, unidades e georreferência aceitos; o Firestore confirmou **1 reserva de 4.000 créditos**, **1 de 1/dia UTC**, saldo **interno** de 7.996.000 de 8M. **Saldo restante no fornecedor não foi confirmado**, e o teto da chave no painel é 4.000/dia. Chave continua historicamente exposta; sua versão 3 no Secret Manager é só versão do mesmo segredo, não rotação junto à meteoblue. Não fazer novas chamadas hoje.
2. **Memória meteorológica privada:** `backend/src/rj-meteorological-memory-live.mjs` obtém **apenas cache privado existente** (`blaise_rj_meteoblue_free_private_cache_v1`) e contabilidade local (`blaise_rj_meteoblue_free_budget_v1`). Nunca consulta meteoblue, nem DWD, NOAA, ECMWF, OpenWeather, HG, ANA ou SGB para construir a tela. A avaliação é feita no **momento de cada GET administrativo**; não é modelo meteorológico atualizado instantaneamente. Sem cache válido, sinaliza **INDISPONIVEL**, não zero.
3. **API administrativa protegida** `GET /v1/admin/meteorological-memory`: ligada a `createScientificHttpHandler`, mesma verificação Firebase e **allowlist de UID** usada em `/v1/admin/scientific-reports`. Flag `BLAISE_ADMIN_METEOROLOGICAL_MEMORY_ENABLED=true` e projeto `blaise-v6-rj` necessários para habilitar somente a leitura de Firestore. Fora disso **503/falha fechada**, nunca uma rota pública de clientes. Não modifica os endpoints de faturamento, fontes oficiais ou previsão do assinante.
4. **Interface original preservada:** `app/src/admin/java/br/com/blaise/rj/AdminScientificActivity.kt` ganha botão **Atualizar fontes no cache**, que solicita um token Firebase admin e carrega o endpoint autenticado, mostrando fonte, horário, estado, sete campos com valores NUMÉRICOS somente quando o cache privado ainda estiver válido; casos vencidos/ausentes continuam indisponíveis. Não muda o layout de Cidade 1 / Mapa / Cidade 2 no aplicativo dos clientes. Qualquer valor na variante admin é **PREVISÃO P** e não observação O, nem alerta. Sem publicação a clientes.
5. **Matriz internacional atualizada:** `rj-source-sector-matrix.mjs` deixa de atribuir `METEOBLUE_NEMS10` a setores de chuva por hora, vento/rajada, nuvens ou umidade; registra a fonte Free **apenas no setor dedicado de 6 horas**, não como modelo independente de ECMWF/DWD/NOAA. `rj-meteorological-completeness-audit.mjs` registra sete campos distintos **privados de seis horas** e bloqueia sua conversão em temperatura, chuva observada, chuva horária ou rajada. `WeatherSourceResponsibility.kt` reflete uma validação real privada, sem habilitar a publicação.
6. **Testes:** novos casos `rj-meteorological-memory-live.test.mjs`, testes de autorização do HTTP e `AdminMeteorologicalMemoryClientTest.kt`; ajustes de fonte e cobertura. Os GitHub Actions do SHA final são a evidência necessária antes de merge. Testes com dados sintéticos são apenas regressão: não substituem a consulta real anterior.

## Fonte por fonte — realidade operacional, não promessa de “tempo real”

| Fonte | Dados adequados | Exibição nesta implementação |
|---|---|---|
| meteoblue Free basic-6h | Chuva prevista, convectiva, probabilidade, vento médio/máximo, umidade, pressão **para seis horas** | SOMENTE ADMIN: cache real do Rio (IBGE 3304557) se atual; até 1 nova chamada/dia UTC; nenhum valor público |
| DWD/ICON | Temperatura do ar prevista a 2 m, outros produtos mediante validação | Catálogo/admin; lote histórico 92 pontos; conexão contínua ainda não atestada |
| ECMWF/IFS via MET Norway | Umidade, vento, pressão, nuvens, chuva prevista; UV céu limpo se permitido | Catálogo/admin; cache MET em backend condicionado por ToS/credenciais e flags; não criar um novo "modelo independente" |
| NOAA GFS / GFS-Wave | Atmosfera; ondas e swell previstos | Catálogo/admin; staging em módulos separados; qualquer medidor público exige snapshot real e validade |
| NOAA CoastWatch e GLM | SST estimada e detecção satelital de raios | Catálogo/admin; QA/horário/cobertura não homologados em produção |
| OpenWeather/Agente 13 | Temperatura e sensação **estimadas**, apenas contingência | Quota interna 900/dia; não liga fallback pago ou modifica a fonte base |
| HG Brasil Pro | Condições atuais agregadas; não é estação identificada | Contrato NÃO assinado, portanto nunca disparar requisições |
| ANA / SGB | Níveis de rios/cheias por estação, conforme direitos e validade | Candidatas até obter observações e validação espacial |
| Alerta Rio / Defesa Civil RJ | Links diretos para avisos oficiais | Apenas encaminhamento, sem medidor/coleta por esta integração |
| INMET / CEMADEN | Comparação administrativa, quando autorizada | Não publicar como medição de cliente |
| RAMMB/CIRA | Visualização externa de imagens NOAA | Somente link, sem copiar imagens ou contar como fonte independente |

**Excluídos da coleta direta:** EUMETSAT, JAXA, NASA, INEA, Marinha, Windy, Copernicus direto, Zoom Earth; não reativar por presença em arquivos legados.

## Condições técnicas de disponibilidade

- O cache meteoblue tem **TTL de 6 horas**. Após isso, a tela não deve simular atualização; deve exibir `INDISPONIVEL`.
- **Barreira de chave exposta:** apesar do limite de **1 consulta/dia UTC**, o coletor verifica também `temporaryExposedKey && calls>=1` e bloqueia **qualquer nova consulta com a chave exposta após a primeira chamada privada desta campanha**, mesmo no dia UTC seguinte. A chamada de 19/11 já consumiu essa permissão. O usuário optou por manter a chave atual, portanto **não há atualização automática nem novas previsões meteoblue contínuas** com a política de segurança atual. A rotação futura da credencial não cancela por si só a franquia Free, mas exige decisão e testes específicos. Não contornar essa barreira.
- O GET admin não muda o TTL, não chama API ou agenda novos 4.000 créditos. Ele pode usar **Firestore**, serviço que tem custos de infraestrutura separados do plano de créditos meteoblue.
- A interface admin precisa de **backend implantado em revisão autorizada**, `BLAISE_ADMIN_METEOROLOGICAL_MEMORY_ENABLED=true`, `BLAISE_SCIENTIFIC_ADMIN_UIDS` preenchido e autenticação Firebase. Sem isso, o painel deve informar **backend indisponível**.
- A variante Android administrador depende de `BLAISE_ENTITLEMENT_VERIFY_URL` com HTTPS e caminho `/v1/entitlements/verify` como base confiável de URL. Sem endereço seguro, nenhuma tentativa é feita.
- A camada do cliente **não recebe** sete valores privados, crédito, fórmula, identificador de agente ou diagnóstico de fonte. Para disponibilizar dados ao público seriam necessárias licença/proveniência/validade, cobertura dos 92 municípios e liberação explícita. Uma consulta/dia é insuficiente para cobertura contínua dos 92 municípios.

## Não executar nesta etapa

- NÃO fazer nova chamada meteoblue hoje, nova rotação não autorizada, compra, merge, deploy, mudança de tráfego, inclusão na Play Store ou escrita na `main`.
- NÃO declarar nenhuma fonte “tempo real” pelo simples fato de existir no catálogo.
- NÃO copiar referência visual privada/segredo para GitHub, output de logs, APK ou usuário público.

**Conclusão:** o caminho de **leitura de cache/estado no momento da solicitação** foi codificado para o administrador. A efetiva visualização de novos números **não é atual/implantada** até CI, configuração do endpoint e release autorizado; todos os demais provedores sem snapshot real continuam indisponíveis. Nada foi substituído no aplicativo original.
