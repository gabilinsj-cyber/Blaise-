# Blaise V6 RJ — EUMETSAT GOES-19 SST (OSI-207-c), 18/11/2026

## Escopo e licença
- OSI SAF GOES-19/ABI **OSI-207-c**: temperatura **subskin da superfície do mar**, recuperação satelital **E**, 0,05° e 24 imagens por dia, atraso de disseminação esperado de até 3 h.
- Fonte: https://osi-saf.eumetsat.int/products/osi-207-c
- Distribuição NRT HTTPS: https://osi-saf.ifremer.fr/sst/l3c/west_atlantic_east_pacific/
- Licença do produto: CC BY 4.0, permitindo usos comerciais com a devida atribuição: **EUMETSAT OSI SAF, OSI-207-c**. Registrar DOI quando disponível.
- Não usar como temperatura atmosférica, sensação térmica, termômetro de boia, temperatura prevista para município ou chuva oceânica.

## Prova científica — 3 pontos geográficos fixos
- Ilha Grande, alto-mar (-23.4, -44.5); Rio, alto-mar (-23.5, -43.25); Cabo Frio, alto-mar (-23.25, -42.0).
- Reaproveitar **um único arquivo NetCDF**, se realmente acessível.
- Verificar coordenadas NetCDF, distância para pixel <0,075°, unidade °C/K, máscara de preenchimento, nível `quality_level>=4`, tempo do produto (máx. 12 h neste staging), validade da versão e URL oficial; valores ausentes continuam `null`.
- A versão inicial suporta grade GHRSST L3C regular em eixos latitude/longitude unidimensionais. Outros eixos precisam de validação própria.
- `rj-osisaf-sst-admin-bridge.mjs` apenas transforma a evidência científica já validada em registros administrativos marítimos com fonte, hora e categoria E. Não envia ao aplicativo de clientes nem ao relatório municipal de temperatura do ar.
- A matriz administrativa usa fonte canônica `EUMETSAT_OSI_SAF_SST`; NOAA CoastWatch é alternativa correlacionada se depender do mesmo GOES-19, não uma segunda estação ou sensor independente.

## Problemas conhecidos de distribuição
- Em 11/11/2026 a OSI SAF emitiu aviso de arquivos SST ausentes, incluindo OSI-207-c: https://osi-saf.eumetsat.int/community/list-of-service-messages/missing-sea-surface-temperature-and-radiative-fluxes-products
- A página do centro de processamento pode mostrar dados sendo gerados mesmo quando a distribuição HTTPS/FTP está com problemas. **Não** assumir que o dado publicado existe só porque um produto está 'operational'.
- O workflow registra `UNAVAILABLE` com motivo quando não encontra NetCDF recente. Nunca reaproveitar dado antigo como leitura atual, nem declarar cobertura integral sem prova.
- Próximos passos se indisponível: investigar THREDDS oficial e outra distribuição de OSI SAF, observando autenticação, limites de acesso e direitos; NOAA CoastWatch GOES-East/ACSPO pode fornecer SST como contingência **E**, sujeito a QA e documentação do produto. Não recorrer a NASA/JAXA, removidas por instrução do proprietário.

## Implantação e segurança
- Sem solicitação comercial ou assinatura nova. Climatempo aguardando resposta; Meteomatics é opção posterior; HG Brasil adiada.
- Alterações em PR empilhada; nenhuma mescla, deploy ou agendador automático sem CI, confirmação de dados reais e validação da interface.
- Ficam preservadas as restrições de temperatura do ar: somente HG Brasil contratado, OpenWeather com quota, DWD ICON previsão; NOAA e Climatempo excluídas desses campos.
