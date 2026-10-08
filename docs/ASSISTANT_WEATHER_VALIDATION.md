# Assistente de voz e clima — implementação parcial em validação

O término do reconhecimento de fala dispara a consulta automaticamente, sem transcrição editável nem confirmação por Enviar. Perguntas digitadas recebem resposta escrita; perguntas faladas usam a voz Dora quando ligada e fora do modo silencioso. O reconhecimento depende do serviço de fala Android disponível no aparelho e não foi validado em dispositivo físico.

O contexto solicita município quando ausente. Rio/Rio de Janeiro representa Centro do Rio, inclusive nas perguntas seguintes. Solicitações regionais e assuntos sem provedor validado informam a indisponibilidade, sem extrapolar dados de uma estação para outra região.

## Consulta oficial ainda bloqueada

As consultas aos endpoints públicos de observações e previsão do INMET retornaram erros de acesso neste ambiente. O cliente implementa tentativa de consulta, limite de tamanho, timeout, tratamento de ausência, unidade e horário UTC convertido para Brasília, mas não há validação ponta a ponta com uma resposta real de Niterói. Sensação térmica e cobertura do Centro não estão disponíveis/validadas. A estrutura de previsão também exige validação com resposta real e horário de emissão antes de informar valores.

Não considerar este trabalho uma correção concluída de clima em tempo real. Faltam provedores validados para previsão, sensação térmica, UV, precipitação, riscos, mar, trânsito e cobertura regional. Dados observados são aceitos apenas dentro da janela explícita de duas horas; coleta periódica não muda o horário da medição.

## Boletins e interface

Inclui resumo com Leia mais e campo de texto expansível na interface Compose existente. A política define 06:00, 12:00 e 16:00 em America/Sao_Paulo, texto nos estágios 1–4 e voz no estágio 5 ou boletim extraordinário. A implementação atual atualiza apenas em primeiro plano a cada cinco minutos. Não integra estágio oficial, eventos extraordinários, execução em segundo plano ou emissão automática de voz desses boletins. O diálogo Leia mais é preliminar. O desenho completo aprovado pelo usuário ainda precisa ser reproduzido, incluindo personagem e disposição dos demais painéis.

## Validação

Executar testes unitários, assembleDebug e compilação dos testes instrumentados. Testes instrumentados e reconhecimento/áudio não foram executados em celular. O APK continua muito grande por incluir o modelo Dora. Não publicar como versão final nem solicitar que o usuário substitua a instalação para testar dados reais antes de validar os provedores.
