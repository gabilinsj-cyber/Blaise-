# Blaise V6 RJ — matriz de fontes por fenômeno e localidade

**Regra do projeto (10/10/2026).** Escopo exclusivo do estado do Rio de Janeiro, seus 92 municípios, litoral adjacente e fenômenos do Atlântico capazes de afetar o RJ. **INEA retirado**, inclusive de coletores opcionais e de sondagens operacionais. Esta matriz é uma especificação de roteamento; **não atesta que todas as integrações já estejam operantes**.

## Cartografia e imagens: mapa próprio Blaise

A interface **renderiza seu próprio mapa** com código Android/Canvas do Blaise V6 RJ (`RioGeographicBase.kt`). As malhas de limites municipais têm como base cartográfica um conjunto derivado de dados do IBGE, redistribuído como **CC0** por geodata-br; não são imagens meteorológicas, mosaicos, imagens de radar, tiles ou mapas copiados de um prestador meteorológico.

**Dados de fonte ≠ imagem de fonte.** Dados observados (chuva por estação, temperatura, vento, rajada, avisos, etc.) podem ser representados graficamente de modo original pelo Blaise, respeitando origem, unidade, data, coordenadas, cobertura e condições de uso dos dados. Não precisamos copiar imagens ou o mapa dos provedores. A utilização comercial de *cada base de dados*, inclusive redistribuição por API/produto, continua sujeita a sua licença/termos específicos, diferentemente da geometria CC0 usada como fundo.

A política de consulta meteorológica contém **duas tabelas separadas**: **Tabela 1, P1 conjunta de Alerta Rio (apenas cidade do Rio) e Defesa Civil por competência, com OpenWeatherMap como 3ª fonte complementar**; e **Tabela 2 de desempate, exatamente INPE/CPTEC → INMET → CEMADEN → Windy → NOAA**, respeitando o produto adequado a cada fenômeno. ANA, SGB/SACE, Marinha, Copernicus e EUMETSAT seguem como fontes especializadas por categoria; nenhum cadastro comprova conexão ou licença vigente. O contrato `backend/src/rj-own-map-observations.mjs` somente prepara **pontos de estação oficiais recentes georreferenciados**, exigindo autorização de apresentação verificada. Não gera mapa de radar, chuva interpolada, imagens copiadas ou média municipal fictícia.

Uma **imagem própria com núcleos coloridos de chuva** exige *campos espacializados reais* (por exemplo, células/grade de radar ou satélite com resolução, hora, refletividade/intensidade e georreferenciamento) devidamente autorizados; quatro leituras pontuais **não permitem deduzir esses pixels**. Até existir a entrada, a camada permanece indisponível.

## Revisão de 12/10/2026 — ampliação para 30 fenômenos e complementos

**Situação de validação:** o cadastro anterior continha **25 categorias**. Cinco categorias adicionais foram registradas para atingir **30 no código** (`CHUVA_ATUAL`, `MARE`, `SWELL`, `CORRENTES_MARINHAS`, `TEMPERATURA_MAR`), com **cinco novas verificações de desempate** na interface (treze critérios ao todo). Esta é uma reconciliação técnica com os requisitos recuperados; **as duas capturas apresentadas exibem somente os dez primeiros fenômenos e o quadro marítimo**, logo não comprovam que estes sejam exatamente os dois itens adicionais da tabela original de 28. Não declarar correspondência histórica exata sem a tabela integral.

### Tabela 1, itens 1–10 — prioridade P1 e terceiro complemento OpenWeatherMap

| Fenômeno | Prioridade P1 (por disponibilidade do produto) | Terceiro complemento |
| --- | --- | --- |
| Temperatura | Alerta Rio (cidade do Rio) + Defesa Civil local/RJ | OpenWeatherMap |
| Sensação térmica | Alerta Rio + Defesa Civil, com T/UR/vento válidos; cálculo Blaise | OpenWeatherMap |
| Chuva atual | Alerta Rio + Defesa Civil, por estação e horário | OpenWeatherMap |
| Chuva acumulada | Alerta Rio + Defesa Civil, mesma janela (1h, 24h etc.) | OpenWeatherMap, se a janela existir |
| Chuva intensa / temporal | Alerta Rio + Defesa Civil, avisos confirmados | OpenWeatherMap, contexto não oficial |
| Vento sustentado | Alerta Rio + Defesa Civil, se houver observação | OpenWeatherMap |
| Rajadas fortes | Alerta Rio + Defesa Civil, se houver medição da rajada | OpenWeatherMap |
| Pressão atmosférica | Alerta Rio + Defesa Civil, se houver produto | OpenWeatherMap |
| Umidade relativa | Alerta Rio + Defesa Civil, se houver produto | OpenWeatherMap |
| Granizo | Alerta Rio + Defesa Civil por aviso oficial | OpenWeatherMap, somente se o produto suportar |

**P1 conjunta** significa prioridade de consulta e autoridade de aviso conforme competência, **não** duas estações independentes quando uma fonte republica a outra. O **OpenWeatherMap é a 3ª consulta complementar da Tabela 1**. O **INMET é a 2ª referência da Tabela 2**, após INPE/CPTEC; são papéis distintos. Não ponderar avisos, perigos ou previsões com medições pontuais. O cálculo Blaise verifica fonte, variável, janela, estação, município, hora e independência antes de atribuir pesos. **Alerta Rio não representa os outros 91 municípios.**

OpenWeatherMap oferece APIs conforme plano e exige atribuição/licença correspondente, a exemplo de [seu FAQ](https://openweathermap.org/faq). Produtos meteorológicos combinam estações, satélites e modelos e podem reutilizar observações já presentes em outras fontes: **proibido contá-los automaticamente como nova medição independente**. Cada produto, nível do plano, API, autorização comercial, taxa de uso e atribuição devem ser configurados e testados antes de apresentar dados na interface.

### Tabela 2 — cinco fontes de desempate, em ordem hierárquica

A Tabela 2 **só é acionada quando não houver duas leituras independentes convergentes na Tabela 1**. Uma fonte de desempate pode sustentar uma leitura primária, mas **não substitui os avisos oficiais**.

| Ordem | Fonte | Produto elegível / regra |
| --- | --- | --- |
| 1 | **INPE/CPTEC** | Previsões e produtos meteorológicos oficiais, com modelo, validade e licença identificados; não é estação de observação |
| 2 | **INMET** | Leitura real de estação e avisos meteorológicos, se existirem cobertura e horário válidos |
| 3 | **CEMADEN** | Pluviômetros, acumulados de chuva e produtos de risco; **não presumir medição de temperatura, pressão ou vento** |
| 4 | **Windy** | Comparação de modelos, com origem e família do modelo verificadas; não é segunda estação oficial |
| 5 | **NOAA** | Produto de previsão, satélite ou oceânico apropriado à variável; no mar, preservar os avisos da Marinha/autoridades brasileiras |

**Decisão:** se uma consulta produzir medição atual independente e compatível com a leitura primária, calcular a média aritmética ou ponderada com pesos justificados; parar quando houver par válido. Se produzir **apenas previsão**, expor o par **medição observada + previsão**, com respectivos nomes, horários e divergência — **não** calcular uma média mista. Se uma fonte não fornecer o produto aplicável, passar à próxima. Não usar valores inventados para chegar a duas fontes.

**Implementação validável:** `backend/src/rj-table12-five-source-dispute.mjs` (sequência `RJ_TABLE2_FIVE`, papéis `RJ_TABLE2_PROVIDER_ROLES` e `rjTable2EligibleSources`) e a tabela Android `RjMeteorologicalTables.kt`. A matriz de 30 fenômenos e as cinco categorias marítimas da interface continuam independentes deste desempate numérico. Tabelas não provam alimentação ao vivo.

### Complemento marítimo — Marinha, NOAA, Copernicus e EUMETSAT

| Categoria | Fontes específicas | Papel / restrição |
| --- | --- | --- |
| Ciclones oceânicos e extratropicais | Marinha/CHM + NOAA + EUMETSAT + Copernicus Marine | Evolução atmosférica e efeitos oceânicos; avisos brasileiros prevalecem |
| Tempestades no Atlântico | Marinha/CHM + NOAA + EUMETSAT | Nuvens/sistemas intensos por satélite; não chamar nuvem de radar de chuva |
| Ondas e swell | Marinha/CHM + NOAA + Copernicus Marine | Altura, período, direção, grade/estação e horário |
| Ressaca no litoral RJ | Marinha/CHM + boias competentes + Copernicus Marine + NOAA | Previsão oceânica complementa o aviso costeiro oficial |
| Correntes, marés e temperatura do mar | Marinha/CHM + Copernicus Marine + NOAA | Separar nível real, maré prevista e estimativa de modelo |
| Tsunami e maremoto | NOAA + Marinha + autoridades brasileiras; USGS para origem sísmica | **Nunca** inferir tsunami só por magnitude, imagem satelital ou altura de onda |

O [Copernicus Marine](https://help.marine.copernicus.eu/en/articles/4220332-how-to-register-for-copernicus-marine-service) informa que os produtos podem ser usados inclusive comercialmente sem tarifa, com **créditos/citação e termos aplicáveis**; cada produto precisa de identificador/DOI e atribuição. [EUMETSAT](https://www.eumetsat.int/legal-framework/data-policy) tem **regimes de licenciamento por produto/latência**; não assumir que um canal recente para redistribuição comercial esteja automaticamente liberado. Algumas categorias como OSI SAF possuem licença CC-BY 4.0, que exige atribuição. Os serviços não estão conectados ao vivo só porque constam desta tabela.

**Contrato técnico auditável:** `backend/src/rj-phenomenon-source-policy.mjs` (`RJ_PHENOMENA` com 30 categorias e `RJ_SUPPLEMENTAL_PRODUCTS`), `app/src/main/java/br/com/blaise/rj/RjMeteorologicalTables.kt` (tabelas visíveis) e testes respectivos. O mapa RJ permanece desenhado pela Blaise; imagens externas só são reproduzidas dentro dos termos do produto e com aprovação técnica.

## Classes de origem
- **Medição/aviso oficial:** só quando for do órgão competente, identificando produto, coordenada ou município coberto, valor e unidade, observação/emissão em data válida e URL de origem. NOAA é agência oficial para seus produtos, mas previsões numéricas não são medições locais.
- **Contexto de modelo e comparação:** INPE/CPTEC (produtos oficiais de previsão meteorológica e satélite) e Windy (visualização/consulta de modelos); registrar tipo de produto, execução, validade, resolução espacial e autoria. Windy e as previsões do INPE não são automaticamente estações de observação. Registrar modelo, execução, horário previsto, região e licença. **Não usar como confirmação oficial**, nem criar aviso ou valor observado apenas com esse contexto.
- **Cálculo Blaise:** derivação física e matemática sobre entradas identificadas, distinguida de medição. Não preencher lacunas sem dados ou estimar falsa precisão.
- **Indisponível:** falha de rede, HTTP 204, medição antiga, sem licença, fora da cobertura, variável ausente, georreferenciamento desconhecido ou divergência inconclusiva.

## Divisas territoriais e os 92 municípios fluminenses

Todos os **92 municípios do RJ**, inclusive os de divisa estadual, permanecem selecionáveis. Cada medição deve ter código IBGE, coordenadas da estação, hora e produto efetivamente disponível. Alerta Rio só cobre o município do Rio; dados de estados vizinhos podem servir como contexto meteorológico, mas não como medição fluminense.

A **sequência normativa vigente** é a **Tabela 1 P1 Alerta Rio + Defesa Civil; OpenWeatherMap 3ª consulta complementar**, seguida, se necessário, pela **Tabela 2 INPE/CPTEC → INMET → CEMADEN → Windy → NOAA**. Qualquer lista antiga com INMET antes de INPE ou Windy antes de CEMADEN/NOAA refere-se a uma versão anterior e **não rege a Tabela 2 atual**. Consultar a próxima fonte somente quando a anterior não apresentar dupla independente e compatível ou comparação informativa validada.

**Termometria, chuva, vento e pressão:** comparar mesma variável, unidade, janelas de acumulação e hora; para duas estações, usar limite conservador inicial de 15 minutos e 25 km (a calibrar por fenômeno). Média ponderada só entre **observações compatíveis**, com pesos auditáveis. Sensação térmica é um **cálculo físico** a partir de entradas válidas, não a média entre categorias ou modelos. Em caso de discrepância não solucionada, conservar leituras oficiais distintas e, quando apropriado, uma previsão separadamente identificada. **Avisos de temporal, granizo e tsunami não são grandezas numéricas que possam ser promediadas.**

**Exceções:** mar, rios, ciclones, satélite, raios, sismos, ressaca e tsunami consultam também a tabela marítima e a fonte especializada competente. Avisos brasileiros de Defesa Civil e Marinha não perdem prioridade por causa da classificação de desempate de dados.

**Limites operacionais:** o cadastro de 92 localidades não garante estação em cada uma, nem integração ativa com as APIs. Consultar e expor somente fontes com autorização, prova de conectividade, recência e cobertura; nunca fabricar a segunda medição ou declarar “sem risco” por ausência de dados.

## Fontes por região e fenômeno

| Região / fenômeno | Prioridade de origem | Complementares / critérios |
|---|---|---|
| Rio de Janeiro (município): chuva, radar, acumulados, alertas | Alerta Rio e avisos locais da Defesa Civil; CEMADEN conforme cobertura | INMET para amostra pontual de estação; não chamar estação de radar nem interpolar municípios |
| Demais 91 municípios: chuva/temporal/risco | Defesa Civil competente e CEMADEN; INMET para observações nas estações disponíveis | Comparar Windy apenas como contexto, nunca afirmar que Alerta Rio cobre todo o estado |
| Todos os 92 municípios: temperatura, sensação térmica, umidade, vento/rajadas | INMET e redes oficiais municipais/Defesa Civil **onde houver observações**, com local, horário e qualidade | Sensação térmica calculada quando temperatura, umidade/vento e fórmula se aplicarem; INPE/CPTEC e Windy oferecem previsão complementar; Windy é critério comparativo subsidiário, não desempate autoritativo |
| Nível de rios, cota e vazão | ANA (HidroWeb / serviços hidrológicos) | CEMADEN e SGB/SACE para contexto e situação de cheia; conferir identificação da estação e atualização |
| Risco hidrológico/inundação | CEMADEN, Defesa Civil e SGB/SACE segundo competência | Cruzar com ANA quando disponível; risco não é substituível por vazão isolada |
| Mar, ressaca, ondas, vento marítimo, avisos à navegação | Marinha do Brasil/CHM | NOAA para produtos oficiais pertinentes; INMET costeiro e Windy apenas complemento com tipo de dado explicitado |
| Ciclone extratropical/temporal no Atlântico Sul | Marinha do Brasil e produtos pertinentes NOAA; INMET para observações/avisos nacionais | Windy para comparação de modelos e trajetória estimada; ao ameaçar RJ, priorizar avisos Marinha, INMET, Alerta Rio e Defesa Civil conforme área |
| Acumulado de chuva oceânica, nuvens, frentes e massas de ar quente/fria | NOAA e produtos oficiais pertinentes da Marinha/INMET; satélites/modelos conforme licenciamento | Windy como referência de previsão e visualização, **não como medidor no oceano** |
| Interação oceano–litoral RJ / impactos locais | Marinha do Brasil + INMET + Defesa Civil local/estadual + Alerta Rio (somente município do Rio) | Windy complementar; confirmar distância, direção, horário provável e alcance, sem regra artificial de limite de 1 km quando não houver dados |

## Calculadora científica Blaise V6 RJ — cálculos suplementares

A implementação inicial está em `backend/src/rj-scientific-calculator.mjs` e seu primeiro teste em `backend/test/rj-scientific-calculator.test.mjs`. **Não é validação de previsão meteorológica, nem substitui alertas oficiais.**

- **Média ponderada:** \(\bar{x}=\sum_i w_i x_i / \sum_i w_i\). Só comparar **observações oficiais da mesma variável, unidade e município**, registradas em até 15 minutos de diferença, atuais e de estações a no máximo 25 km de distância entre si; exige no mínimo 2 pontos distintos e pesos de qualidade documentados. Valores Windy/modelo, níveis de alerta e fenômenos diferentes não entram na média.
- **Ponto de orvalho:** aproximação termodinâmica de Magnus, quando temperatura e umidade relativa estiverem medidas e dentro do domínio válido, com carimbo de horário recente.
- **Sensação térmica:** fórmula Rothfusz/NOAA para calor e vento-frio para temperaturas baixas e ventos adequados; fora da faixa da fórmula, mostrar **indisponível**, não a temperatura ambiente como se fosse sensação calculada.
- **Acumulado de chuva:** não somar amostras sem intervalo, horário, duração e unidades comparáveis. Para 5/10/15/30 min, 1h e 24h, usar apenas observações oficiais com janela demonstrável; sem janela completa, não inferir acumulado.
- **Outros diagnósticos atmosféricos** (advecção, tendência de pressão, vorticidade, estabilidade convectiva, cisalhamento, movimento radar) seguem **pendentes de dados verticais/espaciais autorizados e testes de unidade físicos**. A presença da fórmula em uma especificação não prova execução.
- Identificar toda saída como **“Cálculo experimental Blaise — não é medição oficial”**, informar fontes, local, horário, fórmula e limites. Nenhum cálculo isolado aciona P0/voz/sirene.

## Política de divergências, cobertura e cadastro
1. Restringir primeiro **localidade + fenômeno + variável + tempo**. Não combinar medições de escalas temporais distintas ou pontos distantes.
2. Comparar observações oficiais contemporâneas, métodos, precisão, estação, qualificação e unidade; quando não houver acordo, exibir a divergência e bloquear conclusão automática. **Windy pode ajudar a investigar, mas não prevalece sobre medição ou aviso oficial.**
3. A cobertura dos **92 municípios** significa que todos podem ser selecionados; **não** significa que cada município tenha estação INMET, radar, alerta local ou medição atual. Mostrar explicitamente cobertura, origem e horário para cada valor.
4. Em situação severa, a cadência desejada é coleta e recálculo de até 30 segundos **quando a fonte oferecer dados novos e a licença/limite permitir**. Repetir requisições não torna a fonte mais atual.
5. Aviso nível 5 só aciona som e voz conforme regra específica de confirmação e elegibilidade do projeto. Dados de terceiros ou cálculos experimentais não são substitutos de avisos oficiais.
6. Radar real requer fonte licenciada, prova de data do frame, projeção e georreferenciamento; caso contrário a camada permanece **indisponível**.
7. Capturar falhas de autorização, domínios e mudanças de API, com auditoria; nunca alterar origem automaticamente para página não autorizada.
8. Conectores INPE/CPTEC, ANA, SGB/SACE, NOAA e Windy devem ser implementados e comprovados separadamente. A presença nesta matriz não equivale a ingestão funcional.

**Situação atual de validação:** o INMET já possui modelo de leitura pontual e testes; última consulta externa reportou HTTP 204 em quatro estações do Rio, portanto **dados horários recentes não comprovados**. As camadas oceânicas, radar espacial, assinatura Google Play e voz física permanecem sujeitas à validação e/ou à autorização aplicável.
