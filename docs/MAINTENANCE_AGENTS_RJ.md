# Blaise V6 RJ — agentes de manutenção e ciclos de auditoria

Escopo exclusivamente Rio de Janeiro. **Nomes históricos próprios dos dois agentes de manutenção não recuperados**: os nomes abaixo são identificadores funcionais, não alegações sobre nomes passados.

## Papel 9: Correção Horária RJ

Objetivo: identificar a cada 1 hora bugs, páginas travadas, módulos de interface quebrados, integridade das fontes, datas vencidas e perda de atualização em tempo real.
Primeira implementação: workflow `.github/workflows/blaise-rj-maintenance.yml` com prova de saúde e prontidão do backend em HTTPS e sem mutar dados. Requer variável GitHub `BLAISE_BACKEND_BASE_URL` apontando **somente para a origem HTTPS** (sem caminho). Falha fechada quando a URL estiver ausente ou uma das duas rotas não responder corretamente. Gera evidência em `evidence/maintenance/hourly.json`. **Não equivale** a auditoria de dados meteorológicos, correção de bugs do dispositivo, nem a monitoramento contínuo ativo no aparelho. Conector de freshness e diagnóstico da interface real pendentes.

## Papel 10: Auditoria Profunda RJ

Objetivo: às **01:00 de Brasília (America/Sao_Paulo)** verificar os módulos por camada, corrigir erros complexos com validação e reintegrar as partes.
Primeira implementação: workflow de testes do backend, contratos, lint e testes unitários Android, com registro explícito de limites. Não instala APK, não edita código automaticamente, não faz deploy Cloud Run e não comprova integração ao vivo. Bugs complexos exigem correção analisada, testes e gate de promoção antes de afetar produção. Cron UTC `0 4 * * *` equivale a 01:00 no horário atual do RJ; atrasos do agendador GitHub são possíveis.

## Dia 20: ciclo de atualização

Todo dia **20 às 01:15 de Brasília**, gerar relatório de prontidão e dependências para atualização. Pode haver revisão extraordinária por falhas severas a qualquer dia. Preparar, assinar e publicar para Google Play, Samsung Galaxy Store e Amazon Appstore são etapas separadas, não executadas automaticamente por este workflow. Publicação exige credenciais, testes em mesmo commit, compatibilidade de lojas e aprovação do portal. Um ZIP de CI não significa release publicado.

## Mapa funcional dos dez agentes

1. **Blaise Sentinel RJ** — fiscalização de sites, domínios, APIs e fontes oficiais.
2. **Blaise Vector RJ** — núcleo científico de cálculos e revalidação.
3. **Blaise Fusion RJ** — fusão estatística e tratamento de discrepâncias.
4. **Blaise Track RJ** — trajetória e tempo de chegada condicional.
5. **Blaise Hydro RJ** — rios, cheias, chuva e inundações.
6. **Blaise Ocean RJ** — oceano, ressaca, ondas e ciclones.
7. **Blaise Seismo RJ** — sismos e hipóteses de tsunami.
8. **Blaise Audit RJ** — auditoria científica de dados e classificações.
9. **Correção Horária RJ** — verificação operacional horária, com etapa inicial implementada.
10. **Auditoria Profunda RJ** — testes noturnos e coordenação de qualidade para releases.

Estes são **dez papéis de monitoramento e qualidade previstos**, e não dez serviços independentes comprovadamente ativos. Fusion, Track, Ocean, Hydro, Seismo e Audit podem ser módulos coordenados pelo Vector. Sem fonte oficial confiável, exibir indisponibilidade e nunca ausência de risco. Não alterar ou cancelar avisos oficiais com médias ponderadas.

## Segurança e teste

- Somente rotas públicas de liveness/readiness, usando HTTPS sem redirecionamento e sem dados sensíveis.
- Os testes programados não alteram alertas, assinaturas, fontes, código ou implantação.
- Falhas serão visíveis na execução do GitHub Actions; recuperação automática de software e dados dependerá de mecanismos adicionais testados.
- O agendador GitHub não substitui um serviço de monitoramento contínuo; execuções agendadas podem atrasar.
- **Interface:** seção `Mais → Manutenção e qualidade` informa horários e estado **não confirmado**, não simula que os agentes estão executando no aparelho.
- O fluxo manual `Actions → Blaise RJ Maintenance → Run workflow` permite executar os modos hourly, nightly e monthly para verificação.

## Milestone: 500.000 assinantes verificados — escala e cibersegurança

O papel 10 também pesquisa sistemas, fornecedores e custos pagos; entrega comparativo, proposta técnica, URLs oficiais e valores com data, região e hipótese de consumo. A **criadora do aplicativo aprova e realiza pessoalmente** qualquer compra, contratação, aumento de quota ou instalação de ferramenta paga. Nenhuma cobrança automática é permitida pelo agente. Adequação técnica prevalece sobre preço mínimo.

- Revisão antecipada quando **400.000 assinantes ativos verificados**, e revisão prioritária aos **500.000**.
- Fonte obrigatória: contagem de assinatura **ativa e verificada** com horário UTC recente; sem ligação com métricas de billing, relatar NOT_CONFIGURED, nunca alegar crescimento. Variáveis de CI `BLAISE_VERIFIED_ACTIVE_SUBSCRIBERS` e `BLAISE_SUBSCRIBERS_OBSERVED_AT` são **integração provisória**, não coleta real automatizada.
- O workflow `scaling-milestone-review` roda no ciclo noturno e mensal; `scripts/rj-scale-policy.mjs` valida contagem e idade dos dados; `scripts/rj-scale-readiness.mjs` gera relatório sem compra/deploy.
- **Assinantes != acessos concorrentes**: dimensionar com RPS/P95-P99, picos, sessões simultâneas, CPU/RAM, latência externa, quotas, taxa de erros e orçamento.
- Separar ingestão oficial, cálculos críticos/alertas P0, pagamento e tráfego público; fila com limites, cache com TTL comprovado, backpressure, circuit breakers, proteção contra sobrecarga, estratégia de degradação e testes de recuperação. Não guardar tokens, áudios ou localização sem necessidade.
- Preferir primeiro o mesmo provedor do backend Cloud Run (região southamerica-east1) e cotar opções adicionais somente quando tecnicamente justificadas.

### Catálogo inicial de fornecedores oficiais (valores indicativos em USD em 08/10/2026)

| Produto | Uso recomendado | Referência oficial e custo divulgado |
|---|---|---|
| Google Cloud Armor Enterprise Paygo | WAF, DDoS e proteção de borda; exige arquitetura de load balancer compatível | https://cloud.google.com/armor/pricing — USD 0,273972603/h de assinatura base (~USD 200/730h), mais processamento de dados e demais componentes |
| Google Cloud Security Command Center Premium | Detecção/gestão de ameaças e vulnerabilidades na nuvem | https://cloud.google.com/security-command-center/pricing — cobrança pay-as-you-go por recursos ou assinatura anual mínima USD 15.000 |
| Google Cloud Run | Autoescala de backend existente, concorrência e recursos | https://cloud.google.com/run/pricing — custo variável por CPU/RAM, requisições, região e transferência |
| Google Cloud Load Balancing | Roteamento seguro e camada adequada ao Cloud Armor | https://cloud.google.com/load-balancing/pricing — primeiras cinco regras globais USD 0,025/h, mais uso de tráfego |
| Google Cloud Storage / Cloud SQL / Memorystore | Evidência, históricos, backups, banco relacional ou cache conforme necessidade real | https://cloud.google.com/storage/pricing ; https://cloud.google.com/sql/pricing ; https://cloud.google.com/memorystore/docs/redis/pricing — orçamento depende da região, capacidade, disponibilidade e tráfego |
| Grafana Cloud k6 Pro | Testes controlados de carga, latência e picos | https://grafana.com/pricing/ — plataforma a partir de USD 19/mês + uso; testes Pro a partir de USD 0,15 por hora de usuário virtual acima da franquia |
| GitHub Code Security e Secret Protection | Varredura do código, dependências e segredo no repositório, antes de lançar o APK | https://github.com/security/plans — Code Security USD 30 e Secret Protection USD 19 por contribuidor ativo/mês, requisitos do plano aplicáveis |
| Google Cloud Artifact Analysis | Detecção de vulnerabilidades nas imagens do backend, sem antivírus dentro do APK | https://cloud.google.com/artifact-analysis/pricing — varredura automática ou avulsa USD 0,26 por imagem (podem existir regras distintas com Security Command Center) |

Os preços são referências públicas, não propostas comerciais. A solução apropriada requer medição e contratação aprovada. Serviços de segurança **não são antivírus instalado dentro do aplicativo**: combinar análise de código e dependências, verificação de artefatos assinados, defesa do backend e atestação do cliente. App Check/Play Integrity pode proteger rotas, mas deve ser configurado/testado para **Google Play, Samsung e Amazon**, de modo a não bloquear clientes legítimos fora da Play Store (https://firebase.google.com/docs/app-check/android/play-integrity-provider).

**Proteção de disponibilidade:** qualquer WAF, atestado, mudança de regras, cache ou antivírus externo deve começar em observação/ensaio, com testes de falso positivo para acesso a fontes oficiais, cidades, mapas, assinaturas e alertas P0 antes de bloqueio ativo. Alertas oficiais críticos devem continuar visíveis e não podem ser apagados por regras de segurança ou processamento estatístico.

A proposta de aquisição produz recomendação e orçamento à proprietária; não existe autorização implícita de compra. Indicadores insuficientes => relatório de pendências, sem inventar preços específicos ou disponibilidade.


## Revisões sucessivas a cada 500.000 assinantes

Revisar novamente a cada incremento de **500.000 assinantes ativos verificados**: 500 mil, 1 milhão, 1,5 milhão, 2 milhões, 2,5 milhões, 3 milhões e assim por diante, sem teto. A prioridade a partir de 2 milhões é reforçar resiliência, alta disponibilidade, proteção de APIs, segurança de CI/APK, capacidade de pico e retenção mínima de dados. Volume de assinantes não equivale a requisições concorrentes.

O módulo `scripts/rj-scale-policy.mjs` agora exige uma contagem recente com horário de medição E histórico persistido do último marco já relatado; o status `MILESTONE_REPORT_DUE` informa os marcos vencidos. Nunca utilizar contagem estimada, downloads, visitantes ou quantidade de dispositivos como assinantes ativos. A variável `BLAISE_LAST_REPORTED_MILESTONE` precisa ser alimentada por uma trilha auditável de relatórios enviados; **este workflow não modifica automaticamente essa variável, não envia e-mail e não compra serviços**. Os estados `REPORT_HISTORY_NOT_CONFIGURED` e `NOT_CONFIGURED` são bloqueios explícitos.

Conteúdo exigido em cada relatório: marco confirmado, horário, fontes do número, picos observados, custos previstos mensais e anuais na moeda oficial USD ou EUR (conversão só quando identificada e com cotação), região, impostos e hipóteses, links oficiais para contratação, procedimentos de integração com Cloud Run/backend/Android, testes que garantam que segurança não bloqueie fontes e alertas oficiais, comparação baseada em adequação e riscos, e aprovação exclusiva da proprietária antes da compra.

O canal de envio deve ser configurado **fora do repositório público**, por um mecanismo de e-mail autorizado e trilha de mensagens enviadas; não cadastrar o endereço privado da proprietária neste arquivo, em YAML público ou em código. Uma automação de acompanhamento externa foi solicitada, mas entrega de e-mail depende de contagem confiável e permissão operacional no momento do marco.

Referências oficiais para cotações correntes (consultar novamente a cada marco):
- Cloud Armor Enterprise: https://cloud.google.com/armor/pricing
- Security Command Center Premium: https://cloud.google.com/security-command-center/pricing
- Cloud Run e ajuste de concorrência: https://cloud.google.com/run/pricing ; https://cloud.google.com/run/docs/about-concurrency
- Cloud Storage: https://cloud.google.com/storage/pricing
- Grafana/k6: https://grafana.com/pricing/
- GitHub Security: https://github.com/security/plans

Todas as despesas são facultativas até uma proposta baseada em testes de carga e na carga real. Ferramentas de segurança devem ser testadas para evitar falsos positivos e manter as fontes oficiais de alerta e a distribuição das três lojas funcionais.
