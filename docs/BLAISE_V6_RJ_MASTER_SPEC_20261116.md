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
