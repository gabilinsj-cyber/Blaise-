# BLAISE V6 RJ — MEMÓRIA DE CONTINUIDADE, AGENTES E CÁLCULO CIENTÍFICO
**Consolidação:** 13/11/2026 | **Escopo:** exclusivamente Rio de Janeiro (92 municípios e Atlântico adjacente)

> Este documento é fonte de requisitos aprovados e diagnóstico dos arquivos recuperados.
> **Não é afirmação de publicação, de instalação ou de coleta operacional.**
> Qualquer arquivo de produção deve ser verificado e testado antes de ativar.

## 1. Integridade dos projetos e preservação
- Repositório original: `gabilinsj-cyber/Blaise-`; diretório de trabalho Cloud Shell: `~/Blaise-RJ`.
- Branch-base identificada: `test/rj-inea-validation-20261111`; nova integração aditiva: `feature/rj-science-agents-ui-20261113`.
- O repositório local contém alterações/backups potencialmente ausentes no GitHub. PROIBIDO reset, clean, checkout, pull, force-push ou merge automático no diretório local.
- Projetos de outros estados e Blaise & Ben Alemanha são independentes.
- Produção `blaise-v6-rj-backend` no Google Cloud Run, `southamerica-east1`; homolog não deve receber tráfego real sem aprovação.
- Não trocar credenciais, billing, permissões, assinatura, domínio, DNS ou tráfego para adicionar conteúdo ao aplicativo.

## 2. Identidade e UI Android original
- Tema azul-marinho e detalhes luminosos; referência visual oficial de setembro, sem dados meteorológicos ilustrativos falsos.
- Cabeçalho `BLAISE V6 RJ`, botão `LIGADO` verde por padrão, personagem aprovado, texto `Como posso ajudar?`, reconhecimento de voz com envio após término da fala, voz e texto; pronúncia `bleiss`.
- Duas cidades independentes selecionadas alfabeticamente a partir de 92 municípios com código IBGE; Centro do Rio sob demanda.
- Radar Sumaré/Alerta Rio/COR.Rio: quadros com timestamp real de ~2 min quando disponíveis, janela histórica 30 min; nunca interpolar frames ausentes.
- Mapa meteorológico próprio do RJ e Atlântico com chuva, temperatura, vento e nuvens; expandir mapa; localização e horários em cada camada.
- Gráficos: últimos três dias + dia atual + próximos cinco, quando houver observações/previsões confiáveis; não misturar natureza dos dados.
- Painéis: Cidades, Radar, Alertas, Mar e Ondas, Qualidade do Ar, Trânsito, Notícias, Sismos, Histórico 12 h e Mais.
- Trânsito com CET-Rio/COR.Rio/Geo-Rio/Defesa Civil: alagamentos, interdições, sirenes, escorregamentos, pontos de apoio, rotas.
- Notícias do RJ + uma internacional; dois maiores sismos recentes, sem deduzir tsunami de magnitude isolada.
- Cliente vê resumo, fonte efetivamente usada, horário e validade; detalhes numéricos e relatórios científicos são administrativos.

## 3. Fontes: allowlist e bloqueio definitivo
- Fontes aprovadas por produto: Alerta Rio/COR.Rio, Defesa Civil RJ municipal/estadual, CET-Rio, Geo-Rio, INMET, INPE/CPTEC, CEMADEN, NOAA, EUMETSAT, JAXA GSMaP, USGS (sismos). ANA/Hidroweb/SGB/SACE somente nos produtos que tenham atribuição e direito de uso comprovados.
- **Excluídas:** INEA, Marinha do Brasil/CHM, Windy, Copernicus. Nenhuma pode reaparecer em telas, cálculos, leituras operacionais, catálogo de fonte ativa, cache ofertado a clientes ou fallback.
- Código legado pode existir temporariamente em arquivos não executados; é pendência técnica de remoção, não autorização de utilização. Revisar imports, flags, snapshots, fixtures, testes e dashboards antes de produção. Não reutilizar registros históricos excluídos.
- Prioridade municipal: Alerta Rio e Defesa Civil; INMET para desempate. Ordem secundária por produto: INMET → INPE/CPTEC → NOAA → CEMADEN → JAXA → EUMETSAT.
- Marítimo por fenômeno: INPE/CPTEC, NOAA, EUMETSAT, JAXA, Defesa Civil, INMET e CEMADEN; previsão não é observação; ondas não são tsunami, risco de ressaca oficial ou maré medida.
- Para cada dado: produto, território, URL segura, licença, natureza observação/modelo, hora de emissão, instante válido, controle de qualidade e prazo de atualização.
- Falha da fonte ≠ retirada do aviso; falta de dado ≠ tempo seguro.

## 4. Alertas, frequências e P0
- Atualização normal 5 minutos, severa 1 minuto, extrema 25–30 segundos quando viável, com limites reais de fonte e Android. Não prometer frequência que coletor não suporta.
- Após 3 horas, indicar expirado em revisão; após 4 horas, rebaixamento **local de apresentação** 5→3 e 4→2 sem alterar severidade oficial; após 12 h, retirar painel ativo; histórico até 12 h adicionais, conforme política. Se órgão retira, retirar imediatamente.
- Faixa de alertas por cidade priorizada, até três inline; avisos excedentes abrem página completa. P0 prioritário independe de assinatura.
- Nunca cancelar aviso por timeout, 404 isolado, coletor falho ou cache expirado.
- Sismo/tsunami: USGS e rede oficial para sismo; órgãos brasileiros e NOAA para tsunami, sem alarmes inferidos de fórmula.

## 5. Dez agentes internos (contrato; confirmar implantação individual)
1. Integridade e autocorreção contínua: diagnóstico e patch reversível somente após gate.
2. Checagem horária de fontes: disponibilidade, idade, território e licenças.
3. Rotina noturna às 01h (Brasília): consolidação técnica diária.
4. Auditoria e limpeza 24 h: retenção mínima e integridade dos backups.
5. Núcleo de cálculos severos 30 s/1 min: modelos e observações validados; sem emitir avisos oficiais.
6. Trânsito: eventos municipais verificáveis, normal 5 minutos.
7. Marítimo: 30 fenômenos costeiros no backlog, cada fonte conforme produto; alvo de frescor <=30 minutos.
8. Voz e perguntas: cerca de 800 perguntas históricas previstas; não contar intenções como cobertas sem teste.
9. Fiscalização: domínios, alterações de API, licença, saneamento de fontes proibidas e segurança.
10. Segurança e escala de assinantes: autenticação, P0, limitação de carga, observabilidade, canary e rollback.

**Código novo:** `backend/src/blaise-rj-agent-registry.mjs` contém a definição dos dez agentes e um despachante que só executa ações explicitamente habilitadas. O cadastro dos agentes NÃO significa que dez serviços operacionais foram inicializados.

## 6. Calculadora científica avançada
**Já presente no backend original:** temperatura potencial equivalente (aproximação), derivada Clausius–Clapeyron, PWAT por pressão, FAO-56 Penman–Monteith diário, balanço hídrico de solo, tensão de vento oceânica, potencial térmico ciclônico, perfil neutro de vento, radar KDP calibrado, MOS calibrado, Kalman escalar, rajadas calibradas, cisalhamento vetorial, helicidade relativa à tempestade, divergência/vorticidade/deformação, tendência de pressão, espectro de ondas, dispersão e tempo condicional de propagação marítima.
**Novos núcleos na branch:** LCL aproximado (Bolton), taxa de variação térmica ambiental, espessura hipsométrica, CAPE/CIN como integral assinada de perfil de temperatura virtual de parcela e ambiente fornecidos; não executar sem perfil vertical completo e validado.
**Novos diagnósticos na interface Cidades:** ponto de orvalho (Magnus), bulbo úmido aproximado (Stull), índice de calor (Rothfusz) e de frio (wind chill) com restrições numéricas; se faltarem temperatura/UR/vento de mesma estação recente, mostrar indisponível.
**Backlog científico prioritário:** advecção de temperatura/umidade, gradiente e força de pressão, geopotencial, cálculo de LFC/EL, lifted index, lapse rates por camada, CAPE/CIN com solver completo de parcela, extrapolação de células radar validada por skill, precipitação radar calibrada, PWAT de coluna integral, shear 0–1/0–6 km, SRH e helicidade por camadas, umidade integrada e MSLP com referência de estação. Sem perfil adequado, coeficientes/grade e qualidade comprovados, não usar estimativa aproximada como diagnóstico conclusivo.
**Saída científica:** `CALCULO_BLAISE`, `officialAlert:false`, método e versão; lado público só valor, unidade, escopo, hora e natureza. Relatórios completos restritos ao administrador por autenticação; TTL de 24 h.

## 7. Dados, privacidade, preço e escala
- Preço planejado mensal R$ 3,93; anual R$ 35,00; verificar itens da Play Console antes da comercialização.
- Não armazenar perguntas, voz, localização exata ou histórico de uso além do mínimo indispensável; proteção TLS, permissão Android e controle por função.
- Base alvo ~3 milhões, pico ~9 milhões: alertas/temperatura/chuva/vento antes de gráficos/mapas/notícias/áudio, cache seguro e degradação controlada.
- Relatórios científicos particulares com retenção máxima de 24 h; observabilidade por sinais agregados e sem tokens pessoais.

## 8. Registros de engenharia e pendências comprováveis
- NOAA Docker/ecCodes validados em teste local em 31/10, NOAA wave forecast `SUCCESS` observado em produção em 03/11, mas sem comprovação de horário de emissão atual na interface.
- INMET CAP `SUCCESS` parcial em 03/11; outras integrações ainda exigem verificação ponta a ponta e território.
- Worker `official-source-worker.mjs`, cache NOAA e contratos `/v1/data/dashboard` e `/v1/data/municipalities` existentes; um contrato não substitui outro.
- Android Compose `MainActivity.kt` possui layout e acesso autenticado. Inserção nova em `CitiesScreen` é aditiva, sem substituir telas existentes.
- Em `official-source-worker.mjs`, a habilitação CHM está forçada a `false` na branch consultada, mas restos de código legado precisam de retirada segura, com suíte de regressões. **Nenhum coletor excluído deve voltar a ser habilitado.**
- O protótipo web `blaise-v6-rj-preview.html` e o ZIP de 13/11 são referências de interface e política, não app Android de produção.
- Não prometer APK, release, agents 24h, sensor live ou atualização de produção antes de logs, testes, validação da fonte e controle de implantação.
- Play Console possui histórico de dificuldades de identidade e publicação; acompanhar também Galaxy Store e Amazon Appstore, sem publicar automaticamente.

## 9. Critérios de integração e gates
1. Preservar `~/Blaise-RJ`, verificar `git status --short`, branch, backup e diff da base LOCAL antes de aplicar qualquer patch.
2. Garantir lista de fontes no Compose sem excluídas, worker sem execução de coletores excluídos, contratos autenticados, escopo IBGE validado.
3. Rodar testes unitários backend/Android e compilação, incluindo negativos para ausência de dado, timestamp futuro, limite de idade, qualidade, licença, fontes proibidas, P0 e cálculos científicos.
4. Validar separadamente dados atuais de Alerta Rio, INMET, CEMADEN, NOAA etc. URL/HTTP 200 ou `SUCCESS` isolado não prova medição atual no app.
5. Homologação, canary, observação/rollback. Somente então considerar integração em produção e geração de APK.
