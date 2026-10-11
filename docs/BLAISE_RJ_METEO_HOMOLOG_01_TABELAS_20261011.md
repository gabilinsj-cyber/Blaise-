# Blaise V6 RJ — Tabelas 1 e 2 vinculadas: homologação das fontes meteorológicas

**Identificador permanente:** `BLAISE-RJ-METEO-HOMOLOG-01`  
**Versão:** `2026-10-11.v2`  
**Projeto exclusivo:** Blaise V6 RJ (92 municípios fluminenses, suas divisas e Atlântico pertinente).  
**Status deste documento:** políticas e interface cadastradas; serviços *não* homologados por esta documentação.

Este documento une a **Tabela 1 — Cadastro de fontes por fenômeno** à **Tabela 2 — Critérios de desempate e cálculos**. A implementação está em `backend/src/rj-meteorological-homologation.mjs`, o roteamento em `backend/src/rj-phenomenon-source-policy.mjs` e a interface na seção **Mais → Matriz Meteorológica**. Preservar a interface aprovada na PR #97. **INEA excluído de coleta/consulta operacional**.

## Tabela 1 — 28 categorias meteorológicas, fontes e localidade

**Como ler:** a sequência é a *elegibilidade/prioridade de consulta*, não atestado de coleta ativa, disponibilidade de uma API, licença ou presença de sensores no município. Para toda fonte, conferir **produto + horário + latitude/longitude ou área municipal + unidade + autorização**. Produtos oficiais de previsão não são medições pontuais.

| Nº | Categoria / fenômeno | Área/variável | Fonte e prioridade de consulta |
|---:|---|---|---|
| 01 | Temperatura do ar | 92 municípios, estações reais | Cidade do Rio: Alerta Rio → Defesa Civil → INMET → INPE/CPTEC → Windy; outros municípios: Defesa Civil → INMET → INPE → Windy |
| 02 | Sensação térmica | 92 municípios | Entradas oficiais de temperatura, umidade, vento; **calculada pelo Blaise** conforme domínio da fórmula; INPE/Windy apenas previsão comparativa |
| 03 | Umidade relativa | 92 municípios | Defesa Civil/rede autorizada → INMET; Alerta Rio quando possuir o produto para a cidade do Rio; INPE → Windy comparação |
| 04 | Vento médio | 92 municípios | Alerta Rio (Rio) → Defesa Civil → INMET → INPE → Windy |
| 05 | Rajadas | 92 municípios | Alerta Rio (Rio) → Defesa Civil → INMET → INPE → Windy, com janela temporal da rajada |
| 06 | Chuva acumulada | 5/10/15/30 min, 1 h, 24 h conforme instrumento | Alerta Rio (Rio) → Defesa Civil → INMET → INPE → Windy; **CEMADEN** como fonte especializada com cobertura local |
| 07 | Temporal | 92 municípios, área de aviso | Alerta Rio (Rio) → Defesa Civil → INMET → INPE → Windy, CEMADEN conforme produto; **categoria não admite média numérica** |
| 08 | Tempestade severa | 92 municípios, área de aviso | Alerta Rio (Rio) → Defesa Civil → INMET → INPE → Windy; CEMADEN conforme cobertura e produto |
| 09 | Risco hidrológico/cheia | Bacias/municípios RJ | Defesa Civil → CEMADEN → SGB/SACE → ANA |
| 10 | Vazão dos rios | Estações hidrológicas | ANA/HidroWeb → SGB/SACE; não transformar vazão isolada em aviso de enchente |
| 11 | Ressaca e ondas altas | Litoral do RJ | Marinha/CHM → INMET → NOAA → INPE → Windy; distinguir boletim/aviso de onda efetivamente observada |
| 12 | Ondas, marés, temperatura marítima | Litoral e Atlântico | Marinha/CHM → NOAA → INPE → Windy; verificar produto especializado para cada variável |
| 13 | Ciclone extratropical | Atlântico Sul, ameaça ao RJ | Marinha/CHM → INMET → Defesa Civil (quando afeta terra) → NOAA → INPE → Windy |
| 14 | Chuva no oceano Atlântico | Áreas georreferenciadas | Marinha/CHM → NOAA → INPE → Windy; grade/satélite autorizado para interpolação |
| 15 | Massas de ar frio/polar ou quente | RJ e divisas | INMET → Marinha → NOAA → INPE → Windy; trajetória e frente devem indicar incerteza |
| 16 | Radar meteorológico | Área de alcance real | Alerta Rio somente município do Rio, CEMADEN e Defesa Civil conforme produto; mapa **desenhado pelo Blaise**, sem copiar imagem de terceiros |
| 17 | Granizo | Municípios cobertos | Defesa Civil → INMET → CEMADEN → INPE → Windy; confirmação/aviso de granizo por órgão competente |
| 18 | Deslizamento | Áreas geológicas RJ | Defesa Civil → CEMADEN → SGB/SACE → ANA, e Geo-Rio conforme municipalidade |
| 19 | Alagamento urbano | Vias e municípios RJ | Defesa Civil → CEMADEN → ANA → SGB/SACE; COR.Rio/CET-Rio quando aplicável |
| 20 | Frentes frias | RJ, divisas, litoral | INMET → Defesa Civil → Marinha → NOAA → INPE → Windy |
| 21 | El Niño/La Niña | Contexto climático | INMET → NOAA → INPE → Windy; anomalia não equivale a alerta imediato |
| 22 | Sismos e terremotos | RJ/Atlântico e seção global | USGS → Defesa Civil → Marinha/CHM → NOAA; exigem magnitude, epicentro, profundidade, horário |
| 23 | Tsunami / maremoto / meteotsunami | Costa do RJ e Atlântico | **Marinha + NOAA + autoridades brasileiras**; USGS para mecanismo sísmico; nenhum cálculo isolado cria aviso |
| 24 | Pressão atmosférica | 92 municípios, estações adequadas | INMET → INPE → Windy; Alerta Rio somente se houver pressão local comprovada |
| 25 | Raios e descargas elétricas | Cobertura por rede/satélite | NOAA GOES/GLM + rede terrestre licenciada → Defesa Civil; observação satelital é diferente de contagem de solo |
| 26 | Excesso de calor e risco à saúde | RJ conforme painel e produto da SES-RJ | **Monitora RJ (SES-RJ)** para indicadores de saúde; INMET para medições originais; Alerta Rio apenas no município do Rio quando houver produto aplicável. Dados INMET republicados no painel **não são segunda medição independente** |
| 27 | Qualidade do ar e poluentes | MonitorAr-Rio apenas município do Rio; outras cidades conforme redes próprias confirmadas | **MonitorAr-Rio (SMAC)**: IQAr, PM2,5, PM10, O3 e outros poluentes por estação, com classificação/horário/validação do sensor. Não atribuir a mesma rede a 92 municípios |
| 28 | Índice ultravioleta (UV) | RJ conforme cobertura do produto | INPE/CPTEC → INMET → NOAA, somente quando existir produto oficial adequado, com unidade ou índice, local e validade confirmados. Não inferir UV a partir de temperatura |

**Exceções:** Alerta Rio restringe-se ao município do Rio de Janeiro (IBGE 3304557). Outras localidades só entram com cobertura comprovada e base de dados da autoridade competente. Uma estação na divisa de outro estado não vira estação do RJ. Marinha, NOAA, ANA, SGB, CEMADEN, USGS e redes de raios mantêm **prioridade especializada** mesmo que não pertençam à sequência meteorológica geral. Há 92 municípios selecionáveis, não 92 sensores garantidos.

### Fontes acrescentadas e agregadora complementar

**Monitora RJ (SES-RJ)** e **MonitorAr-Rio (SMAC)** foram incluídos na Tabela 1 e no catálogo/roteamento do Blaise. São produtos distintos: Monitora RJ é um **painel de informação em saúde** que não pode ser tratado como estação meteorológica adicional só por republicar temperatura ou risco; MonitorAr-Rio possui **estações municipais de qualidade do ar** restritas ao município do Rio. Quando um indicador depende da medição INMET já utilizada, o algoritmo deve **deduplicar a origem primária**, não somar confirmação artificial.

**Plataforma Clima (Prefeitura do Rio)** foi cadastrada como agregadora complementar condicionada para RADAR e análise meteorológica própria: antes de usar algum produto é obrigatório identificar dados de origem, direito de uso, resolução e horários. Como o projeto Blaise V6 RJ excluiu o **INEA**, nenhum produto derivado desse órgão deve entrar automaticamente via Plataforma Clima. O catálogo não ativa cópia de imagens ou ingestão de API.

Referências oficiais para revisão de produto: [MonitorAr-Rio / SMAC — dados](https://ambienteclima.prefeitura.rio/monitorar-2026-dados/), [Rede MonitorAr-Rio](https://ambienteclima.prefeitura.rio/monitorar-2026-rede/), [Monitora RJ/SES-RJ](https://monitorar.saude.rj.gov.br/) e [Plataforma Clima — sobre](https://plataforma-clima.dados.rio/sobre). Nenhuma dessas referências isoladamente comprova uma integração viva ou as permissões de redistribuição dos produtos selecionados.

## Tabela 2 — Desempate, média ponderada e identificação de fontes

| Ordem | Etapa | Decisão fundamentada |
|---:|---|---|
| 1 | Fontes oficiais primárias | Rio: **Alerta Rio → Defesa Civil → INMET**. Demais municípios: Defesa Civil → INMET (conforme cobertura); selecionar por fenômeno e competência |
| 2 | Duas medições compatíveis | Duas observações **independentes**, recentes, próximas, mesma unidade e janela. Usar cálculo ponderado com pesos justificados e origem rastreável |
| 3 | Se divergem | Verificar estações, localização, calibração, datas, tempos, rain window e valor físico. Consultar a **terceira fonte oficial** antes dos modelos |
| 4 | Primeiro desempate | **INPE/CPTEC**, produto de previsão com validade, modelo, coordenada, habilidade e uso permitido. Pode apoiar destaque da medição mais próxima, não confirmar sensor |
| 5 | Segundo desempate | **Windy somente se INPE inconclusivo**, com licença compatível com o app e fonte do modelo independente identificada |
| 6 | Mostrar duas fontes | Duas leituras oficiais ou **1 medição oficial + 1 previsão** rotuladas separadamente; preservar todos os valores oficiais divergentes, sem média entre medição e previsão |
| 7 | Falta de medições | Buscar outras fontes autorizadas e último cache com horário, quando ainda válido. Se nenhuma entrada verificável, não inventar valor nem falso “sem alerta” |
| 8 | Eventos especializados | Não fazer média de categorias de alertas, magnitudes sísmicas, classificações de tsunami/ressaca. Priorizar autoridades, dados de saúde e qualidade do ar adequados; Monitora RJ pode republicar INMET, e Plataforma Clima pode agregar dados de origem proibida (INEA). Não contar republicações como validação independente |

Para medições numéricas compatíveis, **média ponderada:** `sum(weight_i * value_i) / sum(weight_i)`. Exigir pesos metodologicamente sustentados; usar a calculadora científica `rj-scientific-calculator.mjs`, que também contém ponto de orvalho e índices térmicos. Para previsões de modelos, cálculo *separado*, usando habilidade retrospectiva documentada. **Nunca transformar previsão em leitura observada ou média em alerta oficial.**

## Homologação operacional — fontes e serviços reais

Esta é a **situação demonstrável pelo repositório**, não uma afirmação de que os serviços estão coletando hoje.

| Serviço ou canal | Código existente no Blaise | O que falta para homologar |
|---|---|---|
| Alerta Rio | `alerta-rio-source.mjs`; coleta de chuva pontual no worker | Evidência de acesso produtivo e estável ao produto, regras de redistribuição/comercialização, atributos de estação, 24h de logs |
| Defesa Civil regional | Boletins/CEMADEN e assets municipais Rio | API/boletim por município e tipo de medição, competência, licença; sirenes/avisos não são estação meteorológica |
| INMET | Leitor de avisos CAP e cliente Android de estações | Coleta atual nas estações, regras por produto, comparação com rede externa, tratamento de 204 e lacunas |
| INPE/CPTEC | Roteamento/cálculo de desempate **sem adapter produtivo** | Escolher produto adequado, verificar consulta, código localidade CPTEC diferente do IBGE, resolução e **autorização comercial conforme o produto** |
| Windy | Roteamento comparativo **sem adapter produtivo** | Antes de API/compra: autorização contratual **explícita** para o uso pretendido e limites de redistribuição/derivação; registrar modelo subjacente e quota |
| CEMADEN | Worker de risco hidrológico, contratos PED | Produto, estações, retorno real, licença de exibição e observabilidade contínua |
| Marinha/CHM | Worker para avisos, clientes de maré | Validar vigência/cobertura METAREA, direitos de exibição e projeção própria no litoral |
| ANA / SGB/SACE | Regra hidrológica; conector de vazão não comprovado em produção | Homologar estação, API, tempo, unidade, autorização, retentativas |
| NOAA / rede raios | Critério especializado, ainda não integrado | Produto específico, autorização, lat/lon, resolução temporal e QA |
| USGS | Critério sísmico; ingestão operacional ainda não comprovada | Feed de eventos, georreferenciamento, hora, deduplicação e regras de alerta |
| Radar espacial próprio | `rj-radar-spatial-layer.mjs`, Canvas Android | Produto de grade/frames real, licença, decodificador, calibração, 30 min de frames e comparação com pluviômetros |
| Monitora RJ / SES-RJ | Catálogo Tabela 1 categoria 26 (sem API produtiva) | Confirmar produto de excesso de calor/saúde, perímetro real, licença e origem primária; não duplicar INMET |
| MonitorAr-Rio / SMAC | Catálogo Tabela 1 categoria 27 (sem API produtiva) | Selecionar dados por estação do município do Rio e indicar método de validação, unidade, uso autorizado e horário |
| Plataforma Clima / Rio | Fonte agregadora candidata para radar (sem API produtiva) | Validar produtos, licença, origem e excluir dados INEA; não copiar mapas de terceiros |

| Backend Cloud Run e Android | Worker/endpoint de prontidão e cliente Android | Revisão de Cloud Run/IAM/env, observação 24h, autorização de publicação, teste físico; CI não comprova produção |

### Portas de controle e evidências obrigatórias

1. Backend Cloud Run `blaise-v6-rj-backend`, projeto `blaise-v6-rj`, região `southamerica-east1`: **verificar revisão, URL e conta efetivas**. Não inventar URL nem afirmar deploy.
2. Endpoints existentes: `/healthz`, `/readyz`, `/v1/internal/rj-sources/readiness` (acesso operador OIDC, exige token; dados privados redigidos). **Não consultar endpoint protegido anonimamente**. O relatório operacional informa última coleta, frescor, tarefa, status e erros. Não comprova uptime contínuo sem métrica externa.
3. Flags: `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED`, `BLAISE_CEMADEN_RJ_ENABLED`, `BLAISE_INMET_WARNINGS_ENABLED`, `BLAISE_CHM_WARNINGS_ENABLED`, `BLAISE_DEFESA_CIVIL_RIO_ASSETS_ENABLED`. Ativar somente conforme produtos legalmente autorizados. `BLAISE_INMET_P0_PUBLISH_ENABLED` permanece desabilitada até homologar alertas críticos.
4. `/v1/public/rj-status` precisa das **duas flags** `BLAISE_RJ_PUBLIC_STATUS_ENABLED` e `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED`, ambas inicialmente desligadas. Alertas públicos P0 não dependem de assinaturas, mas precisam da fonte vigente.
5. **Teste de 24 horas**: por tarefa, registros de acesso/sucesso, atrasos, resposta malformada, 429, timeout, geolocalização, reprocessamentos, cobertura e perda de rede. Frequência nominal até 1–5 min; para nível 4/5, 30 s coleta/recálculo *somente* se a fonte/limite oferecer atualização real. Não afirmar novos dados por apenas repetir requisições.
6. Guardar no registro de homologação as provas **assinadas pelo operador**: produto, URL/endpoint, versão, contrato/termos de uso, hora do último dado, município/área, resposta atual, logs, aprovação técnica e de segurança. `checkRjSourceProductEvidence` confere a *estrutura* das provas, mas **nunca se autodeclara licenciado ou em produção**.
7. Testes físicos de voz feminina, assinatura Google Play, radar espacial, e demais feeds oceânicos/sísmicos são etapas de homologação próprias; não reconstruir layout nem instalar APK grande como requisito inicial.
8. Somente mudar o status de uma fonte para **homologada** após validação independente e verificação de produção, não após CI ou simples requisição HTTP.

### Fontes documentais primárias verificadas em 11/10/2026

- [COR.Rio FAQ — estações Alerta Rio, tipo e periodicidade](https://cor.rio/faq/): **33 estações** no serviço descrito; apenas algumas oferecem vento/pressão/temperatura. Não assumir que toda estação mede tudo.
- [CPTEC/INPE — XML para localidade, IUV e ondas](https://servicos.cptec.inpe.br/XML/): apresenta formato de consultas e diferentes IDs de cidade; exigir confirmação de TLS e condições do produto escolhido.
- [INPE — dados e produtos satélite/radar](https://www.gov.br/pt-br/servicos/acessar-gratuitamente-dados-e-produtos-derivados-de-satelites-radares-e-instrumentos-meteorologicos-correlatos): acesso público descrito, inclusive produtos quantitativos; isso não comprova redistribuição comercial de todo produto.
- [CPTEC/INPE — página principal e avisos de direitos](https://www.cptec.inpe.br/): certos usos comerciais/reprodução de produtos não são permitidos sem autorização expressa.
- [Windy Map & Point Forecast API — termos](https://account.windy.com/agreements/windy-forecast-api-terms-of-use): **API Trial não autorizada em produção**, uso profissional sujeito a contrato; termos padrão restringem redistribuição/extração, obras derivadas e acesso no módulo exclusivamente pago.
- [CEMADEN PED — especificação de API](https://sws.cemaden.gov.br/PED/api/ui/): contratos e produtos de dados ambientais/estações; disponibilidade da interface não comprova que um produto individual esteja ativo em produção.
- [ANA — manuais das APIs HidroWebservice](https://www.gov.br/ana/pt-br/assuntos/monitoramento-e-eventos-criticos/monitoramento-hidrologico/orientacoes-manuais/manuais-de-sistemas-e-servicos-de-disponibilizacao-de-dados-hidrologicos).
- [Marinha CHM — boletins/avisos meteorológicos](https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo): **aviso de ressaca é previsão, não sensor que atesta ocorrência**; não publicar “sem risco” quando sem aviso válido.
- [Marinha CHM — dúvidas frequentes sobre ressaca e dados](https://www.marinha.mil.br/chm/bndo/duvidas-frequentes).

**Encerramento desta etapa:** catálogo persistido e mostrado no Android, código/testes submetidos à revisão. **A homologação operacional real permanece pendente até licenças, prova de ingestão, Cloud Run e 24h de observação.**
