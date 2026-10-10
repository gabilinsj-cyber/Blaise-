# BLAISE V6 RJ — consolidação técnica da especificação aprovada

**Escopo obrigatório:** Blaise V6 RJ, estado do Rio de Janeiro, 92 municípios, litoral e áreas adjacentes do Atlântico com potencial impacto RJ. Não transportar recursos de projetos de outros estados. Repositório: `gabilinsj-cyber/Blaise-`. Situação deste trabalho: PR de desenvolvimento em rascunho; nenhuma publicação automática.

Este registro consolida requisitos das conversas anteriores. Ele explicita **requisitos**, **código existente** e **pendências reais**; não assume que a simples criação de um arquivo equivale à operação contínua de 10 processos autônomos.

## Dez agentes funcionais

| Agente | Nome | Responsabilidade | Situação |
|---|---|---|---|
| 1 | **Blaise Sentinel RJ** | Examinar HTTPS, identidade/licença de fontes oficiais, horário, município, falha segura, proteção contra domínio alterado e dado inventado | Coletores, contratos e verificações parciais no backend |
| 2 | **Blaise Vector RJ** (histórico: Sigma AI) | Calcular/recalcular por ocorrência; parâmetros físicos, validação de faixas e domínio, erros e incerteza; 5 motores científicos | Biblioteca e testes numéricos, sem pretensão de executar modelos globais |
| 3 | **Blaise Fusion RJ** | Comparação e média ponderada de dados oficiais compatíveis, reconciliação de fontes e de horários; Windy apenas orientação complementar | Média ponderada com vetos implementada em biblioteca |
| 4 | **Blaise Track RJ** | Direção, advecção, velocidade e ETA de eventos e trajetórias baseadas em vetores/frames reais | Kernels de movimento; chuva de radar em tempo real pendente |
| 5 | **Blaise Hydro RJ** | Chuva, cotas, vazões, cheias, inundação e risco de deslizamentos; 92 cidades segundo disponibilidade | CEMADEN/Alerta Rio parcialmente; serviços ANA/SGB/SACE pendentes |
| 6 | **Blaise Ocean RJ** | Ressaca, ondas, rajadas marítimas, ciclone extratropical, Atlântico/temperatura oceânica | Marinha e alguns kernels; NOAA e campos oceânicos ainda pendentes |
| 7 | **Blaise Seismo RJ** | Dois abalos recentes relevantes, sismo Atlântico com potencial impacto RJ, checagem de tsunami e confirmação por autoridades | Painel e roteamento previstos; catálogo sísmico ao vivo e mecanismo de confirmação pendentes |
| 8 | **Blaise Audit RJ** | Auditar ciência, proveniência, igualdade de fenômeno/tempo/região, nível 1–5, risco de alarme falso, rastreabilidade e testes | Validações, CI, auditoria local implementada parcialmente |
| 9 | **Correção Horária RJ** | Diagnosticar regressões de cada camada, segurança, mudança de domínio, anti-bug; propor patch e revalidar; jamais publicar sem gate | **Nome funcional do histórico**; agendamento/execução autônoma não implementados |
| 10 | **Auditoria Profunda RJ** | Verificação 01h, correção mais profunda, anti-abuso/antivírus compatível, armazenamento, escalabilidade, relatórios e ferramenta paga mais adequada a cada 500 mil assinantes; revisão mensal de atualização dia 20 | **Nome funcional do histórico**, nome próprio anterior não comprovado; marcos e listas de verificações documentados/testados; execução e compra não automatizadas |

Os primeiros oito nomes são os recuperados na lista nomeada; **9 e 10** são rótulos funcionais usados no planejamento, e não devem ser divulgados como nome original confirmado. Agente 8 audita **dados e ciência**, enquanto o 10 audita **infraestrutura, segurança, capacidade e custos**.

**Código de registro e roteamento:** `backend/src/rj-agent-registry.mjs`, `backend/src/rj-agent-orchestration.mjs`. O campo `runtimeStatus` declara explicitamente `SPECIFIED_NOT_AUTONOMOUSLY_DEPLOYED`; não há dez processos instalados nem compra automática.

## Calculadora científica e níveis de desenvolvimento

Prioridade: usar dados **oficiais, autorizados, atuais e com cobertura comprovada**. Entradas do modelo (Windy/NOAA etc.) são indicadas como modelos, nunca observações. As operações locais são **complementares**, sem executar ECMWF IFS, GraphCast, Pangu, FourCastNet ou modelos globais.

### Implementado em bibliotecas numéricas com testes ou testes em desenvolvimento
- Advecção linear em coordenadas métricas, movimento de feature com velocidade e horizonte limitado (sem pixel radar criado).
- Temperatura potencial equivalente aproximada, Clausius–Clapeyron e pressão de vapor de saturação.
- Ponto de orvalho; umidade relativa por temperatura/ponto de orvalho; razão de mistura e umidade específica.
- Temperatura de bulbo úmido empírica de Stull no domínio permitido.
- Temperatura virtual média e pressão reduzida ao nível do mar pelo método hipsométrico mediante perfil justificado.
- Gradiente térmico vertical por observações explícitas; tendência barométrica da mesma estação/tipo de pressão.
- Diagnóstico de vorticidade, divergência, convergência, deformação e convergência do fluxo horizontal de umidade, somente com gradientes métricos.
- Água precipitável por pressão/perfil de umidade **somente para a camada medida**.
- Cisalhamento 0–1/0–6 km e helicidade relativa da tempestade por perfis de vento interpoláveis e vetor da tempestade.
- CAPE e CIN por integração numérica de **perfis de temperatura virtual ambiental e da parcela fornecidos, contínuos e validados**; **não** levantar parcela, deduzir LFC/EL ou prever tornado automaticamente.
- Fórmulas de índice de calor/vento-frio apenas nos domínios adequados; fora deles, não forçar sensação térmica fictícia.
- Chuva acumulada nas janelas 5, 10, 15, 30, 60 minutos e 24 h **somente** por segmentos reais contínuos, homogêneos, completos e da mesma estação.
- Radar Z–R e KDP **somente quando houver política de calibração real por banda, local e período**. Não existe ingestão de radar licenciada concluída.
- Evapotranspiração FAO-56, balanço hídrico do solo, perfil logarítmico de vento, tensão do vento na superfície do mar, espectro de ondas, relação de dispersão e potencial térmico de ciclone tropical (não confundir com diagnóstico de ciclone extratropical).
- MOS/regressão calibrados e passo escalar de Kalman: exigem políticas/coeficientes/variâncias calibrados e validação histórica; não declarar precisão local sem histórico.
- Média ponderada de medições oficiais contemporâneas, com município, estação, local, unidade e pesos explicitamente justificados; recusar misturar estados, modelos como observações, escala de alerta, dados antigos ou estações incompatíveis.

### Ainda pendente de evidência/implementação física
- Autocorrelação/correlação cruzada e extrapolação de **frames radar reais** com georreferenciamento, velocidade e skill demonstrados.
- Levantamento termodinâmico completo da parcela e determinação robusta de **LCL, LFC, EL**, parcel ascent e todas as variantes de CAPE/CIN;
  radiais ZDR, KDP, ρhv calibrados por radar, correções de VPR, atenuação e granizo.
- Helicity ambiental integrada em múltiplos níveis, gradiente de pressão com geoespacialidade real, transporte de vapor integrado nas verticais, fluxos hidrológicos medidos, estatística de erro e backtests regionais.
- Nowcasting municipal validado, previsão 5/10/15/30 minutos, ETA/área de impacto com intervalo de incerteza comprovado, sem assumir fenômeno futuro.
- Interface Android conectada a todos os cálculos e backend distribuído com cache; os kernels existentes **não** significam que todos estejam sendo mostrados ao usuário.

**Classificação obrigatória das saídas:** `MEDICAO_OFICIAL`, `CALCULO_EXPERIMENTAL_BLAISE` ou `INFORMACAO_INDISPONIVEL`. Cálculo jamais substitui fonte oficial e **não aciona alerta P0** por si só.

## Seleção de fontes e cobertura

Referência normativa: `docs/rj-fontes-por-fenomeno-localidade.md`, `backend/src/rj-phenomenon-source-policy.mjs`.

- Alerta Rio: cidade do Rio, não os 92 municípios. Defesa Civil regional/municipal, CEMADEN e INMET segundo localidade e variável; ANA e SGB/SACE para dados hidro.
- Marinha/CHM, INMET, NOAA, Windy (modelo comparativo) para mar/Atlântico/ciclones/ondas/frentes de massa de ar quente/fria; fonte marítima competente prevalece em avisos.
- Períodos de precipitação e rajadas precisam de unidade, intervalo e validade da própria fonte; nenhuma medição em um município prova cobertura dos outros 91.
- **INEA aposentado** de coletores operacionais e workflow de sondagem. Código legado com testes históricos ainda não autoriza seu uso. Não reintroduzir como referência nem como substituto.
- Segundo requisitos da fonte, validar domínio, política de acesso, horário, georreferenciamento, autoria, espécie de produto e segunda fonte independente para ocorrência crítica. Não utilizar raspagem sem autorização; eventos sem evidência ficam indisponíveis.
- O monitoramento de mudança de domínio/URL deve produzir alerta de manutenção; mudança de origem nunca autorizada automaticamente sem validação humana e técnica.

## Alertas, tempos e regras de segurança

- Severidade **1 verde, 2 amarelo, 3 amarelo de atenção/piscando com ETA justificado, 4 laranja/vermelho moderado, 5 vermelho/roxo extremo**; apenas nível 5 pode ter voz/sirene/vibração.
- Atualização planejada: 1–3 a **5 min**; 4–5 a **1 min**; com **dois avisos oficiais independentes nível 5 e diagnóstico científico extremo** para mesmo fenômeno, município e período: recálculo interno alvo **25 s**. Não solicitar fonte externa 25 s quando ela publica menos frequentemente ou proíbe.
- Dois avisos independentes e diagnóstico só tornam o caso **elegível à revisão pelo publicador de alertas**; controle idempotente, validade de alerta, prevenção de replay, permissões e confirmação permanecem obrigatórios. A implementação de coordenação não envia notificações.
- Ciclones, granizo, alagamento, chuva acumulada, vento/rajadas, deslizamento e risco geológico: cada fenômeno precisa de georreferência, fonte/alerta competente, fase/velocidade e evento confirmado ou possibilidade explicitamente rotulada.
- Sismologia Atlântico: magnitudes e focos rasos são triagem, **não prova automática de tsunami**. Avisos de tsunami requerem fonte marítima/sismológica competente, localidade, emissão e vigência.
- Escala 5 sonora somente conforme regras acima. Quando mais de três alertas, acesso a “Todos os alertas vigentes”.

## Interface final aprovada
- Cabeçalho reduzido **Blaise V6 RJ**, botão Ligar/Desligar verde ligado, avatar feminino reduzido.
- Blaise feminina: “Como posso ajudar?”, entrada digitada e microfone; resposta em voz feminina PT-BR, explicação com fonte e horário.
- Seleção de cidade fluminense e destaque ao município do Rio, faixa estreita de alertas por cidade; **mapa estadual ampliado** com mais zoom e camadas reais licenciadas.
- Notícias RJ duas/três, internacional uma, dois sismos globais recentes, trânsito/bolsões d'água/deslizamentos, mar/ressaca, configurações e controle de voz.
- Radar, gráfico e previsão só exibem dados oficiais vigentes com horário/identificador de fonte. O mapa-base geográfico não é radar.

## Testes e lançamento ainda obrigatórios
- Emulador e testes unitários não equivalem a voz/microfone real ou compra da Google Play. Testar Android físico, microfone negado/permitido, locução feminina, saída/retomada e rede offline.
- Verificação de identidade Google Play e produtos de assinatura mensal/anual, base plans, perfil financeiro, login Firebase vinculado à compra, backend autoritativo, teste com licença Play e política de cancelamento/reembolso.
- Assinaturas: autorização prévia do usuário, antifraude, propriedade de conta verificada e entitlement. Alertas oficiais P0 públicos **independentes de premium**. Preços não devem ser inventados nem ativados antes de aprovação.
- Publicação em Play, Galaxy Store e Amazon Appstore somente após homologação e compatibilidade de assinatura com a loja e autorização requerida. Nada é liberado só porque o CI está verde.
- Segurança em escala: agente 10 mede **assinantes ativos validados pelo backend**; a cada marco de 500 mil (500k, 1M, 1.5M, 2M, 2.5M etc.), preparar novo diagnóstico de Cloud Armor/WAF, Cloud Run, armazenamento, custos, backups, proteção anti-bot e alta concorrência; apresentar ferramentas **mais adequadas**, preço atualizado USD/EUR, link de compra do fornecedor e etapas de integração. **Nunca inventar preço nem comprar automaticamente.**
- Verificação horária/01h e revisão do dia 20 são requisitos; até configurar executores com credenciais IAM mínimas, permanecem **não agendados**. Política de alterações: patch proposto, CI, segurança, evidência e revisão antes de merge/deploy.
- Não baixar mais APKs de 400–500MB no celular para validar cada edição. Trabalhar no GitHub e emulador; só teste físico final quando existir pacote assinado viável.

### Próximos gates
1. CI backend/Android desta PR realmente verde após inclusão dos novos cálculos, agentes e testes.
2. CI visual com screenshot de mapa e gráfico; identificação de qualquer erro.
3. Integração autorizada em backend para ANA/CEMADEN/SGB/INMET/Marinha/NOAA conforme matriz e horários, sem falsas medições.
4. Validação física com conta de teste Play e voz; verificação de capacidade/assinaturas.
5. Só então revisar rascunho, aprovar mudanças e planejar release.
