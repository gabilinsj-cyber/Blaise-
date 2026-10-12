# Blaise V6 RJ — integração operacional e licença por produto

**Escopo:** 92 municípios fluminenses e Atlântico próximo com impactos possíveis no RJ. INEA permanece excluído. **Estado desta PR: desenvolvimento e testes, não publicação.**

## Tabela 1 — 10 fenômenos meteorológicos

Alerta Rio e Defesa Civil são P1 conjunta **apenas quando ambos cobrem o município e produto**. O Alerta Rio municipal não passa a representar outros 91 municípios. INMET fornece observações com estação e hora. O OpenWeatherMap é consulta complementar de terceiros — não autoridade emissora de alertas e não medição independente de estação já republicada.

| Variável | Produto OWM inicialmente suportado pela API Current | Limitação |
|---|---|---|
| Temperatura | `main.temp` | Produto multiorigem; indicar coordenada e hora |
| Sensação térmica | `main.feels_like` | Estimativa do produto, não sensor |
| Chuva atual | `rain["1h"]` quando presente | Referente à janela de 1h, não intensidade instantânea |
| Chuva acumulada | `rain["1h"]` quando presente | Apenas 1h, nunca inferir 24h/15min |
| Chuva intensa/temporais | Não resolvido pela API Current sozinha | Aviso oficial e produto especializado obrigatórios |
| Vento sustentado | `wind.speed` convertido m/s para km/h | Não presumir rajada igual ao vento médio |
| Rajadas | `wind.gust` quando presente | Não inventar se omitida |
| Pressão | `main.pressure` hPa | Não misturar tipos de pressão |
| Umidade relativa | `main.humidity` % | Medição vs análise do modelo identificada |
| Granizo | Não resolvido pela API Current sozinha | Não deduzir granizo de ícone/chuva |

### Conector real (mas desabilitado até credenciais aprovadas)

Módulo: `backend/src/rj-openweather-live-adapter.mjs`.

- Faz **HTTPS real**, geocodificação da cidade no estado do RJ e Current Weather por latitude/longitude, com host permitido, timeout, validação do corpo, idade do produto, município e unidades. Suporta consulta sob demanda nos 92 códigos IBGE de RJ **somente quando o geocodificador retorna uma correspondência verificável**. Não promete estação nem campo atual em toda cidade.
- Cache geocodificação 24h e Weather 5min para respeitar planos e não fazer 92 × consultas a cada 30 segundos. Não salvar o resultado como medição oficial municipal ou temporal de risco.
- Configuração **servidor apenas**, por Cloud Run Secret Manager/IAM, não no APK e não em texto público:
  - `BLAISE_OWM_ENABLED=true`
  - `BLAISE_OWM_PRODUCT_RIGHTS_VERIFIED=true` **apenas após validação documental dos termos/licença do produto e do plano contratado**
  - `BLAISE_OWM_API_KEY` **via segredo** (não colar em GitHub/chat/Android)
- Endpoint interno: `GET /v1/internal/rj-sources/openweather-current?ibge=3304557&phenomenon=TEMPERATURA`. Somente autorizado com Google OIDC do operador; nunca usado sem identidade. Não expõe chave e não fornece redistribuição pública. Requer papel IAM adequado e auditoria de acesso. Produto de teste ao vivo deve informar validade do dado retornado, não só HTTP 200.
- Endpoint de auditoria `/v1/internal/rj-sources/readiness`: `homologationRegister.openWeatherMapLiveProof` só é `true` após uma resposta válida e recente do conector, com comprovante de hora; ainda não demonstra 92 municípios nem operação contínua. Sem chave/licença **não é ativo**.

**Para chegar à interface Android com dados reais:** após confirmar termos de uso e orçamento da API, criar/proteger endpoint por **conta de usuário** e quotas e passar o produto validado pelo backend ao painel municipal. O endpoint interno acima não deve ser chamado diretamente pelo APK. Nenhuma mudança desta PR afirma que esse caminho de distribuição já está implantado.

## Complemento marítimo — Marinha, NOAA, Copernicus Marine, EUMETSAT

| Fenômeno | Fontes por especialidade | Estado técnico |
|---|---|---|
| Ciclones oceânicos | Marinha/INMET + NOAA + EUMETSAT + Copernicus Marine por produto | Matriz/visualização previstas; ingestão de grade e animação pendente |
| Tempestades no Atlântico | Marinha + NOAA + EUMETSAT | Nuvem/satélite ≠ alerta marítimo; ingestão de produto pendente |
| Ondas e swell | Marinha/CHM + NOAA + Copernicus Marine | Altura/período/direção de produto geográfico ainda sem pipeline completo |
| Ressaca | Avisos Marinha + boias autorizadas + Copernicus + NOAA | Modelo pode complementar, aviso oficial prevalece |
| Tsunami/maremoto | NOAA + Marinha + autoridades brasileiras | Aviso competente obrigatório; não deduzir de fotos/ondulação |

**Copernicus Marine:** selecionar primeiro o dataset e variável existentes para mar do RJ, conta do Marine Data Store e permissões/atribuição por produto. A ferramenta oficial `copernicusmarine subset` opera sobre áreas e janelas especificadas e retorna NetCDF, CSV ou outros produtos conforme dataset. Os arquivos precisam de parser/normalização validada de grade georreferenciada; **não** usar NetCDF pesado no celular, pré-processar no servidor e enviar só a camada necessária. Dados de temperatura da água não são do mesmo tipo que temperatura do ar.

**EUMETSAT:** selecionar imagem/campo/coleção satelital e coberturas reais do Atlântico; configurar conta, licença específica para produtos near real time e autenticador EUMDAC/Data Store no backend. A visão pública de EUMETView não equivale automaticamente a licença para consumir e redistribuir todo produto em app pago. Imagens e campos de nuvens não emitem aviso de tsunami.

Referências oficiais:
- https://openweathermap.org/api/current
- https://help.marine.copernicus.eu/en/articles/7949409-copernicus-marine-toolbox-introduction
- https://toolbox-docs.marine.copernicus.eu/en/stable/command-line-interface.html
- https://user.eumetsat.int/resources/user-guides/frequently-asked-questions-for-data-store
- https://data.eumetsat.int/

## Cinco controles de desempate e rastreabilidade

A Tabela 2 da interface inclui agora cinco **checagens adicionais em ordem**: **INPE/CPTEC**, **INMET**, **OpenWeatherMap**, **Windy** e **fontes especializadas marítimas (Marinha/NOAA/Copernicus/EUMETSAT)**.

Essas checagens **não substituem** a hierarquia de obtenção de observações oficiais (Alerta Rio quando cobre a cidade do Rio; Defesa Civil; INMET e especialistas) nem a ordem INPE → Windy do desempate meteorológico. Uma previsão e uma medição **não** entram numa média observacional; dados republicados não são automaticamente fontes independentes; sem acordo apropriado exibir duas leituras identificadas. Não calcular média de alertas, tsunamis ou categorias de risco. `backend/src/rj-five-tiebreak-checks.mjs` e `RjMeteorologicalTables.fiveDisputeChecks` expõem a matriz.

**Gates antes de alegar “funcionando em tempo real”:**
1. Termos/licença comercial e credenciais válidas, separadas por produto.
2. Operador confirma resposta original válida, coordenada/hora/atribuição e quota.
3. Worker/poller contínuo com evidência de cache fresco/monitoramento de falhas (não confundir com mera chamada sob demanda).
4. Contrato assinado/autenticado de entrega Android e visual sem dados inventados.
5. CI, testes físicos de voz e assinaturas e rollout seguro. Sem estes itens, manter “em integração”.

Não copiar imagens meteorológicas de terceiros no mapa próprio do Blaise. Dados de grade espacial georreferenciados autorizados serão convertidos em camadas originais do aplicativo.
