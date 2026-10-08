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
