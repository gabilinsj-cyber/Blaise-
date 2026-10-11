# Blaise V6 RJ — homologação real de fontes, radar, gráficos, voz e assinatura

**Situação (10/10/2026):** este documento contém condições de aceite, **não certificação de sucesso em produção**. PR #97 foi incorporada à `main`; ajustes atuais propostos na PR #99. Nenhum arquivo de cliente é baixado nem publicado automaticamente.

## Critério de resultado por fonte (as cinco fontes)

| Canal | Produto já identificado no código | O que o produto NÃO comprova | Gate para considerar operacional |
|---|---|---|---|
| **1. Alerta Rio** | Coletor de chuva e estação no município do Rio | Termômetros para os outros 91 municípios; frames de radar georreferenciados | Autorizar uso do produto em app comercial, coletar evidência contínua com latência e frescor, identificar estações |
| **2. Defesa Civil** | Produtos de risco CEMADEN-RJ (serviço separado) e mapa de sirenes/pontos de apoio na cidade do Rio | Avisos municipais ativos de todo RJ, temperatura e vento | Conector meteorológico regional aprovado, classificação por município, origem e validade |
| **3. INMET** | INMET via app: leituras de estação, rajadas, chuva 1 h e série horária do Rio; no backend, avisos CAP por área IBGE confirmada | Estações cobrindo 92 municípios ou dez dias de observação sem falhas | Prova do acesso ao produto exato, 24 h de leituras com validade e teste offline |
| **4. INPE/CPTEC** | Catálogo e cálculo comparativo de previsões na política RJ | Ingestão atual de modelos/boletins em produção | Aprovação de termos comerciais por produto, adapter real, proveniência de execução/validade, verificação histórica |
| **5. Windy** | Política para desempate como previsão/modelo | Chave API/licença válida, sensores ou estação oficial | Licença/chave do produto contratado e permitido, adapter real, identificação do modelo/execução e validação independente |

**Produto recebido não significa fonte inteira operacional**. O novo `backend/src/rj-five-source-health.mjs` expõe estado **do produto específico** (`CURRENT_PRODUCT_ONLY`, `STALE_OR_UNVERIFIED`, `NOT_CONNECTED`), sem senhas, tokens de compra, localização pessoal ou imagens de terceiros. O endpoint público `/v1/public/rj-status` continua exigindo que o operador habilite a rota e aprove o uso do produto (`BLAISE_RJ_PUBLIC_STATUS_ENABLED`, `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED`). Os rótulos INPE e Windy continuam **não conectados** até adapters autorizados serem instalados e comprovados.

## Radar e mapas

- **Base**: `RioGeographicBase.kt` desenha o mapa próprio do Blaise dos 92 municípios. Isso é cartografia, **não** radar.
- **Estação**: um ponto INMET ou Alerta Rio com valor e horário válido pode ser mostrado como ponto observado, quando coordenadas e licença do produto forem verificadas. Não interpolar células/chuva a partir de uma ou duas estações nem colorir manchas que parecem radar sem campos reais.
- **Radar espacial real**: só aprovar se um campo georreferenciado autorizado vier com horário de observação, variáveis e unidade, projeção/célula, sequência real dos últimos 30 min e validação de qualidade. A presença de cinco nomes na lista de fontes **não** atende esse gate.
- **Teste negativo**: quando frame falhar/expirar, camada informa indisponibilidade; exibe apenas mapa-base. Não usar capturas de outro mapa como atalho.

## Gráficos

- **Atualmente**: `OfficialWeatherClient.recentRioHourlySeries()` e `InmetHourlySeries` alimentam os gráficos com até 48 pontos horários válidos de uma estação INMET listada no Rio, sem fabricar horas.
- **Homologação**: escolher uma estação real por localidade, testar série de temperatura, chuva e vento em 24 h; verificar unidade, fuso America/Sao_Paulo, valores nulos, buracos, mudança de estação e validade. Não chamar gráfico de série de todo o município se a origem é uma estação.
- Para os **92 municípios**, admitir explicitamente ausência de estação local; não preencher a série com outro estado, cidade vizinha ou previsão como se fosse observação.

## Voz — teste físico obrigatório, não substituível pelo CI

1. Celular Android real, com permissão de microfone **negada**: nenhuma captura deve iniciar; mensagem de permissão clara.
2. Permissão **concedida**: perguntas por voz, reconhecimento PT-BR, consulta meteorológica e resposta correta com origem e hora ou estado de indisponibilidade.
3. Voz feminina PT-BR: checar a voz instalada no TTS real. O sistema Android pode não dispor dessa voz; **o aplicativo não deve declarar voz feminina comprovada sem teste físico**.
4. Ciclo de vida: apagar/voltar da tela, app em segundo plano, sem internet, voz desativada, pergunta cancelada. Testar que o microfone para em `ON_STOP` e que não há reprodução de resposta antiga.

## Assinaturas — teste físico Play obrigatório

1. Concluir identidade e habilitação da conta no Google Play Console e cadastrar IDs/base plans reais. **Nenhum preço ou produto inventado**.
2. App assinado e instalado via **faixa de teste do Play**, conta de testador/licença, compras mensais/anuais, cancelamento, renovação, falha/offline, recuperação e pagamento pendente.
3. Backend valida compra com Android Publisher e relaciona corretamente assinatura/usuário. Bloquear premium se entitlement não verificado e impedir replay; não liberar premium com código de retorno de compra apenas.
4. Alertas públicos oficiais P0 **não** dependem da assinatura. Fluxos Samsung/Amazon têm faturamento separado e não devem usar Google Billing indevidamente.
5. Guardar comprovação com identificadores **redigidos**, nunca tokens de pagamento, documentos pessoais ou keystore em evidências públicas.

## Gate de publicação

Um CI verde de backend e emulador prova **compilação, consistência de código e interação simulada**, não fornece:
- 24 horas de coleta real contínua dos cinco produtos específicos com licença, frescor, séries válidas e registros da origem;
- frames de radar espacial devidamente autorizados;
- teste físico completo de microfone/voz feminina no celular;
- compras reais de teste pela distribuição Google Play e verificação do backend;
- liberação da publicação pelas lojas.

Até que esses critérios sejam comprovados e revisados, **não declarar homologação ponta a ponta, não fazer deploy/merge da PR de prontidão sem revisão e não distribuir novos APKs grandes no celular**. Não confundir uma fonte indisponível com ausência de chuva, tempestade ou risco.

## Caminho de validação sem novos downloads no celular

1. CI: `backend/npm test`, `gradlew :app:assembleDebug :app:testDebugUnitTest`, testes de emulador e screenshots pelo GitHub Actions (workflow `rj-ui-review.yml` atualizado para PRs novas).
2. Backend: registrar logs agregados de erros por fonte, snapshots de frescor, cobertura por produto e por município, sem copiar dados nem segredos.
3. Habilitação de fonte: somente após autorização de uso e credencial necessária; coordenar a coleta real no Cloud Run.
4. Google Play + telefone: **uma única instalação de teste final via canal apropriado**, após verificar a conta e configurar assinatura, em vez de sucessivos APKs grandes no Termux.

**Estado auditável atual:** backend e mapa/INMET parcial implementados; controle de disponibilidade das cinco fontes proposto; INPE/Windy, radar espacial completo e verificação física de voz/compra **não comprovados**.
