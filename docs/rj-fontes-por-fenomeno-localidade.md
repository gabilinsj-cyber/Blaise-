# Blaise V6 RJ — matriz de fontes por fenômeno e localidade

**Regra do projeto (10/10/2026).** Escopo exclusivo do estado do Rio de Janeiro, seus 92 municípios, litoral adjacente e fenômenos do Atlântico capazes de afetar o RJ. **INEA retirado**, inclusive de coletores opcionais e de sondagens operacionais. Esta matriz é uma especificação de roteamento; **não atesta que todas as integrações já estejam operantes**.

## Cartografia e imagens: mapa próprio Blaise

A interface **renderiza seu próprio mapa** com código Android/Canvas do Blaise V6 RJ (`RioGeographicBase.kt`). As malhas de limites municipais têm como base cartográfica um conjunto derivado de dados do IBGE, redistribuído como **CC0** por geodata-br; não são imagens meteorológicas, mosaicos, imagens de radar, tiles ou mapas copiados de um prestador meteorológico.

**Dados de fonte ≠ imagem de fonte.** Dados observados (chuva por estação, temperatura, vento, rajada, avisos, etc.) podem ser representados graficamente de modo original pelo Blaise, respeitando origem, unidade, data, coordenadas, cobertura e condições de uso dos dados. Não precisamos copiar imagens ou o mapa dos provedores. A utilização comercial de *cada base de dados*, inclusive redistribuição por API/produto, continua sujeita a sua licença/termos específicos, diferentemente da geometria CC0 usada como fundo.

A matriz meteorológica principal tem **cinco fontes**, selecionadas conforme a situação: **Alerta Rio** (somente município do Rio), **Defesa Civil regional**, **INMET** (estações de observação e avisos), **Windy** (comparação de modelos, não medição oficial) e **INPE/CPTEC** (previsões, monitoramento e produtos meteorológicos oficiais conforme cobertura, não estação INMET). CEMADEN, ANA, SGB/SACE, Marinha, NOAA e USGS seguem como fontes adicionais por categoria; o nome de uma fonte na lista não afirma que sua API, dados ou licença foram confirmados. O contrato `backend/src/rj-own-map-observations.mjs` somente prepara **pontos de estação oficiais recentes georreferenciados**, exigindo autorização de apresentação verificada. Não gera mapa de radar, chuva interpolada, imagens copiadas ou média municipal fictícia.

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

**P1 conjunta** significa consulta e autoridade dos avisos conforme competência, **não** presumir dois sensores independentes quando um órgão apenas republica o dado de outro. INMET segue como terceira *fonte oficial observacional* de verificação pela hierarquia estabelecida; OpenWeatherMap é a **terceira fonte de consulta complementar**, função diferente. Havendo divergência entre observações oficiais, INPE/CPTEC é a primeira previsão comparativa e Windy é consultado somente se INPE inconclusivo. Não ponderar aviso, perigo ou previsão com medição pontual. O cálculo Blaise verifica fonte, variável, janela, estação, município, hora e independência antes de atribuir pesos. Alerta Rio **não** representa os outros 91 municípios.

OpenWeatherMap oferece APIs conforme plano e exige atribuição/licença correspondente, a exemplo de [seu FAQ](https://openweathermap.org/faq). Produtos meteorológicos combinam estações, satélites e modelos e podem reutilizar observações já presentes em outras fontes: **proibido contá-los automaticamente como nova medição independente**. Cada produto, nível do plano, API, autorização comercial, taxa de uso e atribuição devem ser configurados e testados antes de apresentar dados na interface.

### Base marítima — NOAA, Copernicus Marine e EUMETSAT; boias Marinha complementares (15/10/2026)

| Categoria | Fontes específicas | Papel / restrição |
| --- | --- | --- |
| Ciclones oceânicos e extratropicais | NOAA + Copernicus Marine + EUMETSAT; boias Marinha complementares | Evolução atmosférica e efeitos oceânicos; avisos brasileiros prevalecem |
| Tempestades no Atlântico | NOAA + EUMETSAT; Copernicus conforme produto; boias Marinha complementares | Nuvens/sistemas intensos por satélite; não chamar nuvem de radar de chuva |
| Ondas e swell | NOAA + Copernicus Marine; boias Marinha complementares | Altura, período, direção, grade/estação e horário |
| Ressaca no litoral RJ | NOAA + Copernicus Marine; EUMETSAT para contexto; boias Marinha complementares | Previsão oceânica complementa o aviso costeiro oficial |
| Correntes, marés e temperatura do mar | NOAA + Copernicus Marine por produto; boias Marinha complementares | Separar nível real, maré prevista e estimativa de modelo |
| Tsunami e maremoto | NOAA com produto e jurisdição aplicáveis + autoridades brasileiras; USGS para origem sísmica; boias complementares | **Nunca** inferir tsunami só por magnitude, imagem satelital ou altura de onda |

O [Copernicus Marine](https://help.marine.copernicus.eu/en/articles/4220332-how-to-register-for-copernicus-marine-service) informa que os produtos podem ser usados inclusive comercialmente sem tarifa, com **créditos/citação e termos aplicáveis**; cada produto precisa de identificador/DOI e atribuição. [EUMETSAT](https://www.eumetsat.int/legal-framework/data-policy) tem **regimes de licenciamento por produto/latência**; não assumir que um canal recente para redistribuição comercial esteja automaticamente liberado. Algumas categorias como OSI SAF possuem licença CC-BY 4.0, que exige atribuição. Os serviços não estão conectados ao vivo só porque constam desta tabela.

**Contrato técnico auditável:** `backend/src/rj-phenomenon-source-policy.mjs` (`RJ_PHENOMENA` com 30 categorias e `RJ_SUPPLEMENTAL_PRODUCTS`), `app/src/main/java/br/com/blaise/rj/RjMeteorologicalTables.kt` (tabelas visíveis) e testes respectivos. O mapa RJ permanece desenhado pela Blaise; imagens externas só são reproduzidas dentro dos termos do produto e com aprovação técnica.

## Classes de origem
- **Medição/aviso oficial:** só quando for do órgão competente, identificando produto, coordenada ou município coberto, valor e unidade, observação/emissão em data válida e URL de origem. NOAA é agência oficial para seus produtos, mas previsões numéricas não são medições locais.
- **Contexto de modelo e comparação:** INPE/CPTEC (produtos oficiais de previsão meteorológica e satélite) e Windy (visualização/consulta de modelos); registrar tipo de produto, execução, validade, resolução espacial e autoria. Windy e as previsões do INPE não são automaticamente estações de observação. Registrar modelo, execução, horário previsto, região e licença. **Não usar como confirmação oficial**, nem criar aviso ou valor observado apenas com esse contexto.
- **Cálculo Blaise:** derivação física e matemática sobre entradas identificadas, distinguida de medição. Não preencher lacunas sem dados ou estimar falsa precisão.
- **Indisponível:** falha de rede, HTTP 204, medição antiga, sem licença, fora da cobertura, variável ausente, georreferenciamento desconhecido ou divergência inconclusiva.

## Divisas territoriais e os 92 municípios fluminenses

O Blaise V6 RJ inclui **todos os 92 municípios do RJ, inclusive os localizados nas divisas estaduais**. A localização é identificada por código IBGE do município do RJ, latitude/longitude da observação e cobertura da fonte. Uma estação de outro estado pode ser consultada para contexto regional de frentes, ventos ou massas de ar, **mas nunca apresentada como medição de uma cidade fluminense**.

A seleção das fontes varia conforme o evento e o município. Alerta Rio só cobre a cidade do Rio; Defesa Civil local/estadual e INMET seguem as respectivas áreas e estações; INPE/CPTEC e Windy oferecem contexto de previsão para análise, não números automaticamente observados em cada município. **92 localidades selecionáveis não equivalem a 92 estações ativas**. Temperatura, sensação térmica, rajada, vento, chuva acumulada e temporal somente exibem dados reais quando há produto e intervalo adequados.

No conflito entre medições oficiais, o Blaise compara horário, unidade, tipo de sensor, distância e consistência antes de qualquer média. **INPE e Windy são consultados EM SEQUÊNCIA no desempate de proximidade: INPE primeiro, Windy somente se o INPE não permitir destaque fundamentado**. Um modelo pode apoiar a apresentação de uma medição oficial, com ambas as entradas identificadas separadamente e demais leituras preservadas; não certifica a correção do sensor. A média ponderada entre observações exige que as medições sejam compatíveis; uma média entre modelos, quando justificada, deve ser rotulada como **estimativa de previsão**, nunca medição oficial.

## Hierarquia exata — 3 fontes oficiais, INPE primeiro, Windy somente se necessário

**Temperatura, sensação térmica, vento/rajadas e chuva/temporal no RJ:** o Blaise tenta, nesta ordem, **1. Alerta Rio (somente cidade do Rio) → 2. Defesa Civil competente → 3. INMET**. Nos outros 91 municípios, Alerta Rio não é usado artificialmente e a consulta começa na Defesa Civil, seguindo para INMET conforme cobertura. Sensação térmica é **cálculo físico derivado** de temperatura, umidade e vento válidos, não uma medição fictícia. Gravidade de tempestade e risco não são grandezas numéricas intercambiáveis para média ponderada.

- Se houver **duas medições oficiais independentes e compatíveis** entre as três primeiras, usar a média ponderada tecnicamente justificada, sem consultar os modelos para desempate.
- Se as três primeiras não apresentarem dupla compatível, tentar **4. INPE/CPTEC** como **primeiro desempate de previsão**. Se sua previsão válida estiver significativamente mais próxima de **uma** medição entre as fontes oficiais, apresentar um **par de entradas**: medição oficial destacada + previsão do INPE (com fonte, horário, variável e rótulos diferentes). Manter também as demais medições oficiais divergentes na trilha de evidência. Isso não prova que um sensor esteja certo ou errado.
- Somente **se o INPE não fornecer comparação conclusiva**, tentar **5. Windy**. Caso seu modelo atenda aos mesmos requisitos de localidade, horário, licença e habilidade histórica e aponte claramente para uma medição oficial, apresentar o par **medição oficial + previsão Windy**, mantendo os demais dados oficiais acessíveis.
- Quando nenhum dos dois modelos oferecer desempate seguro, **apresentar uma medição oficial identificada e uma previsão válida identificada como contexto, sem valor final ponderado**, além de preservar as demais leituras oficiais. Se nenhum modelo estiver disponível, expor as leituras oficiais existentes; **não inventar duas fontes**.
- **Não fazer média ponderada entre medição real e previsão.** Uma média *separada* entre dois modelos independentes, historicamente calibrados e temporalmente equivalentes pode existir como previsão experimental, nunca como medição municipal nem confirmação de alerta.
- Chuva horária exige a mesma janela de acumulação de 60 minutos. Temporais exigem avisos oficiais com vigência e categoria — não se calcula média de níveis de alerta.

Para a comparação de proximidade de previsão, usar apenas leituras oficiais da mesma variável/unidade, estações dentro de **25 km** e horários que diferem em até **15 minutos**. A grade do modelo precisa representar a mesma região (distância até 25 km de cada estação, resolução conhecida), e o horário de validade da previsão deve estar a até **1 hora** das medições. O modelo precisa ter metadados de habilidade verificada. São filtros iniciais conservadores, não certificação de precisão local.

Implementado no contrato de backend `backend/src/rj-hierarchical-weather-resolution.mjs`: `resolveRjCompatibleSources`, `consultRjSourcesUntilTwo`, com `sourcePairForDisplay`, `officialReadings` e `inpeConsultation` para a interface futura. Não existem adaptadores meteorológicos ao vivo implantados só por essa alteração. Não autoriza sirenes, alertas ou publicação.

## Regra de decisão — duas primeiras fontes compatíveis na ordem hierárquica

**Objetivo operacional do Blaise V6 RJ:** evitar encerrar a análise só porque as primeiras duas fontes discordam. O **Sentinel RJ** consulta fontes na prioridade definida por fenômeno e cidade (no município do Rio, por exemplo: Alerta Rio → Defesa Civil → INMET → INPE/CPTEC → Windy para temperatura; chuva pode requerer também CEMADEN). O **Fusion RJ** usa a **primeira dupla de provedores independentes com observações oficiais atuais e compatíveis**; o Vector RJ calcula a estimativa derivada com a fórmula e proveniência. Não é necessário esperar que as cinco fontes respondam após validar a dupla.

A compatibilidade exige: mesma variável/unidade/intervalo; município do RJ comprovado; fontes independentes; data/hora válida e sincronizada; estações próximas o bastante para comparação; valores físicos plausíveis; pesos de qualidade documentados. A discordância entre fontes 1 e 2 não encerra a busca: o aplicativo tenta fontes 3, 4 e 5 conforme o tipo de dado, evitando comparar uma previsão com uma medição de estação. Comparações de modelos do INPE e Windy só são usadas como **previsões**, nunca como segundo sensor para validar observação.

**Soluções prioritárias conforme as evidências recuperadas:**
- **Duas medições oficiais compatíveis:** mostrar valor derivado pelo Blaise, fontes/estações e hora; não chamar a estimativa de média de todo o município ou aviso.
- **Medições em conflito, sem dupla compatível:** exibir ao menos a medição individual validada com sua fonte/estação e horário, e sinalizar a discordância; não inventar uma média que esconda diferença importante.
- **Sem medições oficiais, mas duas previsões independentes compatíveis e com pesos de habilidade histórica demonstrados:** apresentar **previsão ponderada**, separada de medição oficial.
- **Uma previsão validada apenas:** apresentar como previsão individual, sem inventar concordância de uma segunda fonte.
- **Nenhuma leitura verificável:** continuar retentativas conforme acesso/frescor da fonte e indicar o último dado oficial com o horário real, quando houver cache ainda permitido. **Não existe fórmula que crie medições reais inexistentes**; o sistema deve evitar concluir ou emitir alerta meteorológico sem evidência.

Implementação: `backend/src/rj-hierarchical-weather-resolution.mjs`, `backend/src/rj-agent-orchestration.mjs` e testes `backend/test/rj-hierarchical-weather-resolution.test.mjs`. A função `consultRjSourcesUntilTwo` **recebe adapters explicitamente configurados**; por si só, não é uma integração de rede ou uma coleta continuamente implantada. O código rejeita uma fonte tentando se passar por duas independentes.

## Divergências entre as cinco fontes meteorológicas

1. Uma leitura recente do **INMET**, Alerta Rio ou Defesa Civil (conforme estação e competência) permanece observação/aviso oficial; uma previsão do **INPE/CPTEC** ou modelo visualizado no **Windy** permanece previsão, mesmo que coincida numericamente com uma estação.
2. Se duas medições oficiais discordarem, verificar município, coordenadas, distância entre estações, mesmo intervalo/unidade, carimbo de tempo, calibração e qualidade. Após tentar a terceira fonte oficial **INMET**, consultar **INPE/CPTEC primeiro**; só quando o INPE não permitir comparar adequadamente as leituras, recorrer ao **Windy**. São referências de previsão, não sensores, e nenhum modelo prevalece sobre aviso oficial.
3. **Média ponderada de observações**: somente após validar variáveis, horários, distâncias, pesos tecnicamente justificados e uma divergência abaixo do limiar de investigação. Diferença relevante => destacar divergência e não calcular média destinada a ocultá-la.
4. **Média ponderada de previsões**: grupo separado, nunca misturar previsões com observações. Exigir mesmo fenômeno, município/célula, prazo, unidade, modelos/produtos independentes e pesos derivados de verificação histórica documentada. Sem calibração, indisponível.
5. O diagnóstico está em `backend/src/rj-weather-source-reconciliation.mjs` e `backend/test/rj-weather-source-reconciliation.test.mjs`. **É algoritmo local e roteamento, ainda não comprova acesso vivo ou licença de API do INPE.** Todos os resultados derivados permanecem não oficiais e não autorizam alertas automáticos.
6. **CPTEC/INPE**: a documentação técnica contém o serviço de dados por localidade em [XML](https://servicos.cptec.inpe.br/XML/), mas a [página oficial do CPTEC](https://www.cptec.inpe.br/) avisa que determinados produtos não podem ser usados para fins comerciais ou reprodução sem autorização expressa. Solicitar ou confirmar licença/autorizações aplicáveis antes de integrar dados à assinatura do Blaise, mesmo que o mapa e seus gráficos sejam desenhados pelo próprio aplicativo. Identificar sempre a origem **CPTEC/INPE** e a data/modelo de emissão. Não presumir que XML público seja automaticamente licenciado para a exploração comercial.

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


## Mudança de prioridade marítima aprovada em 15/10/2026

A ausência de credencial/dados das boias da Marinha não deve impedir consultas a produtos NOAA, Copernicus Marine ou EUMETSAT. Preferência de consulta não equivale a disponibilidade operacional. Nenhuma das três fontes é declarada responsável universal por marés locais, ressaca, tsunami ou massas de ar: a capacidade é específica por produto, área, rodada, validade e licença.

- NOAA GFSwave: previsão numérica de ondas/swell; arquivos GRIB2 globais no NOMADS. Não são medição de praia nem aviso local de ressaca.
- Copernicus GLOBAL_ANALYSISFORECAST_WAV_001_027: grade global de ondas com saídas de três em três horas. Atualizar consulta a cada minuto não transforma a saída em observação por minuto.
- EUMETSAT: produtos de satélite/OSI SAF para variáveis compatíveis, nuvens, sistemas, ventos e temperatura do mar por produto. Não é tabela de maré nem emissor autônomo de alerta de tsunami para o RJ.
- Maré alta/baixa requer produto de previsão astronômica/localidade/fuso/referência vertical validado. Altura do mar de um modelo não substitui automaticamente tábua de marés.
- Tsunami sísmico, meteotsunami e ressaca são fenômenos diferentes; somente avisos com autoridade e cobertura comprovadas podem ser apresentados como oficiais. Boias não substituem esse processo. A prioridade das consultas de dados não revoga avisos competentes da Marinha/Defesa Civil.

Fontes consultadas: https://www.nco.ncep.noaa.gov/pmb/products/wave/ ; https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl ; https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/services ; https://www.eumetsat.int/distributing-data ; https://osi-saf.eumetsat.int/about/access-data ; https://tsunami.ioc.unesco.org/en/warningsystems . Produtos identificados/documentação conferida; ingestão numérica ponta a ponta ainda não validada.


## Stormsurf — consulta complementar aprovada em 15/10/2026

Cadastrar https://www.stormsurf.com/page2/links/satla72hr.shtml na interface como link externo de previsão visual para o Atlântico Sul (ondas/swell/vento/pressão). Não alterar prioridade NOAA → Copernicus Marine → EUMETSAT por produto; boias Marinha complementares. Produtos Stormsurf derivados de NOAA não contam como outra medição independente nem entram em média como confirmação independente. Sem dados numéricos extraídos, sem afirmação de maré alta/baixa local, aviso oficial de ressaca ou tsunami.

A página declara que links são permitidos e que reprodução/reutilização/enquadramento exige autorização escrita. Portanto, disponibilizar botão para o navegador, sem copiar gráficos, iframe/WebView ou extrair conteúdo. Timestamps, imagens e disponibilidade da página externa não foram homologados como feed do Blaise. Zoom Earth permanece excluído por decisão da usuária; não adicionar conector ou link dele.


## Revisão 15/10/2026: exclusão de fornecedor e CPTEC
A decisão mais recente exclui Marinha/CHM e PNBOIA/REMObs da operação e interface. Substitui as prioridades marítimas anteriores deste documento. O runtime não monta as rotas de marés/boias e força avisos CHM desativados. O Android não aceita payload marítimo legado e elimina o histórico marítimo local.
NOAA, Copernicus e EUMETSAT permanecem por produto; CPTEC/INPE é previsão complementar em avaliação. Documentação: https://servicos.cptec.inpe.br/XML/ . Rio código241; ondas/vento previstos, horários UTC. Tentativa HTTPS em15/10/2026: timeout; sem ingestão numérica validada. Não atribuir automaticamente forçante NCEP a todo produto CPTEC. Não representa maré alta/baixa ou confirmação de tsunami/ressaca. Nenhum acompanhamento do email enviado anteriormente será realizado.


### Servidor: validação da rota e atualização segura
Candidatura e promoção Cloud Run usam o mesmo validador scripts/validate-public-status.py. Antes de promover tráfego e após a alteração (sob rollback existente), testar rota /v1/public/rj-status. Rejeitar404,503quando serviço habilitado,contratoincorreto,workerinativo,timestamp semtimezone,vencido/futuro. Rotas explicitamente desabilitadas devem responder503comerrocorreto; isto comprova somente presença da rota e não dados ativos. Envelope atual não comprova medição marítima ou atualização de cada fonte. Deploy permanece manualviaidentidadeOIDC configurada; não inventarURL nem contornar termos.

### Diagnóstico e resiliência das coletas — 15/10/2026
A revisão candidata 00041-xif comprovou ciclos de consulta de Alerta Rio e CEMADEN, com falha HTTP no INMET. Sucesso de consulta não comprova atualidade da medição nem integração Android em produção. O coletor registra resultado, código de falha, horário da consulta, horário da observação e idade do dado, sem conteúdo bruto ou credenciais. Consultas INMET repetem uma vez falhas de rede e HTTP 500/502/503/504, respeitando o timeout da requisição. Falha persistente não é inventário vazio nem retirada de alerta: o cache mantém o último estado segundo validade e retenção existentes. A interface explica essa diferença. Não modificar horário original, ampliar validade, habilitar termos de fonte ou promover tráfego para ocultar indisponibilidade.

### Validade por estação e integração do painel — 15/10/2026
No Alerta Rio, cada estação é elegível somente com medição não futura de até 5 minutos e cache de até 5 minutos. Uma estação vencida não elimina as atuais: a rede fica CURRENT_DEGRADED, a projeção contém apenas estações elegíveis, preserva seus horários e informa quantidades atuais/excluídas. Sem nenhuma estação atual, o estado continua STALE e nenhum resumo é entregue. Não ampliar a validade para forçar resultado verde. O painel Android aceita currentStationCount do backend, mostra cobertura parcial e não assume 33 estações atuais em respostas legadas sem essa contagem. CEMADEN mantém sua validação existente; sucesso HTTP, reconsulta e risco hidrológico não comprovam observação meteorológica recente. INMET persistindo em falha permanece indisponível, sem inventar retirada de alertas. A candidata 00044-kex não foi promovida; a nova alteração requer nova implantação e Android requer build/testes próprios antes de alegar funcionamento em APK.

### Verificação específica INMET/CEMADEN — 15/10/2026

`node backend/scripts/verify-inmet-cemaden.mjs` executa os mesmos contratos do coletor, registra HTTP por caminho (inclusive repetição), idade por município e canais oficiais alternativos, sem publicar dados. Código de saída 1 significa falha de contrato de alguma fonte; aprovação de contrato não significa atualidade. CEMADEN-RJ informa “Última Atualização” de um status de risco, não horário de sensor. Logs agora distinguem o significado do horário, a janela de atualizações e a contagem dentro do limite de 30 minutos do cache; o painel continua exigindo 5 minutos por município. Nenhum limite foi ampliado.

Nesta verificação o RSS INMET respondeu 200, vários CAP responderam 200, mas `/avisos/rss/56050` respondeu 500 duas vezes: inventário incompleto continua bloqueado. Requisições já iniciadas são drenadas antes do término da coleta, evitando requisições órfãs e diagnóstico incompleto. CEMADEN-RJ validou 92 municípios, com últimas atualizações de 05:25:55 a 15:26:06 (Brasília); às 16:18 nenhum estava dentro de cinco minutos. Download recente não renova status antigo.

Alternativas investigadas: metadados oficiais WIS2 INMET anunciam CAP via MQTT; isso ainda não comprova entrega ao vivo ou inventário completo. O painel nacional CEMADEN expõe `/wsAlertas2`, com alertas abertos e horário de atualização; não equivale aos níveis de risco dos 92 municípios. Ausência de alerta no RJ não significa ausência de risco. Nenhuma substituição automática foi habilitada. Mudanças na interface ainda dependem de APK instalado; esta revisão não foi implantada no Cloud Run.

### Canais alternativos implementados — 15/10/2026

Após validação de conteúdo, WIS2/INMET passou a ser canal alternativo de coleta CAP via HTTPS oficial `https://wis2bra.inmet.gov.br/data/`. A listagem S3 pública de hoje/ontem UTC é limitada a 128 arquivos, sem paginação truncada, sem redirecionamento, 6 downloads simultâneos e 16 MiB agregados. O armazenamento serve XML como `application/octet-stream`; isso é aceito apenas neste adaptador, com UTF-8 estrito, identidade INMET, datas CAP e área validadas. O campo oficial `Municipios` é validado por par nome/IBGE para permitir atribuição municipal exata. O canal não recebe status de inventário completo: ausência no arquivo nunca retira alertas, e cancelamentos exigem CAP explícito. A política local de 12 horas continua aplicada.

Nova coleta CEMADEN nacional: `https://painelalertas.cemaden.gov.br/wsAlertas2`, exclusivamente alertas abertos com UF RJ e IBGE/nome canônicos. O horário UTC de atualização do inventário precisa ter até 5 minutos; registros sem fuso mantêm o texto original. O produto não substitui nível de risco municipal, chuva, sensores ou radar. Zero alertas no inventário não prova ausência de risco. Payload público e painel autenticado incluem o produto separado; Android mostra a consulta e alertas no bloco de cada cidade. Níveis oficiais altos aceleram a coleta, sem gerar alarme ou converter automaticamente para escala 5.

Flags da candidata: `BLAISE_INMET_WIS2_ENABLED=true` usa WIS2 primeiro e RSS como fallback; `BLAISE_CEMADEN_NATIONAL_ENABLED=true` ativa o novo produto, preservando o coletor CEMADEN-RJ separado. Ambas permanecem desligadas sem configuração explícita. Verificação conjunta: `node scripts/verify-alternative-sources.mjs` a partir de backend. Na execução ao vivo foram validados 18 CAP, com 3 avisos recentes RJ de início futuro e nenhum aviso vigente elegível naquela consulta, e inventário nacional CEMADEN recente sem alertas RJ. São resultados daquela consulta, não garantia futura nem validação do APK. Implantação da candidata e revisão Android continuam pendentes.

Validação desta revisão: 637 testes backend aprovados, incluindo ligação dos dois coletores ao payload público, atribuição municipal e bloqueio de inventário completo no arquivo WIS2. Verificação de sintaxe aprovada. Testes Android adicionados; execução Android e instalação ainda pendentes.

### REDEMET/DECEA e SiMCosta — alternativas por produto (15/10/2026)

Pedido do usuário: incluir REDEMET na Tabela 2 quando houver indisponibilidade de INMET/CEMADEN, sem inventar dados, e avaliar mais uma fonte marítima. REDEMET é alternativa para produtos meteorológicos aeronáuticos compatíveis, não para risco hidrológico/geológico do CEMADEN. METAR/SPECI: observações de aeródromo, com estação/coordenadas e horário próprios; temperatura, ponto de orvalho, vento/rajada quando informada, pressão/QNH, visibilidade e fenômenos reportados. TAF é previsão; SIGMET é aviso aeronáutico. Não converter METAR em chuva acumulada municipal, risco de inundação ou observação para os 92 municípios. Umidade calculada deve ser rotulada como cálculo, nunca leitura de sensor. Frequência de consulta não altera a hora real de emissão.

A API REDEMET requer cadastro/chave e possui limites de uso, conforme https://ajuda.decea.mil.br/base-de-conhecimento/api-redemet-mensagem-metar/ e https://ajuda.decea.mil.br/base-de-conhecimento/api-redemet-o-que-e/ . Ainda não há credencial, permissão de redistribuição comercial ou adaptador validado neste projeto. Estado: FONTE_PROPOSTA_NAO_CONECTADA. Alerta Rio + Defesa Civil RJ mantêm prioridade conjunta onde houver produto local válido; a substituição na Tabela 2 depende de variável, proximidade, horário e compatibilidade.

SiMCosta/FURG: nova candidata marítima observacional para complementar Copernicus Marine (já previsto), NOAA e demais produtos autorizados. O portal https://www.simcosta.furg.br/ lista estações RJ e Niterói; isso não comprova que estejam operacionais agora. Ondas, correntes, nível do mar, temperatura da água e meteorologia dependem dos sensores de cada plataforma. Validar acesso automatizado, termos, estação, unidade, controle de qualidade e horário antes da ingestão. Sem extrair sem autorização nem contar medições republicadas como confirmação independente. Estado: FONTE_PROPOSTA_NAO_CONECTADA. Não equivale a aviso oficial de ressaca, previsão de maré astronômica ou alerta de tsunami.
