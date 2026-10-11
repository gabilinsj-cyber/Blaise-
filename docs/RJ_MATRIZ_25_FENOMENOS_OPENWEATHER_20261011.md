# Blaise V6 RJ — matriz completa de 25 fenômenos com OpenWeatherMap como terceira consulta
**Versão:** 11/10/2026 • **Escopo exclusivo:** os 92 municípios do estado do Rio de Janeiro, divisas, litoral e Atlântico que possa afetar RJ. **INEA fora de todas as fontes operacionais.**

## Prioridade municipal aprovada
| Etapa | Fonte | Uso e limitação |
| --- | --- | --- |
| 1 | **Alerta Rio** | Estações, radar e avisos **somente do município do Rio**, conforme produto; nos outros 91 municípios **pular** esta etapa. |
| 2 | **Defesa Civil RJ (estadual, regional ou municipal)** | Avisos e observações cuja autoridade, cobertura territorial, janela temporal e fonte primária sejam identificadas; republicações NÃO são confirmação independente. |
| 3 | **OpenWeatherMap (novo)** | Consulta por latitude/longitude de temperatura, sensação térmica calculada pelo provedor, umidade, vento, rajadas e chuva horária **quando existir**. É uma **estimativa agregada privada**, não uma nova estação oficial e não um aviso P0 autônomo; para tipos de produto diferentes usar endpoint e licença próprios. |
| 4 | **INMET** | Medições de estação e alertas oficiais; se uma dupla válida ainda não foi encontrada, conferir a estação e o produto correspondente. |
| 5 | **INPE/CPTEC** | Previsão e análise oficiais, comparação de divergências após fontes anteriores, com horário de rodada/validade e autorização de uso. |
| 6 | **NOAA** | Satélite, modelos, séries e oceanografia; conferir produto e região antes de comparar. |
| Complementar | **Windy** | Somente consulta de modelos com origem e licença, para comparação; não transforma modelo em medição. |

**Regra de parada:** duas fontes independentes, compatíveis, georreferenciadas e atuais da **mesma natureza** bastam. Se as duas primeiras discordam, consultar a terceira (OpenWeatherMap), mas nunca supor independência apenas por serem URLs distintas. Para cálculo de média observacional, só entram **medições efetivamente observadas** com evidência de fonte primária independente e pesos calibrados. Estimativa OpenWeatherMap pode ser apresentada **ao lado** de uma medição com rótulos distintos; sozinha não valida sensor nem sirene. Se não houver convergência, avançar às próximas fontes e divulgar as leituras reais com hora/discordância; não produzir número fictício.

**Exceção de competência:** para mar, rios, sismos, tsunami, qualidade do ar, trânsito e risco geológico, prevalecem as autoridades/redes especializadas indicadas abaixo. O terceiro lugar do OpenWeatherMap refere-se à **consulta meteorológica municipal compatível**, não o coloca como autoridade para tsunami, vazão, terremoto, ressaca ou interdições.

## Matriz completa — 25 fenômenos
| Nº | Fenômeno | Prioridade e terceira consulta | Desempate, cálculo ou ressalva |
| ---: | --- | --- | --- |
| 1 | **Temperatura do ar** | Alerta Rio (Rio) → Defesa Civil RJ → **OpenWeatherMap**; depois INMET / INPE / NOAA | °C, ponto geográfico e horário comparáveis; médias ponderadas apenas com observações independentes. |
| 2 | **Sensação térmica** | Alerta Rio (entradas locais quando houver) → Defesa Civil → **OpenWeatherMap**; INMET / INPE / NOAA | Usar T, UR e vento com domínio físico válido; `feels_like` do provedor é valor derivado, não termômetro. |
| 3 | **Chuva atual e acumulada** | Alerta Rio (Rio) → Defesa Civil → **OpenWeatherMap** (`rain.1h` quando houver); INMET / CEMADEN / INPE / NOAA | Mesma janela 5, 10, 15, 30, 60 min ou 24 h. Não comparar 1 h contra 24 h; não fabricar ausência de chuva de campo ausente. |
| 4 | **Previsão de chuva** | Produtos Alerta Rio / Defesa Civil quando disponibilizados → **OpenWeatherMap forecast** conforme plano; INPE / INMET / NOAA | Previsão e medição jamais misturadas na mesma média; probabilidades só com produtos que as forneçam. |
| 5 | **Temporais e tempestades** | Alerta Rio → Defesa Civil → **OpenWeatherMap contexto**; INMET (avisos), CEMADEN, INPE, NOAA | Intensidade e risco se baseiam em aviso/medição competente, não em média de códigos de tempo ou categoria de alerta. |
| 6 | **Vento sustentado e direção** | Alerta Rio (Rio) → Defesa Civil → **OpenWeatherMap**; INMET / INPE / NOAA | m/s → km/h quando necessário; direção circular tratada por vetores, não média aritmética de graus. |
| 7 | **Rajadas de vento** | Alerta Rio → Defesa Civil → **OpenWeatherMap** (`wind.gust` se presente); INMET / INPE / NOAA | Pico, intervalo de amostragem e local corretos; rajada não equivale a vento médio. |
| 8 | **Pressão atmosférica** | INMET (estações) e outras estações oficiais locais; **OpenWeatherMap** complementar | hPa e mesmo nível de referência (superfície ou nível do mar); diferença não significa erro sem considerar altitude. |
| 9 | **Umidade relativa** | Alerta Rio quando observada → Defesa Civil / INMET → **OpenWeatherMap**; INPE / NOAA | % no mesmo período/local; manter ponto de orvalho calculado identificado separadamente. |
| 10 | **Granizo** | Defesa Civil / Alerta Rio / INMET (avisos) e radar oficial; **OpenWeatherMap** somente contexto de tempo, se produto apropriado | Confirmar ocorrência por radar calibrado, registros oficiais ou autoridade; sem afirmar granizo pela condição genérica “tempestade”. |
| 11 | **Raios** | NOAA GOES/GLM e redes terrestres de descargas autorizadas | Cruzar sensores independentes e carimbo de tempo; OpenWeatherMap comum NÃO fornece contagem oficial de raios. |
| 12 | **Ciclones e tempestades extratropicais no Atlântico** | Marinha do Brasil / INMET; NOAA, INPE/CPTEC; Windy e OpenWeatherMap como contexto meteorológico quando o produto servir | Vetores, pressão, distância, rota e ETA com incerteza; avisos marítimos competentes prevalecem. |
| 13 | **Ondas altas e direção das ondas** | Marinha/CHM + boias oficiais/PNBOIA; NOAA e produtos oceânicos autorizados | Comparar altura significativa, período e direção; API Current Weather não é marégrafo nem boia de ondas. |
| 14 | **Ressacas** | Marinha/CHM e Defesa Civil costeira; boias, NOAA, INMET costeiro | Aviso de ressaca válido por trecho e hora; não inferir “sem risco” da ausência de dado. |
| 15 | **Marés e elevação do nível do mar** | Marinha/CHM e marégrafos oficiais; modelos hidrodinâmicos licenciados | Referência vertical/porto/local e fuso de Brasília declarados; não obter altura de maré por API comum de tempo. |
| 16 | **Temperatura da superfície do mar** | NOAA e boias oficiais; satélites e produtos oceânicos especializados autorizados | °C, profundidade e grade com hora; temperatura do ar no OpenWeatherMap não é temperatura do mar. |
| 17 | **Tsunami sísmico e meteorológico / maremoto** | NOAA/centros competentes + Marinha + autoridades brasileiras; USGS e marégrafos/DART conforme causa | Tsunami sísmico ≠ meteotsunami. Sem aviso oficial e evidência hidrodinâmica, não afirmar risco/ausência de risco. |
| 18 | **Nível e vazão dos rios** | ANA/HidroWeb + SGB/SACE + CEMADEN conforme estação | Cota em metros, vazão em m³/s; OpenWeatherMap só pode ajudar com **chuva contextual**, não medir rio. |
| 19 | **Cheias, enchentes e inundações** | Defesa Civil RJ + SGB/SACE + ANA + CEMADEN | Avisos oficiais e tendência de cota/chuva locais; discriminar cheia de alagamento urbano. |
| 20 | **Deslizamentos** | Defesa Civil + Geo-Rio (onde competente) + CEMADEN e redes geológicas municipais | Chuva antecedente, solo/encosta, geografia e avisos; previsão privada não substitui mapa oficial de risco. |
| 21 | **Abalos sísmicos** | USGS + redes sismológicas oficiais/centros regionais | Magnitude, profundidade, posição, horário, impacto RJ; confirmar sem alertar por mera especulação. |
| 22 | **Alagamentos e bolsões d’água** | COR.Rio / CET-Rio + Defesa Civil + Alerta Rio (somente cidade do Rio); órgãos municipais/PRF conforme local | Evento georreferenciado, horário, vias e trânsito; OpenWeatherMap pode comparar chuva, mas não confirma bolsão na via. |
| 23 | **Trânsito e interdições** | COR.Rio / CET-Rio / autoridades municipais e rodoviárias competentes / PRF | Só evento oficial; endereço, tipo e hora; não inferir acidente por previsão de tempestade. |
| 24 | **Calor extremo e radiação UV** | INMET + Alerta Rio/Defesa Civil conforme cobertura; Monitora RJ/SES-RJ para contexto de saúde; OpenWeatherMap UV somente produto com campo UV disponível e licença | Temperatura, sensação térmica e UV são variáveis distintas; alertas de saúde pertencem a autoridades competentes. |
| 25 | **Qualidade do ar** | MonitorAr-Rio/SMAC e redes oficiais municipais/estaduais; **OpenWeatherMap Air Pollution API**, se contratada/autorizada | PM2.5, PM10, O₃, NO₂, AQI com **escalas diferentes** identificadas; não misturar índice OpenWeather 1–5 com índice oficial local sem conversão validada. |

## Tabela de desempate e cálculo
| Situação | Ação Blaise Fusion + Vector RJ | Exibição |
| --- | --- | --- |
| Duas **medições oficiais independentes**, mesmas unidade, período e local, valores compatíveis | Parar busca; aplicar média ponderada apenas se os pesos de qualidade forem documentados. | Valor derivado + duas fontes, estação, horário, incerteza. |
| Alerta Rio e Defesa Civil divergem | Consultar **OpenWeatherMap em 3º**, com coordenadas, horário, tipo de produto e rastreabilidade. | Leitura oficial 1, leitura oficial 2, valor terceiro processado, sem assumir duas confirmações independentes. |
| OpenWeather aproxima-se de uma leitura, sem prova de origem independente | Usar como **referência de comparação**, não como desempate observacional definitivo; prosseguir ao INMET quando houver produto apto. | Medição oficial destacável apenas como referência, OpenWeather rotulado “estimativa agregada”. |
| Continua divergência após 3 fontes | Consultar **INMET (medição oficial)**; INPE/CPTEC e NOAA quando o produto de previsão/análise for apropriado. | Duas medições convergentes se existirem; senão apresentar valores válidos separados com fonte/hora e discrepância. |
| INPE/NOAA/Windy e OpenWeather são derivados do mesmo modelo/sensor upstream | **Não contar como fontes independentes**; deduplicar pela origem/modelo e versão. | Apenas a evidência efetivamente distinta. |
| Duas **previsões** comparáveis, modelos independentes e pesos historicamente calibrados | Previsão média ponderada **somente entre modelos** (não com termômetros). | “Estimativa de previsão Blaise”, validade, modelo e grau de incerteza. |
| Chuva em janelas diferentes, vento médio × rajada, pressão em altitudes diferentes, sensação térmica × temperatura | **Não calcular média misturando grandezas**; alinhar unidade/método quando fisicamente justificável. | Leituras separadas, sem falsa convergência. |
| Temporal, granizo, raios, enchente, ciclone, tsunami, sismo ou interdição | Não fazer média de níveis de alerta; usar autoridades competentes e verificação independente do mesmo evento. | Aviso emitido pela fonte, validade, região; Blaise complementa apenas sem inventar. |
| Nenhum dado válido/compatível depois das tentativas | Repetir conforme janela permitida, preservar última medição **com hora verdadeira** quando ainda válida; não fabricar zero, “céu limpo” ou “sem alertas”. | Estado de verificação e fontes tentadas, sem número sintético. |

## API OpenWeatherMap — segurança e integração
- **Nunca colocar usuário, senha, API key ou URL contendo `appid` verdadeiro no GitHub, APK, log ou mensagens.** A senha e chave já compartilhadas devem ser **revogadas e substituídas no portal** antes de uso real.
- Chave **somente no backend** (segredo gerenciado, por exemplo Secret Manager), com acesso mínimo; o adaptador `backend/src/openweather-rj-source.mjs` é **desligado por padrão** e não prova que a API já está conectada, licenciada ou alimentando o painel.
- [Current Weather](https://openweathermap.org/api/current) fornece `temp`, `feels_like`, `humidity`, `pressure`, `wind.speed`, `wind.gust`, `rain.1h` quando presentes. Consultar por lat/lon; fixar `units=metric`, converter m/s para km/h apenas na apresentação.
- Previsões horárias, UV e avisos podem requerer [One Call](https://openweathermap.org/api/one-call-3) e contratação adequada; [Air Pollution](https://openweathermap.org/api/air-pollution) é API distinta. Não afirmar que uma chave de Current Weather habilita todos os produtos.
- Os [termos de licença e atribuição](https://openweathermap.org/faq) exigem verificação do plano; em planos comuns são requeridos texto atribuindo OpenWeather, link e logotipo, podendo haver obrigações de compartilhamento pela licença. Confirmar adequação a aplicativo com assinaturas antes de ativar distribuição de dados.
- Consultas devem usar limites da assinatura, cache legítimo, proteção de cota, origem/horário em todos os resultados. O mapa próprio do Blaise não utiliza imagens de radar ou tiles de terceiros.

**Estado:** especificação e documentação em PR de revisão; nenhuma compra, login em conta do usuário, download de APK ou integração de API com a chave divulgada foi executada.
