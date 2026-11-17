# Blaise V6 RJ — JAXA GSMaP v9: cadastro, acesso e homologação
**17/11/2026 — documentação operacional na PR #157, sem ativação de produção.**

## Cadastro e segurança
- A pessoa responsável enviou captura do e-mail oficial **"GSMaP User Registration for DATA(Complete)"** confirmando a inscrição **JAXA Global Rainfall Watch**.
- O e-mail continha credenciais do FTP. **Nenhuma senha, nome, e-mail privado nem token foi copiado para o repositório, código, CI ou logs**. Não pedir que se digite senha no chat. Qualquer credencial deve ficar em segredo de CI ou no gestor de segredos do servidor, não em APK/Play Store.
- O cadastro de Rainfall Watch **não significa** liberação automática do sistema G-Portal, de redistribuição de arquivos originais, de todos os produtos ou de coleta numérica já concluída.
- O usuário informou antes que a divulgação da senha não seria problema, mas a implementação técnica conserva sigilo e tenta TLS verificado para proteger o transporte. Sem consentimento adicional não habilita downgrade automático para FTP plano.

## Produto efetivo e idade dos dados
- O FTP Rainfall Watch oferece GSMaP_NRT com **algoritmo v9** desde outubro de 2026, em `/realtime_ver/v9/latest/` para últimas 24h e `/realtime_ver/v9/hourly/YYYY/MM/DD/` para arquivo histórico.
- **Não confundir** "versão do produto V06" da G-Portal com **versão do algoritmo v9** do Rainfall Watch. v7 parou de ser atualizado em 2026; não usar dados antigos como atuais.
- Dados GSMaP_NRT estimam chuva horária (natureza **E**, não O), grade global 0,1° com 3600 colunas e 1200 linhas, pixel inicial centro em **0,05° E / 59,95° N**, unidade **mm/h**, arquivo gzip little-endian 32 bits. Valores negativos como -4, -8 e -99 representam ausência/sem recuperação, **NUNCA chuva zero**.
- Latência nominal documentada para NRT: **4 horas após observação**, logo esse produto não pode ser anunciado como chuva observada "agora". A interface deve mostrar horário da estimativa, coleta e estado de atraso. Se a atualização estiver suspensa pelo fornecedor, mostrar INDISPONÍVEL.
- A distribuição também possui NetCDF com informação de flags para algoritmo v9 em `/realtime_ver/v9/netcdf/Hourly/YYYY/MM/DD/`, nome geral `GPMMRG_MAP_YYMMDDHHNN_H_L3R_MFW_VVV.nc` (consultar manual antes de parsear variável específica).

## Teste 1 de rede (executado em GitHub Actions, sem senha)
- Script: `backend/scripts/probe-jaxa-gsmap-staging.py`
- CI: https://github.com/gabilinsj-cyber/Blaise-/actions/runs/44145045115
- Testes de segurança offline: **5 aprovados**.
- Tentativa real de AUTH TLS a `hokusai.eorc.jaxa.jp`: `FTPS_UNSUPPORTED_OR_UNREACHABLE`. Esta saída **não distingue** protocolo FTP sem TLS de firewall ou falta de acesso TCP do GitHub runner. **Não foi feita autenticação nem listado ou baixado qualquer arquivo**.
- Decisão: não tentar FTP em texto simples automaticamente, não enviar credenciais por GitHub Actions sem segurança comprovada. Próximo diagnóstico precisa identificar se o serviço e a rede suportam FTPS ou se um operador deverá obter um único arquivo no cliente FTP adequado.

## Validação numérica local pronta (NÃO homologada com arquivo real)
- `backend/scripts/validate-jaxa-gsmap-v9-file.py --file <arquivo-real-gsmap_nrt.YYYYMMDD.HH00.dat.gz>`
- Exige tamanho descompactado exato de **17.280.000 bytes** (3600 x 1200 x 4), fim de validade razoável, nome com UTC válido, SHA-256 e grade geográfica correta.
- Converte coordenadas dos **92 municípios IBGE verificados** em células da grade, separando taxas `mm/h` válidas de valores negativos/ausentes. **Ponto municipal é referência geográfica, não chuva medida em estação local**.
- Testes em `backend/test/test_jaxa_gsmap_v9_binary.py` usam **arquivo totalmente sintético**, com marcação inequívoca; a aprovação desses testes NÃO comprova valor JAXA de 2026. Sem flags de qualidade, o relatório informa `qualityFlagsVerified=false` e `publishedToAndroid=false` mesmo havendo valores numéricos.
- Para homologação comercial será necessário cruzar flags de satélite/tempo/confiabilidade, autorização de uso e metadados do arquivo. Nunca tratar chuva NRT estimada como alerta oficial.

## Permissão comercial
- JAXA FAQ Q14: https://sharaku.eorc.jaxa.jp/GSMaP/faq/GSMaP_faq14.html indica uso comercial com atribuição à JAXA e solicitação de informação ao escritório.
- JAXA FAQ Q16: https://sharaku.eorc.jaxa.jp/GSMaP/faq/GSMaP_faq16.html distingue resultados próprios processados de **redistribuição de arquivos originais**, que pede contato/procedimento.
- A categoria mostrada no cadastro enviado anteriormente era "Pesquisar", enquanto o Blaise V6 RJ é aplicativo pago. O operador deve comunicar a finalidade real à JAXA antes de disponibilizar dados para assinantes. Não inventar autorização comercial nem redistribuir o NetCDF/GRIB/dados originais sem permissão adequada.
- Créditos sugeridos: **"Dados de estimativa de chuva GSMaP por JAXA Global Rainfall Watch / JAXA EORC"** junto ao campo, com data/fonte e outras condições pertinentes.

## Próxima ação controlada
1. Se o administrador do projeto autorizar, cadastrar **JAXA_GSMAP_FTP_USERNAME** e **JAXA_GSMAP_FTP_PASSWORD** como *Repository secrets* no GitHub da aplicação para workflow manual; nunca no git ou no aplicativo.
2. Em **GitHub Actions**, executar manualmente o workflow `RJ JAXA GSMaP v9 Staging Access` na branch da PR #157. O script tenta FTPS com verificação de certificado. Se não houver TLS, encerra sem enviar credenciais.
3. Caso a rede não ofereça FTPS, solicitar orientação ao escritório GSMaP para transporte cifrado, ou obter o **arquivo de teste em aparelho administrado** por meio de cliente FTP, guardando-o localmente e entregando-o para análise offline, sem colar a senha em mensagens.
4. Se obtiver um arquivo real, rodar o validador offline e depois adicionar leitura das flags/QA. Comprovar direito de uso, latência, produto, crédito; somente então habilitar a coleta isolada.
5. Só depois de observar dados atuais em staging e CI aprovado, projetar os valores aprovados para a interface de clientes, sem afirmar tempo real instantâneo, sem cópia de mapa externo e sem alteração prematura de produção.

## Fontes oficiais
- JAXA diretórios por versão: https://sharaku.eorc.jaxa.jp/GSMaP/faq/GSMaP_faq01.html
- JAXA manual PDF v9 (19/10/2026): https://sharaku.eorc.jaxa.jp/GSMaP/document/new/DataFormatDescription_NRT9.pdf
- JAXA FAQ acesso FTP em clientes apropriados: https://sharaku.eorc.jaxa.jp/GSMaP/faq/GSMaP_faq22.html
- JAXA direitos de uso: https://earth.jaxa.jp/policy/en.html
