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

## Fontes permitidas e exclusões
- Observação/alerta local: **Alerta Rio + Defesa Civil RJ**; desempate por produto com **INMET**.
- Complementos segundo fenômeno/licença: **INPE/CPTEC, NOAA, CEMADEN, JAXA/GSMaP, EUMETSAT, ANA e SGB/SACE**.
- Radar Sumaré: **COR.Rio/Alerta Rio**, quadros reais autorizados; mostrar origem e timestamp por quadro.
- **OpenWeatherMap**: Agente 13 complementar, consulta sob demanda, orçamento persistente interno de **900 chamadas/dia**, cache e supervisão fail-closed; não substitui avisos oficiais. Não chamar provedor nos testes.
- **Excluídas:** INEA, Marinha do Brasil/CHM, Windy, Copernicus. Não reintegrar sem autorização explícita.

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
12. GeoFusion RJ — georreferenciamento das estações Alerta Rio; fusão ponderada somente licenciada e validada.
13. OpenWeather RJ — cache, quota 900/dia, supervisão isolada, sem consumo de consultas nos testes.

Cada agente deve ter indicador de **estado realmente verificado** pelo supervisor (sem inventar ONLINE). O cadastro no Android **não comprova** atividade no Cloud Run.

## Cálculos científicos armazenados
O backend contém **37 métodos exportados** em `backend/src/blaise-scientific-kernels.mjs` e seus módulos reexportados, incluindo umidade, ponto de orvalho, vento/rajadas, advecção, cisalhamento, helicidade, CAPE/CIN, pressão, chuva radar calibrada, balanço hídrico, evapotranspiração, ondas, tsunami condicional e métodos estatísticos. `evaluateScientificJobs` exige data/hora, escopo geográfico RJ, fonte HTTPS, qualidade VALIDATED, tipo OBSERVADO/MODELO e tempo comparável; retorna `CALCULATED_INPUTS_ONLY` ou `UNAVAILABLE`.

No Android, sensação térmica e ponto de orvalho são calculados de uma **estação local válida**. Os demais só poderão exibir valor quando o backend autenticado fornecer entradas e resultados reais; o registro dos métodos não significa que estejam conectados.

## Pontos de bloqueio ainda abertos
- Confirmar leituras atuais por município, credenciais/permissões/licenciamento, relógio e contratos reais de todas as fontes; com 92 municípios nem todos terão estação ativa.
- Integrar frames de radar oficiais georreferenciados ao mapa; a estrutura atual de desenho não é feed.
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
