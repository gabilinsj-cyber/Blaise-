# Blaise V6 RJ — Edição administrativa, onze agentes e resposta por voz datada
**Atualizado:** 13/11/2026. Somente Rio de Janeiro; não misturar com Blaise & Ben Alemanha.

## Continuidade da versão original
- O ponto de partida deste trabalho é o commit 1f7f33d068c851cdfd6978d7c8324a7a16e2015c, da PR #150 (`feature/rj-original-live-ui-20261113`). A branch `main` não representa necessariamente as alterações recentes do Cloud Shell.
- Preservar `~/Blaise-RJ`, `~/blaise-rj-safety` e todo APK instalado. Proibido reset/checkout forçado, sobrescrita silenciosa, desinstalação e merge cego.
- Cliente: `br.com.blaise.rj`, release 6.0.1, limite **400.000.000 bytes**.
- Proprietário: `br.com.blaise.rj.admin` / build `admin`, APK próprio, sem sufixo `.debug`, podendo carregar voz offline maior. Não herda autorização administrativa só pelo identificador ou BuildConfig.
- O release `admin` depende de assinatura de distribuição protegida no GitHub Actions, verificação via apksigner, certificado SHA-256 e teste físico do APK. Não é um lançamento automático.

## Onze agentes, dois papéis complementares para perguntas
O registro `backend/src/blaise-rj-agent-registry.mjs` define **onze** agentes distintos. 
- `voz-perguntas`: entrada de pergunta oral ou digitada e execução sob demanda, sem armazenar áudio.
- `blaise-ia-pesquisa`: **11º agente**, pesquisa e resposta fundamentada por evidências, sob demanda; integra o mesmo caminho de voz, não cria duplicação ou um 12º agente.
- Ambos têm despacho de execução condicionado por `enabled`/handler e não são ativados automaticamente por estarem no registro.

**Contrato temporal da pergunta:** o Android registra `WeatherRequest.requestedAt` em UTC, remete `requestedAt` e `timeZone=America/Sao_Paulo` ao servidor. O backend recusa discrepância superior a cinco minutos. A nova apresentação `RjVoiceQuestionReceipt` informa ao usuário a hora civil da pergunta e a da resposta, com fuso de Brasília, sujeitas ao limite de frescor da consulta. A lista de evidências mostra os horários de emissão dos documentos. O tempo da pergunta **não** substitui o da medição.

**Exemplo, sem simulação de clima:** “Pergunta registrada em 13/11/2026 às 15:36 (horário de Brasília). Consulta verificada em 13/11/2026 às 15:36. Fontes e datas: …”. Se faltar estação, serviço autorizado, data da medição ou resposta verificada, mostrar indisponibilidade; não inventar números.

**Controle:** o pipeline de pesquisa depende de cobrança/autorização de assinatura, rate limiting, fontes oficiais licenciadas, sintetizador autorizado e verificador semântico independente. A resposta de pesquisa nunca se apresenta como alerta oficial. O motor de voz do cliente depende da voz pt-BR selecionada; o pacote administrativo usa Dora offline somente se ela estiver validada no build.

## Radar, séries, licença e integridade
- Radar Sumaré: há contrato de quadros numéricos georreferenciados (até 16 quadros para 30 minutos) mas **não há prova de alimentação contínua nem permissão licenciada conectada**. Não usar capturas de mapas de terceiros ou interpolação.
- INPE/CPTEC, NOAA, EUMETSAT, JAXA GSMaP: cadastrar origem não comprova coleta atual, validade ou permissão comercial. Manter bloqueio por produto/tempo/território/fonte.
- Alerta Rio e Defesa Civil RJ prevalecem no monitoramento local; INMET desempata produtos meteorológicos comparáveis. Respeitar separação previsão × observação.
- INEA, Marinha/CHM, Windy e Copernicus: excluídas, não reintroduzir nem ativar antigos coletores. Código legado precisa de auditoria isolada.
- Séries: 3 dias anteriores + hoje + cinco dias futuros requerem histórico e previsão validados; lacuna deve ficar indisponível.
- Cálculos científicos: não apresentar resultado em domínio não validado; cálculos Blaise nunca se tornam aviso oficial ou detector de tsunami.
- Dez agentes de manutenção/controle e o 11º de pesquisa: executor real, identidade, telemetria e teste de operação são gates separados.

## Como obter o APK administrativo assinado
1. Revisar e aprovar o PR, preservando a branch original de origem.
2. No GitHub Actions, disparar manualmente **Blaise RJ Administrator Signed APK** na branch autorizada.
3. O workflow exige `BLAISE_KEYSTORE_B64`, `BLAISE_STORE_PASSWORD`, `BLAISE_KEY_ALIAS`, `BLAISE_KEY_PASSWORD` em GitHub Secrets. **Nunca enviar segredos por conversa ou incluir chaves no APK.**
4. O script `scripts/admin-release-gate.sh` valida a compilação `admin`, `br.com.blaise.rj.admin`, assinatura, zipalign, certificado, versão e assets de voz Dora; gera `admin-packages/blaise-v6-rj-admin-release.apk` somente se todos os gates passarem.
5. Configurar, se houver edição administrativa anterior, `BLAISE_ADMIN_EXPECTED_CERT_SHA256` para verificar continuidade de assinatura. Nunca desinstalar para contornar incompatibilidade.
6. Não confundir gate de pacote com autorização administrativa efetiva do backend, fontes reais, radar, serviços meteorológicos, execução dos onze agentes, instalação no aparelho e publicação, todos ainda dependentes de homologação específica.

**Evidência:** sucesso de CI prova apenas tarefas testadas. Nenhum documento ou nome de artefato prova que um APK já está instalado no celular.
