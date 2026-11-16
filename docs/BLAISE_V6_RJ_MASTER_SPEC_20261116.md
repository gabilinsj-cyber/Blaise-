# Blaise V6 RJ — especificação mestre preservada (16/11/2026)

**Natureza:** registro de requisitos da interface e funções, não comprovação de dados ou execução em tempo real.

## Política de preservação
- Não apagar, resetar, sobrescrever ou publicar sobre o cliente original (`br.com.blaise.rj`), os 12 agentes anteriores, o Agente 13, o job NOAA ou backups.
- As variantes do Android são separadas: Debug `br.com.blaise.rj.debug`, privada Administrador `br.com.blaise.rj.admin`, cliente original `br.com.blaise.rj`.
- Credenciais de fontes, acesso IAM, APIs, segredos e autorização administrativa ficam no backend. Não embutir chaves no APK. Dados coletados mínimos.
- **Nunca inventar meteorologia:** ausente ≠ zero; sem fonte atual, mostrar indisponibilidade e não emitir avisos falsos.

## Interface visual aprovada
Referência do usuário: painel horizontal azul-marinho brilhante/neon, dourado, Blaise, botão LIGADO verde, microfone, faixa de alerta oficial, duas cidades e mapa meteorológico grande do RJ ao centro.

1. **Cabeçalho:** Blaise V6 RJ, controle geral LIGADO/silencioso manual, voz, data/hora de Brasília, notificações, configurações, ajuda.
2. **Faixa de alertas:** severidade, atualização, fonte e janela de validade. Alertas oficiais distintos de análise científica.
3. **Coluna esquerda:** cidade 1, temperatura, sensação térmica calculada, umidade, vento, rajadas, chuva, alertas, mar/ondas e previsão.
4. **Centro:** mapa próprio de 92 municípios, temperatura, chuva, vento, satélite, informações rodoviárias e radar municipal **apenas com frames georreferenciados reais licenciados e datados**; últimos 30 min com pausa/reprodução, sem interpolar ou sintetizar quadros.
5. **Coluna direita:** cidade 2, risco/alertas, trânsito e incidentes oficiais.
6. **Faixa inferior:** gráficos com natureza/horário, qualidade do ar, risco de deslizamento, sismos, notícias e navegação.
7. **Modo vertical:** painéis empilhados com cidades em destaque e mapa ampliável, mantendo acessibilidade e controles sem sobreposições.

Os números e alertas vistos na imagem aprovada de **15/09/2026** são *ilustração histórica*, não dados em tempo real.

## Fontes — decisão revisada em 16/11/2026 (SUBSTITUI regras anteriores)
**Regra obrigatória:** toda medição meteorológica PUBLICADA (território RJ, municípios e marítimo) deve vir de um produto de origem internacional com licença comercial, atribuição, data/hora, validade e escopo geográfico verificados. Origem internacional **não basta** para uso comercial.

- **Internacionais candidatas:** NOAA (meteorologia/ondas/correntes e produtos claramente identificados), EUMETSAT (apenas produtos licenciados para esse uso, inclusive OSI SAF CC-BY 4.0 quando aplicável), JAXA GSMaP (chuva satelital, conforme modalidade/atribuição e comunicação de uso comercial exigida) e OpenWeatherMap (plano efetivo, atribuição e direitos de aplicação comercial aprovados).
- O Agente 13 segue com limite interno de **900 chamadas/dia**, cache 60 segundos, contador persistente, privacidade e fail-closed. Não confundir limite interno com franquia contratada; não consumir consultas em testes.
- **INMET, Alerta Rio e Defesa Civil RJ:** somente consultas de referência **internas no backend isolado, com intervalo mínimo de 30 minutos e exclusivamente quando permitido pelas condições de uso**. Não importar, copiar ou exibir suas medições em cartões, mapas, gráficos, previsões, voz ou API pública.
- Uma diferença detectada em revisão interna pode solicitar **nova coleta independente de provedores internacionais**. Nunca corrigir o valor internacional pela leitura brasileira se isso criar derivação de uso não autorizado.
- Fontes brasileiras de observação anteriormente aprovadas (incluindo INPE/CPTEC, CEMADEN, ANA e SGB/SACE) deixam de alimentar a meteorologia pública até nova autorização explícita; não converter seus produtos em entradas públicas por caminhos indiretos.
- **Radar:** não republicar quadros do Sumaré nem exibir quadros de terceiro sem licença. Satélite JAXA/EUMETSAT ou estimativa de chuva são produtos distintos de radar; rotular corretamente. Mapa geográfico e interface podem continuar próprios.
- **Emergências/P0:** avisos de Defesa Civil são assunto distinto de medições meteorológicas. Preserve canais oficiais (Cell Broadcast nativo, SMS, links) e avalie separadamente permissão de retransmissão. Uma rechecagem meteorológica de 30 minutos NÃO pode retardar alertas de risco imediato.
- **Fontes excluídas:** INEA, Marinha do Brasil/CHM, Windy e Copernicus. Não reintroduzir.

**Fundamentação e licenças (por produto, não por marca):**
- Sistema Alerta Rio: https://www.sistema-alerta-rio.com.br/institucional/termos-de-uso/ (limita reprodução/comercialização sem autorização expressa).
- COR.Rio: https://cor.rio/politica-de-privacidade/ (conteúdo sujeito a restrições).
- NOAA/NWS: https://www.weather.gov/disclaimer (domínio público quando aplicável, ressalvas de dados de terceiros).
- EUMETSAT OSI SAF: https://osi-saf.eumetsat.int/licensing-and-attribution (CC BY 4.0 com atribuição).
- JAXA GSMaP: https://sharaku.eorc.jaxa.jp/GSMaP/registration.html (condições e cadastro; verificar obrigações específicas).
- OpenWeatherMap: https://openweathermap.org/faq (atribuição/uso conforme plano).

## Agentes (cadastro, não prova de execução)
1. Sentinel RJ — origem, autorização e frescor.
2. Vector RJ — física e cálculos científicos.
3. Fusion RJ — observações comparáveis.
4. Track RJ — trajetória e tempo estimado.
5. Hydro RJ — chuva, rios e alagamentos.
6. Ocean RJ — mar e ciclones.
7. Seismo RJ — sismos e tsunami.
8. Audit RJ — reavaliação de evidências.
9. Correção Horária RJ — verificações periódicas.
10. Auditoria Profunda RJ — integridade, escala.
11. IA Pesquisa e Respostas — perguntas com fontes citadas.
12. GeoFusion RJ — georreferenciamento para comparação interna permitida; não fornece medições brasileiras à interface pública.
13. OpenWeather RJ — cache, quota 900/dia, supervisão isolada, sem consumo de consultas nos testes.

Cada agente deve ter indicador de **estado realmente verificado** pelo supervisor (sem inventar ONLINE). O cadastro no Android **não comprova** atividade no Cloud Run.

## Cálculos científicos armazenados
O backend contém **37 métodos exportados** em `backend/src/blaise-scientific-kernels.mjs` e seus módulos reexportados, incluindo umidade, ponto de orvalho, vento/rajadas, advecção, cisalhamento, helicidade, CAPE/CIN, pressão, chuva radar calibrada, balanço hídrico, evapotranspiração, ondas, tsunami condicional e métodos estatísticos. `evaluateScientificJobs` exige data/hora, escopo geográfico RJ, fonte HTTPS, qualidade VALIDATED, tipo OBSERVADO/MODELO e tempo comparável; retorna `CALCULATED_INPUTS_ONLY` ou `UNAVAILABLE`.

No Android, sensação térmica e ponto de orvalho só poderão ser calculados de **entradas internacionais observacionais licenciadas e atuais**; a alimentação doméstica anterior permanece desativada. Os demais só poderão exibir valor quando o backend autenticado fornecer entradas e resultados reais; o registro dos métodos não significa que estejam conectados.

## Pontos de bloqueio ainda abertos
- Confirmar leituras internacionais atuais por município, licenciamento comercial do produto, atribuição, relógio e contratos reais; com 92 municípios nem todos terão cobertura independente verificável.
- Integrar produtos internacionais georreferenciados efetivamente licenciados ao mapa; não apresentar estimativa satelital como radar nem publicar quadros municipais não autorizados.
- Exibir estado autenticado do supervisor dos 13 agentes, incluindo orçamento real do agente 13 e falhas do Firestore.
- Integrar resultado calculado do backend ao Android por API autorizada, nunca executando cálculos com entradas falsas.
- Corrigir a instalação do APK administrador no Android (verificar integridade SHA-256, assinatura, `minSdk`, ABI, conflito de pacote e Play Protect). O status SUCCESS do Cloud Build **não** prova instalação no celular.
- Validar testes unitários/Android, layout horizontal/vertical, acessibilidade, uso de dados e 2.500 minutos gratuitos de Cloud Build quando elegíveis. Não publicar nas lojas sem validação.

## Estado das alterações em 16/11/2026
Branch isolada `integration/rj-v6-full-admin-20261116` herdada de `ui/rj-original-live-layout-20261116`: layout RJ atualizado, catálogo Android dos 37 métodos, cadastro dos 13 agentes com status não presumido, rótulos distintos Debug/Admin/Cliente e testes estáticos de regressão.

**Não houve liberação de um APK final nesta etapa**; o código da branch precisa de validação completa antes de compilar, instalar e distribuir.

## Diagnóstico operacional — 16/11/2026 09h44 (Cloud Shell)
- INMET `https://apitempo.inmet.gov.br/estacoes/T`: `curl exit 56` / `HTTP 000` / `Connection reset by peer`. Não chegou payload válido. Isto **não comprova** que o catálogo esteja desativado globalmente.
- Alerta Rio `https://websempre.rio.rj.gov.br/estacoes/`: `HTTP 200`, `text/html`, **247 bytes**; sem tabela, sem identificadores `Dados Meteorol`, `P. de Orvalho` ou `Umi. do Ar`; possível página de bloqueio/login. **Não usar como medição.**
- Correção na branch isolada: `OfficialWeatherClient.get` exige formato compatível e rejeita HTML de controle de acesso com status `SOURCE_PAGE_NOT_MEASUREMENTS` e conteúdo INMET não JSON como `SOURCE_JSON_MISSING`. A identificação HTTP é transparente; não simular navegador nem contornar controle de acesso.
- Teste de protocolo foi atualizado, mas **a nova compilação Android e a coleta operacional ainda não estão validadas**.
- Próximo passo: receber fonte oficial licenciada/endpoint de observações com resposta utilizável; testar acesso e estrutura no backend isolado. ArcGIS/Geo-Rio fornece **metadados geográficos de estações** e não deve ser promovido a dados meteorológicos instantâneos.
- Manter `indisponível` por município quando não há medição atual do local. Não usar histórico, mapas, estações vizinhas, imagens ilustrativas ou previsão como medição atual.

## Implementação isolada da decisão de 16/11/2026
- Branch `policy/rj-international-weather-20261116` preserva o código original e **desabilita as solicitações brasileiras diretas no APK**; dados meteorológicos ficam indisponíveis até existir contrato/endpoint internacional conectado e validado.
- Desativa o caminho público estadual e o dashboard meteorológico de proveniência ainda não auditada. Verificar separadamente o futuro canal autorizado de alertas de emergência, sem interferir com alertas de sistema.
- `backend/src/rj-international-source-policy.mjs`: somente regras puras de agendamento e aprovação, **nenhum serviço foi ligado ou programado**. Consulta interna exige confirmação legal e é elegível no máximo a cada 30 minutos.
- `backend/test/rj-international-source-policy.test.mjs`: testa bloqueios, intervalos, proveniência e não derivação.
- **Nenhuma informação internacional atual foi confirmada** apenas por alterar essa política. Não afirmar que a interface já está em tempo real nem que o APK final foi gerado.

## Complemento aprovado — divergências e alertas públicos (16/11/2026)
Esta seção **complementa e prevalece** sobre a política internacional anterior no que diz respeito à divulgação de alertas oficiais brasileiros, sem reativar medições brasileiras para cliente.

### Divergência de meteorologia
- **Consulta de referência brasileira autorizada:** somente no backend, em cadência mínima de 30 minutos e segundo direitos de acesso/uso; jamais reproduzir a leitura brasileira na interface dos clientes.
- Ao identificar divergência relevante por variável, município e horário comparáveis, **solicitar uma segunda fonte internacional independente**, com direito de uso comercial e produto próprio recente.
- Se a segunda fonte confirmar qualidade superior ou o dado primário tiver expirado, substituir o valor mostrado com fonte internacional, horário e natureza do produto. Nunca transferir o valor brasileiro para o dado internacional.
- Sem segunda evidência comparável e válida: manter o primário enquanto válido e sinalizar revisão; quando nenhum válido, mostrar **indisponível**. Não fazer média nem interpolar artificialmente.
- **Dados aproximados:** rotular explicitamente como MODELO/ESTIMATIVA/PREVISÃO; o rótulo OBSERVAÇÃO exige observação real. Temperatura, sensação térmica, chuva, vento, rajadas, pressão e produtos marítimos têm comparações separadas.
- Quando a norma de uso brasileira não permitir sequer comparação comercial, não utilizá-la para desencadear correção comercial; revisão internacional pode ocorrer por seus próprios indicadores.

### Alertas públicos oficiais: exceção explícita
- **Permitir um canal separado** para avisos públicos autenticamente publicados por INMET, Alerta Rio, COR.Rio e Defesa Civil RJ, respeitando **direito de retransmissão em aplicativo comercial**.
- Cada aviso exibido deve conter instituição emissora, fonte/link, fenômeno ou orientação emitida, abrangência municipal real, horário de emissão, validade, severidade original e estado ativo/retirado. Não inventar duração nem cobertura.
- Diferenciar **aviso meteorológico** (INMET) de **alerta de risco/proteção à vida** (Defesa Civil). Nenhum modelo internacional revoga alerta oficial. Não converter automaticamente estágio de cidade/risco de deslizamento em alerta P0.
- Quando a autorização de republicação não estiver comprovada, oferecer apenas **link oficial direto** para consulta; não copiar texto, mapas, áudios ou imagem.
- O INMET já dispõe do contrato `/v1/public/rj-status` de avisos. Por segurança, o Android só poderá lê-lo com a variável explícita `BLAISE_RJ_PUBLIC_ALERT_RELAY_AUTHORIZED=true` após autorização e validação do backend; a resposta é sanitizada para remover risco hidrológico, medições, produtos marítimos e outros conteúdos. Por padrão esta variável é **false**.
- Para Alerta Rio, COR.Rio e Defesa Civil RJ, os links oficiais são disponibilizados imediatamente na tela de alertas; retransmissão automática fica pendente de feeds autenticados e licença específica. Não alegar que estejam conectados.
- Alertas de emergência da Defesa Civil no próprio Android/Cell Broadcast seguem independentes; não atrasar um risco imediato pela rechecagem interna de 30 minutos, nem tentar interceptar/duplicar notificações de sistema.
- Atualizar alertas ativos em cadência compatível com gravidade e validade (rechecagem de 1 min na integração inicial, reduzindo com autorização e SLA conforme nível); retirar imediatamente quando fonte comunicar cancelamento e preservar histórico com indicação de encerramento.
- Referências públicas conferidas: https://avisos.inmet.gov.br/ ; https://www.sistema-alerta-rio.com.br/alertas/ ; https://cor.rio/ ; https://defesacivil.rj.gov.br/ .
- **Restrições:** https://www.sistema-alerta-rio.com.br/institucional/termos-de-uso/ e https://cor.rio/politica-de-privacidade/ . A visibilidade pública de aviso NÃO significa licença automática para reproduzir integralmente em app comercial.

### Situação de implementação
- Branch isolada: `policy/rj-official-public-alerts-and-international-arbitration-20261116`.
- Política de arbitragem internacional e filtros de alertas criados; execução operacional do segundo provedor internacional **ainda não conectada**.
- Android: links oficiais para quatro instituições, canal INMET condicionado a autorização explícita; fluxo de meteorologia brasileira pública permanece desligado.
- Os 13 agentes, fontes excluídas, job NOAA e backups não foram alterados nesta branch.
- Testes adicionados; APK e integração real dependem de validação de código, licenças, URLs e implantação.


## Atualização de 16/11/2026 — três fontes internacionais, alertas e notícias somente por link
**Esta seção substitui trechos anteriores que previam reprodução no cliente de níveis 1–5, descrições, gravidades ou histórico textual de avisos brasileiros.**

1. **Meteorologia internacional:** primeira fonte licenciada, verificação por segunda quando houver divergência permitida, e terceira fonte internacional independente se a primeira e a segunda forem conflitantes para mesmo município, fenômeno, unidade, tipo de produto e janela temporal. Não inventar observações, estimativas ou resultados.
2. **Escolha após três consultas:** se o uso de medição brasileira como referência de comparação e decisão comercial for expressamente permitido, publicar o valor **de uma das três fontes internacionais** com a menor diferença absoluta em relação à referência brasileira da mesma variável, lugar e horário. A referência brasileira não será exibida ou embutida no produto internacional. Registrar origem e validade da fonte escolhida. Não prometer equivalência de dados pontuais com estimativas de grade.
3. **Sem direito de usar a referência brasileira:** selecionar por consenso (medoide) entre três fontes internacionais verificadas; em empate usar qualidade/frescor de forma objetiva. Não utilizar a referência brasileira indiretamente para orientar saída comercial.
4. **Divergência não causa indisponibilidade automaticamente:** durante o desempate, manter a última leitura internacional ainda válida com indicação de revisão. Se ao menos uma das fontes estiver válida, publicar o melhor valor internacional comparável com sua categoria correta. Apenas ausência total de fontes válidas pode gerar indisponibilidade; jamais fabricar valor.
5. **Direitos:** identificar o produto exato e a permissão de utilização comercial de cada uma das três fontes. NOAA/JAXA/EUMETSAT/OpenWeather não garantem automaticamente cobertura/localidade, permissão do produto ou disponibilidade do nível gratuito. Respeitar cache, quotas e autorização.
6. **Alertas oficiais:** somente frase neutra e link **para a página da autoridade** (INMET, Sistema Alerta Rio, COR.Rio, Defesa Civil RJ), sem republicar severidade, escala 1–5, evento, texto do aviso, mapas ou imagens. A simples presença de link **não afirma aviso ativo**. Se houver feed INMET autenticado, validado e expressamente autorizado, ele serve apenas para ativar a frase neutra e o botão para o site oficial; emissão e validade são verificadas internamente, mas não reproduzidas nessa faixa. Antes de chegar à UI o objeto é sanitizado para excluir texto e gravidade. Outras autoridades ficam apenas como páginas de consulta até feeds e direitos serem confirmados.
7. **Notícias nacionais/internacionais:** exibir somente frase genérica que conduz à notícia, nome da fonte e link de origem. Não transcrever manchete, corpo da matéria ou outros detalhes; a data pode ser verificada internamente, sem reproduzir o texto original. Link de terceiro não comprova atualidade além do timestamp verificado.
8. **Emergências:** alertas governamentais nativos (Cell Broadcast) não são bloqueados nem atrasados; modelo internacional não cancela orientações da Defesa Civil. A verificação meteorológica de 30 minutos não rege esses alertas.
9. **Estado técnico:** política e verificações de código na branch `policy/rj-three-international-link-only-20261116`. Não existe ainda orquestrador real que faça três requisições internacionais, nem alimentação licenciada e validada no APK. Testes estáticos/unitários não equivalem a validação operacional ou aprovação legal. Preservar projeto original, 13 agentes, job NOAA, backups e todas as exclusões persistentes.

## Nova regra visual de alertas — 16/11/2026 (estágios 1 a 5)

**Esta seção prevalece sobre a antiga orientação de não exibir números e cores.** Usar apenas metadados oficiais suficientemente verificados, sem reproduzir os textos integrais de terceiros. A classificação 1–5 pertence ao Blaise e **não equivale automaticamente** à escala oficial de qualquer emissor. O mapeamento de cada fonte depende de regras revisadas, verificáveis, autorização e validade.

| Estágio Blaise | Fundo hexadecimal | Escrita | Frase curta do Blaise |
|---|---|---|---|
| 1 | `#4ADE80` verde | preto/negrito | Atenção baixa: consulte a orientação oficial |
| 2 | `#A3E635` verde-limão | preto/negrito | Atenção preventiva: consulte a orientação oficial |
| 3 | `#FACC15` amarelo | preto/negrito | Atenção meteorológica: consulte a orientação oficial |
| 4 | `#FB923C` laranja | preto/negrito | Alerta elevado: consulte a orientação oficial |
| 5 | `#F87171` vermelho | preto/negrito | Alerta extremo: consulte imediatamente a orientação oficial |

Layout: número grande na frente, frase curta em negrito preto, fonte, data/hora de verificação, e link direto para **a publicação ou página oficial HTTPS** da entidade. Sem copiar seu boletim, notícia ou imagem.

**Estágio 5:** uma única fala curta em português: “Blaise V6 Rio de Janeiro. Atenção: alerta no estágio cinco confirmado para uma cidade selecionada. Abra a fonte oficial para orientações e informações.” Em seguida três bipes audíveis e três vibrações (200ms/pulso, apenas quando dispositivo e usuário habilitarem). Permissões Android e modo Não Perturbe devem ser respeitados. A fala usa voz do sistema já configurada no Blaise quando disponível.

**Disparo único por transição:** ao entrar em 5 partindo de 1–4 ou ao detectar um novo alerta distinto já emitido em 5, registrar persistentemente identificador autenticado do aviso, instituição, município e último estágio; atualização da tela, reabertura e reconsulta não repetem o áudio/bipes/vibrações. O mesmo aviso só poderá voltar a disparar após sair efetivamente de 5 e voltar a 5 com evento de atualização novo e verificado. Não permitir pacotes fora de ordem rearmar o aviso.

**Avisos governamentais nativos (Cell Broadcast)** continuam prioritários e nunca são interceptados, limitados pelo Blaise ou ocultados.

**Gate de segurança:** nenhum som/vibração é disparado a partir de um texto genérico, valor meteorológico, previsão, número inferido ou link sozinho. Exigir origem HTTPS conhecida, identificação/autenticidade do boletim, localidade confirmada, revisão de mapeamento, direitos de exibir estágio/metadata, tempo atual e validade. Não anunciar “1 — sem risco” sem evidência de cobertura.

**Estado técnico em 16/11/2026:** branch `policy/rj-five-stage-alert-audio-once-20261116` contém modelo de estágios, componente visual reutilizável, controle local persistente de evento e player de fala/bipe/vibração. **O novo feed autenticado com estágio 1–5 ainda não foi conectado ao app, push em segundo plano não está validado e o APK não foi compilado.** Portanto estas rotinas não representam um alerta operacional ativo. Nenhuma alteração ao aplicativo original, job NOAA, 13 agentes ou backups.
