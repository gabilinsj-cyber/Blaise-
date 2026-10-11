# Blaise V6 RJ — matriz P1 completa de 25 fenômenos (11/10/2026)

**Referência consolidada para o projeto exclusivamente Rio de Janeiro.** Abrange todos os **92 municípios**, suas divisas, o litoral fluminense e fenômenos no Atlântico com potencial de impacto RJ. O mapa cartográfico e o desenho das camadas são próprios do Blaise, não imagens extraídas de terceiros.

**INEA: EXCLUÍDO.** A lista de 25 fenômenos abaixo é a matriz **aprovada e completa**. O roteador existente `backend/src/rj-phenomenon-source-policy.mjs` tem **23 categorias técnicas com agrupamentos diferentes**, portanto *não* equivale a uma integração já comprovada dos 25 fenômenos. O catálogo deste documento também está codificado em `backend/src/rj-canonical-25-matrix.mjs` com testes.

## Tabela P1 — 25 fenômenos aprovados

| Nº | Fenômeno | Fontes oficiais e competência | Consulta complementar | Ciência e verificações Blaise | Rota técnica existente/pendência |
|---:|---|---|---|---|---|
| 1 | **Temperatura** | Alerta Rio (capital), Defesa Civil RJ, INMET | INPE/CPTEC; Windy | Medição pontual + média ponderada somente quando compatível | TEMPERATURA |
| 2 | **Sensação térmica** | Alerta Rio (capital), Defesa Civil RJ, INMET | INPE/CPTEC; Windy | Índice de calor ou vento-frio conforme domínio da fórmula | SENSACAO_TERMICA |
| 3 | **Chuva atual** | Alerta Rio (capital), Defesa Civil RJ, INMET; CEMADEN onde houver | INPE/CPTEC; Windy | Taxa/intensidade de chuva com intervalo e pluviômetro identificado | Ainda sem rota dedicada |
| 4 | **Chuva acumulada** | Alerta Rio (capital), Defesa Civil RJ, INMET; CEMADEN onde houver | INPE/CPTEC; Windy | mm nas janelas 5/10/15/30 min, 1h, 24h e outras autorizadas | CHUVA_ACUMULADA |
| 5 | **Chuva intensa e temporal** | Alerta Rio (capital), Defesa Civil RJ, INMET; CEMADEN | INPE/CPTEC; Windy | Radar/instabilidade/deslocamento; avisos oficiais não são médias | TEMPORAL |
| 6 | **Vento sustentado** | Alerta Rio (capital), Defesa Civil RJ, INMET | INPE/CPTEC; Windy | Direção, velocidade e advecção com unidade e altura de referência | VENTO |
| 7 | **Rajadas fortes** | Alerta Rio (capital), Defesa Civil RJ, INMET | INPE/CPTEC; Windy | Picos de rajada e janela, sem misturar vento médio | RAJADA |
| 8 | **Pressão atmosférica** | INMET e estações oficiais locais | INPE/CPTEC; Windy | Tendência, gradiente e redução ao nível do mar condicionada a perfil | Ainda sem rota dedicada |
| 9 | **Umidade relativa** | INMET, Alerta Rio na capital e redes oficiais locais | INPE/CPTEC; Windy | Ponto de orvalho, bulbo úmido, razão de mistura | UMIDADE |
| 10 | **Granizo** | Defesa Civil, INMET, CEMADEN, Alerta Rio na capital | INPE/CPTEC; Windy | Avisos/ocorrências confirmadas; potencial convectivo não prova queda de granizo | GRANIZO |
| 11 | **Raios e descargas elétricas** | NOAA GOES/GLM e redes terrestres autorizadas | INPE/CPTEC e Defesa Civil conforme produto | Localização/frequência e evolução; preservar diferenças satélite/rede terrestre | Ainda sem rota dedicada |
| 12 | **Ciclone extratropical** | Marinha/CHM, INMET e NOAA | INPE/CPTEC; Windy | Trajetória, pressão, rajadas e possível aproximação do RJ | CICLONE_EXTRATROPICAL |
| 13 | **Ressaca** | Marinha/CHM e avisos costeiros oficiais | NOAA; INMET costeiro; INPE/CPTEC; Windy | Altura, período/direção e vigência do aviso | RESSACA |
| 14 | **Altura das ondas** | Marinha/CHM, NOAA e boias oficiais | INPE/CPTEC; Windy | Altura, período, direção e propagação | ONDAS |
| 15 | **Marés** | Marinha/CHM (tábua/estações maregráficas) | Autoridades/estações costeiras competentes | Preamar, baixa-mar, hora e altura local | Ainda sem rota dedicada |
| 16 | **Temperatura do mar** | NOAA, Marinha e boias oficiais | INPE/CPTEC, modelos oceânicos autorizados | Temperatura superficial/anomalia, produto e resolução | Ainda sem rota dedicada |
| 17 | **Nível dos rios** | ANA, SGB/SACE e redes hidrológicas oficiais | CEMADEN/Defesa Civil para contexto de risco | Cota e tendência por estação, sem equivaler a vazão | Ainda sem rota dedicada |
| 18 | **Vazão dos rios** | ANA/HidroWeb e redes oficiais de vazão | SGB/SACE quando houver medição adequada | Vazão em m³/s com estação e validade | VAZAO_RIO |
| 19 | **Enchente e inundação** | Defesa Civil, CEMADEN, SGB/SACE e ANA | Alerta Rio na capital conforme produto | Aviso/risco, tendência de nível e chuva; não diluir aviso por média | RISCO_HIDROLOGICO |
| 20 | **Deslizamento** | Defesa Civil, CEMADEN, Geo-Rio e SGB | ANA/chuva acumulada como dado auxiliar | Avisos geológicos; chuva e solo não confirmam ocorrência isoladamente | DESLIZAMENTO |
| 21 | **Sismos** | USGS e redes sismológicas oficiais | Defesa Civil, NOAA e Marinha se houver risco costeiro | Magnitude/profundidade/local; avaliar impacto com confirmação | SISMO |
| 22 | **Tsunami e maremoto** | NOAA, Marinha e autoridades brasileiras | USGS na investigação sísmica; Defesa Civil | Tsunami meteorológico separado do sísmico; só aviso competente autoriza alarme | TSUNAMI |
| 23 | **Seca e estiagem** | CEMADEN, INMET e ANA | SGB/SACE e boletins hidrometeorológicos | Déficit pluviométrico, balanço hídrico e níveis hidrológicos | Ainda sem rota dedicada |
| 24 | **El Niño / La Niña** | NOAA, INPE/CPTEC e INMET | Modelos climáticos licenciados incluindo Windy quando adequado | Anomalias oceânicas/atmosféricas; impactos locais como hipótese | EL_NINO_LA_NINA |
| 25 | **Previsão de 1 a 7 dias** | INMET e INPE/CPTEC | NOAA nos produtos adequados; Windy para comparação | Prazo, rodada do modelo, grade, incerteza e data de validade | Ainda sem rota dedicada |

### Módulos transversais que NÃO substituem os 25 fenômenos

As funcionalidades complementares incluem: **radar georreferenciado e pluviômetros**, satélite/nuvens, **UV e qualidade do ar** (sem INEA), trânsito/interdições (CET-Rio e COR.Rio), **frentes frias, massa de ar polar/quente**, granizo, vento e chuva no Atlântico, **tsunami meteorológico** (avaliado separadamente de tsunami sísmico), avisos oficiais e sismologia. Cada camada requer respectivo dado verificável. A existência do menu não significa que um feed esteja ativo.

## Cinco fontes situacionais — temperatura, sensação térmica, vento, chuva e temporal

| Ordem | Fonte | Cobertura e papel | Desempate/resultado |
|---:|---|---|---|
| 1 | Alerta Rio | Somente **município do Rio** e sua rede/produto efetivamente coberto | Primeira medição/aviso elegível |
| 2 | Defesa Civil municipal/regional do RJ | Município/risco conforme competência e dado existente | Segunda medição/aviso quando comparável |
| 3 | INMET | Observações nas estações e avisos oficiais por área | Terceira consulta quando divergência ou fonte anterior ausente |
| 4 | INPE/CPTEC | Produtos oficiais de **previsão, modelo e satélite**, não observação de estação INMET | Primeiro apoio de comparação: medição oficial + previsão identificada |
| 5 | Windy | Visualização/consulta de **modelos** identificados, nunca observação oficial | Somente se INPE for insuficiente; não sobrepõe aviso oficial |

**Duas medições oficiais contemporâneas, independentes e compatíveis bastam** para a média ponderada do Blaise, se os pesos forem justificados. Se as primeiras discordarem, procurar a próxima fonte de observação sem esconder leituras discrepantes. Se não houver dupla compatível, utilizar **INPE e, depois e só se necessário, Windy** para verificar qual leitura se aproxima da previsão. Exibir **uma medição oficial pontual + uma previsão de modelo**, ambas com horário, origem e tipo *distintos*, preservando as outras medições oficiais no detalhe. O modelo *não prova* que uma estação está correta; se a comparação for inconclusiva, mostrar os valores sem escolher um vencedor. **Jamais fazer média entre observação e previsão**, nem entre níveis/categorias de alerta.

Para os outros **91 municípios**, *não atribuir Alerta Rio como fonte local*. Partir da Defesa Civil e INMET quando houver dados de cobertura real; outras fontes especializadas entram por fenômeno. Uma estação externa ao RJ só pode ser contexto geográfico explicitamente rotulado, não uma medição da cidade do RJ.

## Autoridades e desempates especializados

| Fenômeno | Prioridade por competência | Complemento correto / veto |
|---|---|---|
| Rios, vazão, cheia | ANA + SGB/SACE + CEMADEN + Defesa Civil conforme produto | Nível não equivale a vazão; aviso de inundação não pode ser anulado por média |
| Marés, ondas, ressaca, ciclones costeiros | **Marinha/CHM**; NOAA para seus produtos oficiais pertinentes | INMET costeiro, INPE e Windy apenas contexto de previsão apropriado |
| Raios | NOAA GOES/GLM e rede terrestre autorizada por produto | Satélite e sensores em terra não são medições equivalentes sem normalização |
| Sismos | USGS e redes oficiais | Magnitude/profundidade são triagem, não confirmação de tsunami |
| Tsunami/maremoto | **Marinha + NOAA + autoridades brasileiras competentes** | Não deduzir tsunami de magnitude isolada; tsunami meteorológico precisa de diagnóstico/aviso distinto |
| Frente fria/massa polar/quente | INMET, INPE/CPTEC, Marinha, NOAA | Windy comparativo; diagnóstico atmosférico deve manter tipo de produto |
| Seca e estiagem | CEMADEN, INMET, ANA | Déficit/histórico não é leitura instantânea do mesmo tipo |

## Calculadora científica Blaise — regras aprovadas

- **Temperatura/umidade/pressão:** ponto de orvalho, bulbo úmido, umidade específica/razão de mistura, temperatura virtual, tendência de pressão, índice de calor/vento-frio, pressão reduzida ao mar apenas com dados físicos adequados.
- **Chuva e radar:** acumulados em janelas completas, Z–R/KDP com calibração de radar autorizada; radar real requer campo espacial georreferenciado — pontos de chuva não autorizam desenhar falsos núcleos de tempestade.
- **Tempestade/vento:** movimento/advecção, cisalhamento 0–1 km e 0–6 km, vorticidade, divergência, helicidade, CAPE/CIN de perfis atmosféricos adequados, convergência de umidade, PWAT, estimativa de região/direção e ETA com incerteza.
- **Mar e hidrologia:** onda/dispersão e vento sobre mar com entradas oceânicas, nível/vazão/variação por estação, balanço hídrico do solo e séries históricas.
- **Fusão:** média ponderada e comparação de fontes oficiais homogêneas com pesos auditados; correlações e filtragem/calibração experimental quando autorizadas; duplicação da mesma fonte não constitui segunda confirmação.
- **Segurança:** `MEDICAO_OFICIAL`, `CALCULO_EXPERIMENTAL_BLAISE` e `INFORMACAO_INDISPONIVEL` nunca se confundem. Somente **escala 5** pode ser elegível para áudio/voz/sirene após revisão da evidência e publicador de alertas.

## Dez agentes e responsabilidades

| Nº | Agente funcional | Função |
|---:|---|---|
| 1 | Blaise Sentinel RJ | Integridade de fontes, autorização, horário e município |
| 2 | Blaise Vector RJ | Física, cálculos e recálculos por ocorrência |
| 3 | Blaise Fusion RJ | Comparação, desempate e média ponderada válida |
| 4 | Blaise Track RJ | Trajeto, direção, velocidade e ETA |
| 5 | Blaise Hydro RJ | Chuva, nível, vazão, cheia, inundação e deslizamentos |
| 6 | Blaise Ocean RJ | Mar, ressaca, ondas, ciclones e Atlântico |
| 7 | Blaise Seismo RJ | Sismos, maremotos e avaliação de avisos competentes |
| 8 | Blaise Audit RJ | Revisão científica, fontes e classificação 1–5 |
| 9 | Correção Horária RJ | Testes e revisão periódica de integridade, não correção autônoma já ativa |
| 10 | Auditoria Profunda RJ | Segurança, escala, planos a cada 500 mil assinantes verificados, aprovação de gastos |

**Nomes 9 e 10** são os rótulos funcionais disponíveis, não nomes próprios antigos independentemente confirmados. A presença da lista não significa dez agentes autônomos implantados.

## Situação técnica e próximos gates

- A PR #97 **já foi integrada** ao branch principal e o Android/CI/emulador passaram na revisão correspondente, mas isso **não comprova dados vivos dos 25 itens nem instalação no celular**.
- Esta alteração é uma **consolidação de contrato/catálogo e teste**, não implantação de 25 coletores. Roteadores técnicos permanecem separados; categorias sem rota específica são marcadas `CANONICAL_SPEC_PENDING_DEDICATED_ADAPTER`.
- Antes de produção: autorização de uso de cada produto; chaves/dados oficiais; dados com coordenada, unidade, origem e horário; testes de integração e série histórica; fonte de grade radar autorizada; UI vinculada às respostas; P0 independente de premium; teste físico de voz e assinatura Google Play verificada.
- Dados indisponíveis não significam ausência de risco. Não interpolar valores fictícios para cobrir 92 municípios. **Não solicitar novo APK/ZIP para o celular durante a revisão**.
