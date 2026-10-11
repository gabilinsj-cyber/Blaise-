# Blaise V6 RJ — homologação das fontes, radar próprio, voz e duas contas pagantes reais

**Data de referência:** 11/10/2026. **Escopo único:** os 92 municípios do Rio de Janeiro e o Atlântico próximo que possa afetá-los. **INEA excluído** das fontes operacionais. Documentação de implementação/homologação; não confundir com estado verificado da produção.

## 1. Coleta contínua: o que existe e o que falta

O backend já possui `createOfficialSourceWorker` com tarefas de **Alerta Rio (chuva pontual)**, CEMADEN-RJ (risco hidrológico), INMET (avisos CAP) e Marinha (avisos); fontes que não estiverem habilitadas não coletam. O `runtime.mjs` define intervalo nominal **60 segundos normal / 30 segundos severo**. Os dados mantêm fonte, data, validade, erros e cache; nunca criar observação municipal a partir de estação distante. **Defesa Civil (sirenes/pontos de apoio) não é leitura automática de temperatura/chuva.** Windy é modelo; INPE/CPTEC é previsão/satélite conforme produto, não estação INMET.

### Gates para ativar o backend de verdade

1. Verificar no **Cloud Run** o serviço `blaise-v6-rj-backend`, região `southamerica-east1`, projeto `blaise-v6-rj`, revisão e URL efetivamente implantadas, variáveis de ambiente e conta IAM. Não inferir estado a partir de CI, e não expor credenciais.
2. Consultar/registrar por **produto** termos oficiais de acesso/redistribuição/comercialização. Exigir autorização expressa quando o produto assim determinar. O dado ser público não significa redistribuição comercial irrestrita. **Não usar scraping não autorizado**, nem ingestão INEA. Para Alerta Rio e INPE, pedir confirmação do produto/licença pertinente.
3. Ativar `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=true` **somente após revisão dos feeds configurados**. Variáveis específicas `BLAISE_CEMADEN_RJ_ENABLED`, `BLAISE_INMET_WARNINGS_ENABLED`, `BLAISE_CHM_WARNINGS_ENABLED` devem habilitar apenas produtos cuja licença esteja comprovada. Deixar `BLAISE_INMET_P0_PUBLISH_ENABLED=false` até homologar alertas oficiais, idempotência, duplicação, vigência e entrega no dispositivo.
4. Para trabalho a cada minuto **independente de solicitações**, Cloud Run precisa de instância mínima suficiente **e faturamento baseado em instância (CPU alocada fora de requisições)** ou arquitetura dedicada com Cloud Scheduler/Cloud Run Jobs. A configuração atual do servidor não prova que o CPU executa intervalos com instância inativa. Prever custos, quotas e deduplicação entre instâncias.
5. Exigir identidade OIDC configurada para observabilidade. A URL interna `GET /v1/internal/rj-sources/readiness` informa se o worker iniciou, execução bem-sucedida da tarefa, última coleta e frescor **sem devolver dados do fornecedor ou segredos**. Protegida pela mesma identidade dos acessos a métricas. Inativa/sem dados -> HTTP 503. Ela **não comprova uptime 24/7** sem métricas históricas externas.
6. Configurar alertas de Cloud Monitoring para falhas de fonte, dados antigos, CPU, concorrência, tráfego e orçamento; fazer pelo menos 24 horas de verificação antes de declarar coleta contínua comprovada.
7. Somente expor dados oficiais públicos e avisos sem assinatura pelo endpoint `/v1/public/rj-status` quando fontes, horários, abrangência e dois gates de publicação de conteúdo estiverem validados: `BLAISE_RJ_PUBLIC_STATUS_ENABLED=true` e `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED=true`. Nunca exibir “sem alertas” com feed indisponível.

**Limitações atuais:** sem acesso GCP Cloud Run/operador nesta conversa, não há evidência de instâncias/cpu/variáveis/probes habilitados. Não há permissões confirmadas para uso comercial de todos os cinco canais. As integrações INPE e Windy continuam no cadastro de política e não em produção.

Referências oficiais Cloud Run: [instâncias mínimas](https://docs.cloud.google.com/run/docs/configuring/min-instances), [faturamento da CPU](https://docs.cloud.google.com/run/docs/configuring/billing-settings), [Cloud Scheduler](https://docs.cloud.google.com/run/docs/triggering/using-scheduler).

## 2. Mapa meteorológico próprio e radar espacial real

- **Já disponível no Android:** base geográfica própria `RioGeographicBase.kt`, limites dos 92 municípios e marcação de **estação INMET georreferenciada** com observação recente na camada temperatura/chuva/vento quando houver dados válidos.
- **Ainda não equivalente a radar:** pontos de estações não representam pixels de chuva contínuos, tempestades entre estações ou o alcance de todo o estado.
- **Novo contrato científico:** `backend/src/rj-radar-spatial-layer.mjs` valida produto de radar com células calibradas `lat/lon/rainRateMmH/footprintKm`, instrumento, calibração, horário, fonte HTTPS e autorização comercial por produto. A janela de reprodução é de **30 minutos** e a imagem mais recente deve ter **menos de 10 minutos**. Produto vencido, não licenciado, sem georreferenciamento ou baseado em imagem de terceiros: **indisponível**. A grade validada será desenhada pelo Blaise, sem copiar imagens do fornecedor.
- Identificar um produto **quantitativo real** que cubra RJ/Atlântico pertinente por CEMADEN/INPE ou parceiro autorizado, registrar resolução/intervalo/legenda/calibração e verificar a licença; implementar o respectivo decodificador de produto binário/grade e endpoint autenticado. **Ainda não há decodificador nem ingestão binária real em produção.**
- Testar com frames **verdadeiros** de pelo menos 30 minutos: origem, grade, data, georreferência, ausência de falhas e comparação com pluviômetros. Nunca pintar manchas vermelhas/laranjas apenas para reproduzir a imagem ilustrativa.

Referência: [INPE — acesso a dados e produtos de satélites e radares](https://www.gov.br/pt-br/servicos/acessar-gratuitamente-dados-e-produtos-derivados-de-satelites-radares-e-instrumentos-meteorologicos-correlatos); [plataforma CEMADEN/PED](https://sws.cemaden.gov.br/PED/api/ui/). O acesso gratuito aos produtos não dispensa verificar seus termos comerciais.

## 3. Voz feminina — homologação física, não simulação

Exigir **um aparelho Android real** com a build assinada apropriada e as permissões necessárias:
1. Abrir Blaise, selecionar cidade RJ, perguntar por **microfone** “Qual é a temperatura, sensação térmica, vento e chuva em [cidade] agora?” e conferir o texto, fonte, data e hora; medir latência e testar offline.
2. Confirmar **voz feminina pt-BR audível**, sem confundir uma voz de sistema masculina com a voz desejada; testar saída de áudio, volume, interromper/parar e retomada após mudar de app.
3. Repetir com permissão de microfone **negada**, concedida depois, app desligado, modo silencioso e ausência de rede; nenhuma exceção/crash ou alerta inventado.
4. Testar perguntas para ciclone extratropical, deslizamento, mar, sismo, tsunami; resposta deve distinguir medição, previsão, risco e dados indisponíveis.
5. Registrar vídeo ou resultado de testes com aparelho/modelo, versão Android, data/hora e código da build; não expor voz pessoal ou dados de contas sem consentimento.

Emulador e CI não comprovam escuta/microfone físico nem saída feminina.

## 4. Duas contas REAIS pagantes pelo Google Play antes de produção pública

A criadora exigiu **duas contas verdadeiras, duas assinaturas com cobrança verdadeira e validação individual antes de lançamento público**, não instrumentos fictícios.

**Google Play suporta isso em faixas de testes**: usuários **não classificados como testadores de licença** normalmente são cobrados pelas compras no teste interno/fechado. O app e os produtos precisam ser configurados/publicados na faixa de testes. Há limites de gastos em rascunhos e testes internos. [Documento oficial de faturamento de testes](https://developer.android.com/google/play/billing/test), [teste interno/fechado](https://support.google.com/googleplay/android-developer/answer/9845334?hl=pt-BR).

**Bloqueio atual comprovado:** e-mail oficial do Google Play de 10/10/2026 informou verificação de endereço/identidade não concluída e publicação bloqueada, embora tentativas tenham sido reabertas. Exige comprovante de endereço completo, igual ao endereço cadastrado, emitido nos últimos 90 dias e foto legível. Enquanto isso não for resolvido, **não é possível publicar a build na faixa de testes para efetuar essas cobranças**.

Quando a conta estiver aprovada:
1. Criar/publicar **duas assinaturas** (mensal/anual, conforme planos efetivamente aprovados), preços explícitos em reais, política de renovação/cancelamento/reembolso, integração Play Developer API, RTDN e verificação de servidor.
2. Publicar versão **assinada** `br.com.blaise.rj` em faixa de **teste interno ou fechado**; não fazer lançamento público. Convidar e obter aceite **expresso** de dois voluntários de contas Google diferentes; o usuário deve ter ciência de preços e renovações e consentir com cobrança real.
3. Verificar que as duas contas **não são testadores de licença** e que não há período de teste gratuito/promocional que impeça uma cobrança imediata. Cada conta instala pelo link da faixa de testes e aceita individualmente o pagamento pela Play Store. **A pessoa realiza a compra**, não o assistente.
4. Inspecionar **dois pedidos diferentes** no Google Play Merchant Ledger e duas assinaturas `SUBSCRIPTION_STATE_ACTIVE`, reconhecidas (acknowledged), com produtos corretos e data de expiração futura. Exigir **dois valores positivos liquidados**, não `testPurchase`, e identidades autenticadas distintas. O utilitário `backend/src/rj-two-real-payment-audit.mjs` exige esse conjunto; **não cobra ninguém e não coleta cartões**.
5. Confirmar que assinatura da conta A **não libera conteúdo premium na conta B**; testar troca de conta, restauração, assinatura cancelada, vencimento, perda de rede, cobrança pendente e reembolso sem acesso residual. **A integração atual de validação por purchase token precisa de revisão de vínculo com o usuário autenticado antes de declarar esse teste concluído.**
6. Guardar somente evidências de identidade/conta em formato hash e recibos **redigidos/sem dados financeiros privados**; não compartilhar e-mails, dados de cartão, tokens de compra, capturas completas do pagamento ou comprovantes pessoais no GitHub ou neste chat. Garantir reembolso ou gerenciamento da assinatura conforme os termos aceitos e direitos aplicáveis.
7. **Só depois dos dois testes pagos e das demais validações físicas** planejar o lançamento público, sem comprometer os alertas P0 gratuitos.

**NÃO executar transações agora**: a publicação está bloqueada, os usuários ainda não foram convidados/consentiram, os planos/preços não foram confirmados e não há acesso ao Play Console ou aparelhos nesta conversa.

## Gates obrigatórios para marcar cada objetivo como concluído

| Área | Evidência obrigatória | Situação sem evidência |
|---|---|---|
| Coleta 24/7 | Cloud Run/worker real, fontes atuais, métrica por 24 horas | Não ativada / não comprovada |
| Radar 30 min | Frames espaciais reais licenciados e camada Android funcional | Camada indisponível |
| Voz | Microfone e saída feminina em Android físico | Não homologada |
| Assinaturas reais | 2 contas distintas, 2 pedidos com cobrança confirmada, backend vinculado | Pagamentos não validados |
| Lançamento | Google Play verificado, produtos e track, CI/QA, P0 livre | Bloqueado |

**Nenhuma mudança de infraestrutura ou cobrança poderá ser declarada concluída somente por esta PR.**
