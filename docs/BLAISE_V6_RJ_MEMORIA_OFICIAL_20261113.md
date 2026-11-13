# Blaise V6 RJ — Memória de produto integrada ao repositório
**Consolidação:** 13/11/2026. **Estado:** especificação e contrato Kotlin em branch isolada; não é release nem comprovação de dados ao vivo.

## Identidade e precedência
- Projeto exclusivo **Blaise V6 RJ — Rio de Janeiro**, com **92 municípios** e Atlântico adjacente relevante ao RJ. Proibido misturar outro estado, especialmente Paraná, ou o projeto independente Alemanha.
- Decisões de remoção recentes substituem quaisquer menções históricas em relatórios: **INEA, Marinha do Brasil/CHM, Windy e Copernicus estão excluídos** de fontes ativas, interface, novos coletores e critérios de pronto. Referência antiga é arquivo histórico, não autorização.
- A memória do ChatGPT e documentos humanos são **requisitos**, não dados meteorológicos nem funcionalidades automaticamente embutidas. Não copiar diálogos pessoais, tokens ou histórico de localização para APK.
- A referência visual aprovada foi fornecida neste chat e consta no acervo como **Painel Blaise V6 RJ: Clima e Notícias.png**. Outra referência histórica é **1000007912.png**. Comparar a versão visual mais recente antes do teste de fidelidade; sem usar valores/alertas estáticos da imagem como dados atuais.
- Não substituir fontes, personagem/voz ou interface aprovada por outros projetos. Confirmar versão do avatar aprovada mais recentemente na comparação visual.

## Interface Android obrigatória
- Identidade azul-marinho/neon, logotipo **Blaise V6 RJ**, botão verde **LIGADO** por padrão; campo **Como posso ajudar?**, microfone com envio automático ao terminar a fala e alternativa de digitação.
- **Cidade 1 e Cidade 2** independentes, seleção alfabética dos 92 municípios; Centro do Rio sob consulta, nunca inferir medição de outra estação como sendo do Centro.
- Mapa meteorológico **próprio** do RJ, central e dominante, com camadas de radar, chuva, temperatura/sensação, vento, nuvens, alertas e riscos; não usar imagem de mapas externos como simulação de radar real. Quadros do radar Sumaré aproximadamente a cada 2 minutos quando houver quadros oficiais, retrospecto de 30 minutos, sem interpolação.
- Gráficos legíveis de **3 dias anteriores + hoje + 5 dias seguintes**, com observações e previsões diferenciadas e exibidas somente quando a fonte fornecer a série válida.
- Painéis: alertas oficiais, duas cidades, previsão, trânsito CET-Rio/COR.Rio/Geo-Rio/Defesa Civil, risco de deslizamento, mar e ondas, qualidade do ar, notícias RJ + 1 internacional, dois maiores sismos recentes relevantes, histórico, ajuda e configurações.
- Exibir **origem, hora de emissão/observação, data de validade, natureza OBSERVADO/MODELO/PREVISÃO/CÁLCULO_BLAISE/ALERTA_OFICIAL**, e status de disponibilidade. Se dado falta ou vence, exibir **INDISPONÍVEL NO MOMENTO** e travessão em campos numéricos; não exibir falsa condição segura.

## Monitoramento, alertas e disponibilidade
- Intervalos-alvo: normal 5 min; severo 1 min; extremo 25–30 s, respeitando a frequência/licença da fonte. O agendamento de consulta **não transforma** medição antiga em recente.
- Eventos severos: coletar e validar, recalcular comparações e incerteza, publicar apenas dados válidos; nunca gerar alerta oficial a partir de cálculo privado.
- Alertas ausentes de atualização: depois de 3h, marcar **expirado em revisão**; depois de 4h, rebaixar 5→3 e 4→2 conforme política; após 12h, remover de ativos, mantendo apenas histórico permitido. Retirada explícita pela fonte ⇒ retirada imediata. **Falha de rede ≠ retirada oficial.**
- P0 oficial visível também a não assinantes; demais funções dependem de assinatura verificada.
- Não fazer experimento em eventos graves; exigir gates, canary/rollback e teste antes de release.

## Fontes aprovadas e separação de funções
- Principais: Alerta Rio/COR.Rio e Defesa Civil RJ; desempate INMET; CEMADEN em produtos próprios. Ordem de desempate complementar: INMET → INPE/CPTEC → NOAA → CEMADEN → JAXA/GSMaP → EUMETSAT, conforme pertinência do produto.
- Marítimas: INMET, INPE/CPTEC, Defesa Civil RJ, NOAA, CEMADEN, EUMETSAT, JAXA/GSMaP. Sismos: USGS e autoridades reconhecidas; tsunami: autoridades competentes e NOAA conforme produto real.
- Trânsito: CET-Rio/COR.Rio/Geo-Rio/Defesa Civil conforme atribuições oficiais, sem confundir meteorologia com ocorrência operacional.
- Cada integração requer acesso autorizado, licença, validação de endpoint/escopo geográfico/frescor/calibração, testes e observabilidade antes de ser exibida como LIVE_VALIDATED.
- Sem coleta não autorizada, sem inventar precipitação, onda, maré, horário de chegada, probabilidade ou diagnóstico de risco.

## Calculadora científica e agentes
- Preservar o backend **blaise-scientific-kernels**, **blaise-marine-kernels**, **blaise-scientific-jobs**, **blaise-scientific-store** e **official-source-scheduler**. Não afirmar que a existência do núcleo prova fornecedores de perfis reais.
- Núcleos encontrados: água precipitável, gradientes e convergência, vorticidade/divergência, cisalhamento, helicidade, θe aproximada, KDP com calibração, tensão de vento oceânico, TCHP, tendência de pressão, evapotranspiração, balanço do solo e dispersão de ondas. Todos com entrada proveniente de fontes validadas, unidades, domínio e idade.
- Catálogo solicitado também inclui CAPE/CIN/LI/LCL/LFC/EL, dewpoint/bulbo úmido, advecção, precipitação e extrapolação de radar, MSLP, velocidade de chegada e outros cálculos; **não presumir implementação** até testes. Cálculo é identificado como CÁLCULO_BLAISE, nunca ALERTA_OFICIAL.
- Dez agentes internos: correção contínua, checagem horária, rotina 01h, auditoria/limpeza 24h, cálculos severos, trânsito, marítimo, voz/perguntas, fiscalização de fontes/domínios e segurança/escala. Tratar como atribuições a implementar/testar, não como dez serviços comprovadamente ativos.
- Relatórios científicos privados de até 24h; apresentar ao assinante somente resumos pertinentes, com fonte e horário.

## Voz e perguntas
- Pronúncia do nome **bleiss**, escrita Blaise. Fala solicitada com envio automático ao fim do reconhecimento. Responder perguntas compostas e localizar corretamente município/bairro/estação; perguntar contexto quando indispensável.
- Preservar o catálogo de perguntas de clima, chuva, vento, UV, radar, encostas, praia, aviação, mar, sismos, maré, tráfego e outros temas já documentados em **Blaise_V6_RJ_Perguntas_Assistente.md**; converter em testes de intenção e resposta (não texto estático).
- Sem histórico desnecessário de voz/localização, sem exposição de dados privados de assinantes.

## Assinaturas, segurança e release
- Valores definidos para RJ: R$ 3,93/mês e R$ 35,00/ano; não afirmar disponibilidade na loja até os IDs e a autenticação estarem configurados.
- Backend de produção **blaise-v6-rj-backend** (Google Cloud Run, southamerica-east1) deve ser preservado e **não sofrer deploy/alteração de tráfego** nesta etapa.
- Cloud Shell de trabalho **~/Blaise-RJ** e backups não podem sofrer reset, limpeza, pull indiscriminado, sobrescrita ou checkout destrutivo. Branch de teste também preservada.
- GitHub Actions **Android Runtime** apresentou startup_failure antes de executar jobs; o status não é diagnóstico de Kotlin. APK só pode ser anunciado quando o arquivo real existir, estiver assinado para teste e for verificado em dispositivo/emulador.
- Sem publicar Google Play, Samsung, Amazon ou produção sem fonte operacional, licenças e testes adequados.

## Integração nesta branch (13/11/2026)
- Novo **RjProductMemory.kt** codifica contratos imutáveis de produto, fontes, módulos, política de atualização, validade, retenção e tópicos científicos.
- **FinalDashboardSpec.officialSources** passa a referenciar **RjProductMemory.approvedSources**, impedindo a reintrodução de fontes excluídas pela lista da interface.
- **RjProductMemoryTest.kt** exercita restrições de geografia, fontes, atualização, frescor e alertas (execução de testes ainda pendente).
- Próximas etapas necessárias: vincular os demais componentes visuais ao contrato; localizar, adicionar e conferir os assets gráficos aprovados; auditar coletores legados, preservar retrocompatibilidade, comprovar dados de fontes; testar Gradle/Android 35; gerar **APK debug real**, conferir interface em Android, validar segurança e funções.
- **Não foi feita compilação, implantação, publicação nem merge.**

## Referências humanas de origem
- Referencia_Definitiva_Blaise_V6_RJ_atualizada.md (histórico, validar precedência de decisões recentes)
- Blaise-V6-RJ-consolidacao-interface-2026-10-28.md
- Blaise_V6_RJ_Perguntas_Assistente.md
- Imagem de interface fornecida pelo usuário neste chat
