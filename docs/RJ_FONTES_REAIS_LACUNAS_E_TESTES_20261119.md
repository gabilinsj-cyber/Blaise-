# Blaise V6 RJ — testes reais e lacunas (19/11/2026)

**Escopo:** PR #173 em **draft**, nenhum merge/deploy/tráfego/assinatura. Resultados desta revisão são *evidências pontuais* do GitHub Actions em ambiente isolado, **não valores vivos dos 92 municípios no app**. Dados e referências de fonte não constituem cobertura contínua nem homologação para assinantes.

## Evidências de testes hoje — fonte real, sem credenciais pagas

Os workflows abaixo foram acionados por mudanças isoladas no arquivo de workflow, com concorrência por branch para evitar duplicações. Logs e evidências pertencem ao GitHub Actions e não devem ser tratados como produção.

| Produto e CI | Evidência às 13:49–13:50 UTC (10:49–10:50 BRT) | Conclusão restrita |
|---|---|---|
| `NOAA GOES-19 GLM-L2-LCFA` (run 44537291171) | `VALIDATED_ONE_FILE`, aquisição de um arquivo NOAA real às 13:49:00Z; **117 flashes válidos no arquivo e zero no retângulo estadual desse arquivo específico** | Satélite e decodificador funcionaram. Zero nessa cena NÃO prova ausência de raios nos 92 municípios ou em outro momento; sem alerta |
| `NOAA CoastWatch GOES-19 ACSPO L3C` (run 44537291353) | `UNAVAILABLE`, `NOAA_COASTWATCH_RECENT_L3C_FILE_MISSING` na rota pesquisada. Auditoria `NOAA_ACSPO_NOT_AUTHORIZED` | **Sem temperatura do mar atual**; CI verde significa apenas que a falha foi tratada corretamente e um arquivo de evidência foi salvo |
| `NOAA GFS-Wave` (run 44537290597) | `FULL`, auditoria `FULL`, **3/3 pontos offshore com altura** e **3/3 pontos com período de swell**, ciclo emitido 06:00Z, previsão válida 13:00Z | **Previsão P**, não boia física nem 92 cidades; passou em ambiente de staging, não publicada |
| `DWD ICON Global` (run 44537290467) | Resultado aguardando encerramento em 19/11 durante a redação | Validar valores e peso CDO, modelo, horários e municípios pelo artefato, sem supor sucesso |
| `Android CI` (run 44537290894) | Em execução durante a redação | Compile e testes ainda necessários para validar as alterações de desenvolvimento |

## O que está integrado tecnicamente e o que falta para funcionar

| Componente | Código | Teste real atual | API/app de clientes em produção |
|---|---|---|---|
| Meteoblue Free `basic-6h` | Sim, coletor privado, cache e ledger; valor 7/7 real em 19/11 | SIM, 1 ponto Rio/29 slots/4000 créditos reservados | **NÃO**. O limite de segurança da chave exposta impede novas consultas na campanha |
| NOAA GOES GLM | Leitor de arquivo e validador | SIM, um arquivo real | **NÃO**, sem monitoramento contínuo/cobertura municipal |
| NOAA GFS-Wave | Leitor e ponte de auditoria | SIM, três pontos offshore | Endpoint do dashboard existe, mas **não comprova** revisão ativa, tráfego e frescor atual |
| NOAA CoastWatch SST | Leitor/validador | Tentativa real, **indisponível** | NÃO |
| DWD ICON | Coletor/previsão 92 e auditoria | Teste real em andamento | NÃO comprovado |
| ECMWF/IFS / MET Norway | Módulo de cache optional, com ToS/UA/Firestore obrigatórios | Nenhuma nova medição validada nesta rodada | NÃO comprovado |
| OpenWeather/Agente13 | Adaptador com cota e Secret Manager | Offline/testes; nenhuma nova chamada paga | NÃO ativado nesta rodada |
| HG Brasil Pro | Política de licença/contrato | Não contratado | NÃO |
| ANA/SGB | Registro de responsabilidade hidrológica | Sem amostra numérica real validada para RJ | NÃO |

## Lacunas prioritárias e fontes pesquisadas

1. **Chuva atual/chuva acumulada por pluviômetro (O)**: nenhuma estação elegível está homologada por município; meteorologia pública de INMET/CEMADEN segue apenas para comparação administrativa; Alerta Rio/Defesa Civil RJ apenas links. **ANA HidroWeb / RHN** registra chuvas, níveis e vazões, mas o acesso automatizado atual exige **pedido formal à ANA**, e a rede precisa de auditoria de estações, tempos, licença de reexibição e cobertura. Oficial: <https://www.snirh.gov.br/hidroweb/acesso-api> e <https://www.snirh.gov.br/hidroweb/>.
2. **Chuva estimada por satélite em terra e oceano (E, não O)**: estudar **NOAA GOES-19 Enterprise Rainfall Rate / SCaMPR** e produtos atuais NOAA/NESDIS. O legado `ABI-L2-RRQPEF` está sujeito a processo de **retirada** anunciado em 2026: não construir dependência nova neste pacote sem validação de status/cadência/licença/qualidade. Oficial: <https://www.nesdis.noaa.gov/news/retirement-of-goes-r-rainfall-ratequantitative-precipitation-estimation-grrqpe> e <https://www.ospo.noaa.gov/products/atmosphere/precipitation.html>. Não inferir milímetros acumulados de taxa mm/h sem janela física e metadados.
3. **SST oceânica (E)**: investigar listagem alternativa do NOAA ACSPO G19 em <https://coastwatch.noaa.gov/cwn/products/acspo-global-sst-abi.html>; como alternativa diária (não minuto a minuto), avaliar **NOAA Coral Reef Watch CoralTemp** global 5km, <https://coralreefwatch.noaa.gov/product/5km/>. É estimativa satelital diária, **não** boia, não copiar mapa de terceiro. Conferir origem de dados/atribuição.
4. **Rios/cheias por estações (O)**: **ANA HidroWeb** (acesso API mediante solicitação) e **SGB/SACE**, <https://sace.sgb.gov.br/>, com cobertura condicionada por bacia. Não transformar boletim de alerta em cota de rio nem projetar medição pontual para 92 cidades.
5. **Temperatura, sensação térmica e vento de superfície**: HG Brasil somente após contrato; OpenWeather só com plano/cotas/licença; DWD/ICON é **P**, não estação. Modelos ECMWF/IFS Open Data, NOAA GFS e MET Norway podem cobrir **previsões** de vários fenômenos, mas não preenchem O. Dados MET dependem aceite humano dos Termos 05/11/2026 e `User-Agent`; <https://docs.api.met.no/doc/TermsOfService>. Dados abertos ECMWF podem ser usados com atribuição adequada em produtos compatíveis, mas precisam de novos conectores e verificação de termos: <https://confluence.ecmwf.int/spaces/DAC/pages/272310539/ECMWF+open+data+real-time+forecasts+from+IFS+and+AIFS>.
6. **Rajadas O, granizo O, visibilidade O, alagamento/rua**: ainda sem sensores licitamente publicados e geolocalizados para 92 municípios. NOAA GLM são flashes satelitais, **não** granizo nem rajadas. Alertas oficiais continuam sendo links, nunca alertas inventados.
7. **Maré/correntes/ressaca**: NOAA GFS-Wave fornece ondas e swell P, mas **não** maré astronômica nem corrente de superfície; requer produto/validação específicos e termos. Não reintroduzir Marinha, EUMETSAT ou Copernicus direto.

## Checklist operacional para os próximos testes

- Validar resultado do DWD 92/92, modelo e pesos CDO, e o Android CI.
- Verificar se NOAA SST falhou por caminho/listagem ou ausência do produto; não aceitar amostra velha só para mostrar número.
- Integrar novos dados no servidor como **snapshot com timestamp de emissão, validade, coleta, fonte, licença, natureza O/E/P e município/célula**; descartar ausentes/desatualizados.
- Comparar somente campos físicos equivalentes, sem triplicar o mesmo modelo por revendedores.
- Segurança de credenciais e orçamento antes de habilitar qualquer provider pago; respeitar 92 municípios e proteção da infraestrutura.
- **NÃO** fazer chamada meteoblue adicional: sua chave foi exposta e o coletor tem bloqueio de apenas uma prova privada por campanha.
- Aprovação explícita antes de implantação de novas revisões, alteração de tráfego, loja ou compras.
