# Blaise V6 RJ — avaliação dos serviços de download MET Norway (17/11/2026)

**Origem:** lista de portais fornecida pelo usuário; conferência com documentação oficial MET Norway, EUMETSAT OSI SAF. Este documento é um **inventário administrativo, não implantação, telemetria ou confirmação de valores reais**.

## Decisão por serviço

| Portal fornecido | Produtos/escopo | Aplicabilidade ao RJ | Integração |
|---|---|---|---|
| https://api.met.no/ | Diversos serviços MET Norway; *Locationforecast 2.0* fornece previsão global do ECMWF/IFS e UV de céu limpo do CAMS | **SIM, previsão global** de até aproximadamente 9 dias; sens. térmica `apparent_air_temperature` é estimativa, nunca termômetro observado | **Candidato aprovado**, já existe coletor opcional desligado em `rj-met-norway-locationforecast.mjs` |
| https://frost.met.no/ | Observações históricas, metadados e séries por estação; exige cadastro/client ID | **Não comprovado para sensores nos 92 municípios**; acervo de estações do MET norueguês não equivale a estações brasileiras | **Não alimentar municípios RJ**; pesquisa administrativa |
| https://thredds.met.no/ | NetCDF, OPeNDAP e modelos operados pelo MET | Global ECMWF **não disponibilizado para download nesse serviço** por licença; catálogo focado em modelos/metadados regionais | **Não usar como fornecedor ECMWF global**; avaliar produtos individualmente |
| https://seklima.met.no/ | Observações e estatísticas meteorológicas/climáticas norueguesas | Sem evidência de estação brasileira diretamente utilizável | Pesquisa; não ingestão RJ |
| https://adc.met.no/ | Dados de pesquisa polar | Fora do RJ, salvo produto com extensão geográfica/licença comprovadas | Fora da matriz municipal |
| https://osisaf.met.no/ e https://osi-saf.eumetsat.int/ | OSI SAF inclui **SST global** e **GOES-East SST OSI-207-c** | **SIM para SST costeira/oceânica** pelo produto OSI-207-c: área 60°N–60°S, 135°W–15°W, grade ~0,05°, 24 produtos/dia (nominal). Também existe OSI-201-b global | **Novo candidato prioritário EUMETSAT**, sem coletor ativo. Validar arquivo, cobertura efetiva, máscara/qualidade, tempo, licença CC BY 4.0, attribution e proveniência única. Não contar GOES como observação independente duplicada |
| https://www.nersc.no/project/nordatanet | Rede/projeto de dados científicos | Sem produto operacional RJ/endpoint homologado | Pesquisa |
| https://cryo.met.no/ | Neve, gelo marinho, permafrost | Não aplicável à previsão municipal RJ sem produto específico | Fora da matriz |
| https://satellittdata.no/ | Segmento terrestre de dados Copernicus Sentinel | **Bloqueado pela exclusão vigente de coleta direta Copernicus** | Não habilitar. Exceção aprovada é apenas CAMS UV de céu limpo via Locationforecast |
| https://om.yr.no/ e https://developer.yr.no/ | Portal Yr de previsão em colaboração com NRK | O dado autorizado vem da API MET, não de capturas/raspagem do site | Creditar MET Norway/ECMWF/CAMS conforme produto. **Não utilizar a marca, mapas, logotipos ou interface Yr sem autorização** |
| https://klimaservicesenter.no/ | Dados climáticos regionais noruegueses | Sem prova de cobertura de municípios RJ | Pesquisa |
| https://seklima.met.no/observations/ | Observações/estatística do acervo norueguês | Sem sensores RJ comprovados | Pesquisa |

## Contratos e natureza (O/E/P)

- **MET Locationforecast global:** modelo ECMWF/IFS = **P (previsão)**; `apparent_air_temperature` = **E (sensação térmica calculada)**. Não equivale a observação de estação nem conta como uma quarta fonte independente do ECMWF direto.
- **MET/CAMS:** `ultraviolet_index_clear_sky` = **P**, UV para céu limpo, não UV observado, tampouco índice efetivo ajustado pelas nuvens. **Exceção Copernicus limitada a esse produto via MET**.
- **OSI SAF SST:** produto derivado de satélite, a registrar explicitamente como recuperação/estimativa de SST com a qualidade do produto e hora de aquisição; nunca inventar termômetro oceânico ou alerta oficial. Conta como produto **EUMETSAT**, não como nova instituição norueguesa. Verificar se já há o mesmo sensor entre produtos NOAA para evitar duplicidade.
- Os demais portais são catálogos/arquivos, **não** fontes independentes para a temperatura do Rio por si só.

## Restrições operacionais obrigatórias

1. Operador humano deve ler, compreender e aceitar Termos MET atualizados (05/11/2026); o agente de IA não dá aceite por ele.
2. O app Android não faz chamadas diretas. Backend com User-Agent único, identificação e contato reais, HTTPS e cache compartilhado transacional.
3. Brasil = intervalo **mínimo de 3 horas** entre solicitações Locationforecast idênticas, **ou Expires posterior**. Modelo global atualizado em escala de horas, não a cada 12 minutos.
4. Reutilizar `Last-Modified`/`If-Modified-Since` nos termos oficiais; não disparar rajadas em horários exatos.
5. Acesso, distribuição, atribuição e limites devem ser verificados **por produto**; acesso gratuito ao portal não libera automaticamente toda a base para reprodução comercial.
6. Restringir os 92 municípios a coordenadas IBGE e altitudes georreferenciadas; só Rio e Niterói possuem pontos já cadastrados no coletor opcional atual.
7. Não produzir valores, alertas, classificação 1–5, gráficos ou mapa sem registro backend realmente adquirido, validade, geografia, natureza e licença.
8. Não ativar Cloud Run/Android, consultar usuários, gerar novas chaves, fazer scraping ou alterar produção apenas por cadastrar serviços.
9. Manter INMET/CEMADEN como comparação interna meteorológica. Links oficiais de Alerta Rio, Defesa Civil RJ, INMET e INPE/CPTEC são **encaminhamento**, não coleta de observação ou prova automática de alerta ativo.
10. Preservar INEA, Marinha e Windy excluídos. Copernicus direto continua excluído; somente CAMS UV por MET é exceção expressa.

## Próximas verificações, em ordem

A. Homologar Termos MET e 90 coordenadas/altitudes restantes com fonte oficial de geometria; executar coletor **em ambiente isolado** e medir diferenças reais por cidade/ciclo, sem reconsultas indevidas.

B. Criar adaptador SST **OSI-207-c** via EUMETSAT após verificar acesso HTTPS/NetCDF, grade cobre costa do RJ, QA/QC, hora efetiva, licença e crédito. Se a imagem/sensor estiver repetida em NOAA, deduplicar.

C. Vincular previsões ECMWF via MET ao contrato de cobertura **como ECMWF/IFS**, e UV CAMS como campo separado; não misturar com sensores/observação; usar sensação fornecida pela API antes de cálculo redundante.

D. Integrar à interface somente após testes instrumentados, métricas, custo/escala e autorização de release.

## Referências oficiais consultadas

- Lista de serviços MET: https://www.met.no/en/free-meteorological-data/Download-services
- Locationforecast: https://api.met.no/weatherapi/locationforecast/2.0/documentation
- Modelo global ECMWF/CAMS: https://docs.api.met.no/doc/locationforecast/datamodel.html
- Termos MET: https://docs.api.met.no/doc/TermsOfService.html
- Revisão de 05/11/2026: https://docs.api.met.no/2026/11/05/service-distruptions-revised-tos.html
- Frost: https://frost.met.no/howto.html
- THREDDS: https://api.met.no/product/THREDDS
- Marca Yr: https://docs.api.met.no/doc/ClientLibraries.html
- OSI SAF SST: https://osi-saf.eumetsat.int/products/sea-surface-temperature-products
- OSI SAF acesso: https://osi-saf.eumetsat.int/about/access-data
