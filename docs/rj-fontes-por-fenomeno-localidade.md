# Blaise V6 RJ — matriz de fontes por fenômeno e localidade

**Regra do projeto (10/10/2026).** Escopo exclusivo do estado do Rio de Janeiro, seus 92 municípios, litoral adjacente e fenômenos do Atlântico capazes de afetar o RJ. **INEA retirado**, inclusive de coletores opcionais e de sondagens operacionais. Esta matriz é uma especificação de roteamento; **não atesta que todas as integrações já estejam operantes**.

## Cartografia e imagens: mapa próprio Blaise

A interface **renderiza seu próprio mapa** com código Android/Canvas do Blaise V6 RJ (`RioGeographicBase.kt`). As malhas de limites municipais têm como base cartográfica um conjunto derivado de dados do IBGE, redistribuído como **CC0** por geodata-br; não são imagens meteorológicas, mosaicos, imagens de radar, tiles ou mapas copiados de um prestador meteorológico.

**Dados de fonte ≠ imagem de fonte.** Dados observados (chuva por estação, temperatura, vento, rajada, avisos, etc.) podem ser representados graficamente de modo original pelo Blaise, respeitando origem, unidade, data, coordenadas, cobertura e condições de uso dos dados. Não precisamos copiar imagens ou o mapa dos provedores. A utilização comercial de *cada base de dados*, inclusive redistribuição por API/produto, continua sujeita a sua licença/termos específicos, diferentemente da geometria CC0 usada como fundo.

A matriz meteorológica principal tem **cinco fontes**, selecionadas conforme a situação: **Alerta Rio** (somente município do Rio), **Defesa Civil regional**, **INMET** (estações de observação e avisos), **Windy** (comparação de modelos, não medição oficial) e **INPE/CPTEC** (previsões, monitoramento e produtos meteorológicos oficiais conforme cobertura, não estação INMET). CEMADEN, ANA, SGB/SACE, Marinha, NOAA e USGS seguem como fontes adicionais por categoria; o nome de uma fonte na lista não afirma que sua API, dados ou licença foram confirmados. O contrato `backend/src/rj-own-map-observations.mjs` somente prepara **pontos de estação oficiais recentes georreferenciados**, exigindo autorização de apresentação verificada. Não gera mapa de radar, chuva interpolada, imagens copiadas ou média municipal fictícia.

Uma **imagem própria com núcleos coloridos de chuva** exige *campos espacializados reais* (por exemplo, células/grade de radar ou satélite com resolução, hora, refletividade/intensidade e georreferenciamento) devidamente autorizados; quatro leituras pontuais **não permitem deduzir esses pixels**. Até existir a entrada, a camada permanece indisponível.

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
