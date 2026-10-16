# Blaise V6 RJ — entrega estadual, 08/10/2026

Escopo obrigatório: todos os 92 municípios canônicos do RJ, identificados por IBGE. Selecionar duas cidades na tela não limita o escopo de coleta ou de alertas ao par selecionado. Alerta Rio permanece municipal; fontes estaduais/nacionais são aplicadas somente onde sua cobertura estiver validada. INEA excluído das fontes ativas.

## Implementação desta revisão

Nova rota protegida `/v1/data/municipalities`, consumida pelo cliente Android e exibida na página Cidades. Mantém a verificação de compra existente e limites de concorrência/corpo. Não divulga token nem dados pessoais. Exige configuração real de `BLAISE_ENTITLEMENT_VERIFY_URL` e acesso verificado; essa configuração não foi fornecida nesta sessão.

- Projeção dos 92 municípios, sem duplicidade ou extrapolação geográfica.
- Risco hidrológico CEMADEN-RJ por código IBGE, fonte, região REDEC e horário. Depende de worker configurado e cache válido. Não substitui risco hidrológico por temperatura, precipitação ou alerta de outro produto.
- Avisos INMET CAP vigentes associados apenas a IBGEs confirmados. Áreas descritas sem municípios ficam no inventário estadual com cobertura municipal parcial, nunca copiadas às 92 cidades. Cancelamentos já são retirados pelo conector CAP. Não reclassifica severidade oficial nem emite áudio novo.
- Fonte vencida ou worker desligado não produz ausência de risco. Download recente não renova observação antiga. Catálogo continua visível quando o monitoramento está indisponível.
- Catálogo de responsabilidades das fontes aprovadas: INMET, CEMADEN-RJ, Alerta Rio, ANA/Hidroweb/HidroWebService, SGB/SACE, CHM, WW3, PNBOIA, NOAA, Windy, Defesa Civil estadual/municipal, COR/CET-Rio, PRF/PMERJ e USGS. Cadastro não equivale a conector ativo. O estado operacional se refere somente ao produto realmente recebido, por exemplo avisos INMET, não todas as variáveis meteorológicas.
- Runtime ignora configuração legada de estação INEA, preservando as bibliotecas históricas apenas para regressão.

## Cobertura e pendências por produto

| Produto | Integração existente / pendência |
|---|---|
| Observações locais temperatura/umidade/vento | Cliente INMET e estações Alerta Rio; estação/cobertura e frescor precisam ser confirmados por município. Não há 92 estações locais validadas |
| Risco hidrológico estadual | Conector CEMADEN-RJ com inventário de 92 municípios; nova projeção/interface. Dados vencidos são recusados |
| Avisos meteorológicos | Conector INMET CAP; nova projeção municipal somente quando há IBGE confirmado |
| Chuva municipal Rio | Conector Alerta Rio; não substitui dados de outros municípios |
| Níveis/vazão/histórico/cheias | ANA/SGB/CEMADEN por produto: faltam conectores completos e cobertura por estação/bacia |
| Marés/avisos marítimos | Bibliotecas CHM existentes; avisos sem geocerca municipal e PDFs/dados pendentes não viram alerta local |
| Ondas/boias | WW3/PNBOIA: ingestão operacional, batimetria e validação costeira pendentes |
| Radar e satélite | Alerta Rio/CEMADEN/NOAA: produtos georreferenciados, histórico de quadros e conexão ao mapa pendentes |
| Windy | Chave/licença e integração operacional pendentes; dados de modelo não são observação |
| Trânsito/ocorrências/sirenes | Fontes e atribuições cadastradas; faltam feeds operacionais municipais/rodoviários e validação de localidade |
| UV/sensação térmica/qualidade do ar/previsão | Produtos/métodos, emissão, unidades e cobertura ainda não validados integralmente |
| Sismos/tsunami | Fonte USGS e NOAA/CHM previstas; ingestão, propagação costeira e validação ainda pendentes |
| Notícias e boletins | Base de interface existente; conteúdo atualizado, autoria, emissão e cobertura integral pendentes |
| Cálculos Vector RJ | Núcleos numéricos existentes; perfis/radares/hidrologia/oceano operacionais e validação física pendentes |

Esta revisão amplia a ligação estadual dos conectores já disponíveis e torna as lacunas explícitas. Não conclui todos os produtos, não implanta Cloud Run, não atualiza o aparelho e não comprova precisão operacional. Memória é especificação, não banco de observações atuais, credenciais ou prova de conectores já ativos.


## Falha encontrada no ensaio integrado

O parser do INMET resolve o índice RSS em documentos CAP e identifica o resultado como RSS_INDEX_RESOLVED_CAP. O cache ainda recusava esse formato, apesar de cada CAP ter passado pelos controles de identidade, domínio, validade e IBGE. Corrigida a lista de formatos normalizados aceitos no cache, preservando essas verificações. Inventário ativo vazio após cancelamento também passa a ser aceito; não vira declaração genérica de ausência de risco.

Primeiro ensaio ao vivo: cadastro estadual 92/92; CEMADEN-RJ recusado como atual por observações vencidas; Alerta Rio sofreu timeout; CHM forneceu inventário atual sem atribuição municipal validada; INMET bloqueou no formato do cache. Nenhum alerta automático foi emitido. A rota estadual do Cloud Run atual devolveu 404, comprovando que o serviço ainda não recebeu esta revisão.

Após a correção do cache, segundo ensaio ao vivo: Alerta Rio CURRENT e INMET CURRENT; 92 municípios na projeção; um aviso INMET vigente de âmbito RJ sem IBGEs municipais confirmados, mantido como área não resolvida e não atribuído às cidades. Nenhum alerta automático emitido. 424 testes locais backend passaram. Compilação Android desta revisão é verificada separadamente pelo CI; não comprova dados completos por município.
