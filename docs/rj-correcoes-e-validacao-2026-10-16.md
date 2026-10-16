# Blaise V6 RJ — regras e registro de correções

Escopo exclusivo: 92 municípios do Rio de Janeiro e Atlântico adjacente. Este registro preserva requisitos; não certifica implantação ou dados operacionais.

## Regras vigentes

- Tabela 1: Alerta Rio, Defesa Civil RJ, OpenWeatherMap e REDEMET/DECEA (aeronáutica). Não contar republicações ou dois aeroportos da mesma rede como fontes independentes.
- Tabela 2 sequencial: INPE/CPTEC, INMET, CEMADEN, Windy e NOAA. Quando houver contribuição da Tabela 1, selecionar no máximo uma fonte compatível da Tabela 2. O recurso de duas observações da Tabela 2 sem primária exige independência, mesma variável, unidade, período, município e qualidade verificadas.
- Médias ponderadas exigem pesos de qualidade comprovados; previsões e produtos combinados não viram observações independentes. Horários de coleta não renovam o horário da medição. Valores com mais de cinco minutos não entram na média.
- Mapa, cartões, gráficos e assistente devem consumir o mesmo resultado por município e variável. Não misturar cidade 1 e cidade 2.
- Marinha/CHM excluída das fontes marítimas por decisão do usuário em 16/10/2026. Usar INPE/CPTEC, INMET, Windy, NOAA, Copernicus Marine e EUMETSAT conforme o produto efetivamente disponível. Imagem de satélite não é medição de onda, corrente ou maré.
- Previsão CPTEC deve indicar data de publicação, instante de validade e natureza de previsão; a fonte só publica o dia de emissão, não inventar hora. Não oferece marés, correntes ou temperatura do mar neste adaptador.
- Fontes indisponíveis não geram zeros, média fictícia, mar seguro ou ausência de risco. Exibir somente dados e horários verificados, com indicação de indisponibilidade quando necessário.
- Configurações operacionais e os dez agentes ficam restritos ao administrador. Assistente feminina, pronúncia de Blaise como “bleiss”, envio ao terminar a fala. Alertas sonoros automáticos apenas no nível 5.
- Atualização normal em 1–5 minutos; categoria 4/5: coleta e recálculo em 30 segundos cada, conforme disponibilidade da fonte. Consulta frequente não aumenta a resolução temporal do fornecedor.
- Alertas: após três horas sem atualização, informar atraso; na quarta hora aplicar o rebaixamento local aprovado (4→2 e 5→3) sem apagar a autoria e o nível oficial. Após 12 horas sair da grade ativa, manter histórico por mais 12 horas e excluir. Retirada comprovada pela fonte vai diretamente ao histórico; falha de conexão não prova retirada. Limpeza diária mantém apenas o essencial.
- Não solicitar outro APK nem promover tráfego de produção antes de concluir os testes de integração e Android.

## Correções e evidências

- Restaurados arquivos de compilação e módulos que faltavam na árvore Git.
- Corrigida a seleção de duas fontes da Tabela 2 quando não há primária válida; adicionados testes do resultado canônico e preservação de horários.
- Adicionado coletor CPTEC de previsão de ondas, com controle de disponibilidade e distinção entre previsão e medição no Android.
- Restaurados scripts de verificação exigidos pelo npm e testes de proveniência REDEMET/CEMADEN.
- Corrigida a disponibilidade da rota pública quando o único produto atual é o complemento OpenWeather, sem criar medições municipais ou alertas.
- Execução local após a correção da rota pública: 673 testes aprovados. A execução CI Android 977 falhou por script ausente, antes da compilação. A execução CI 979 aprovou o backend, incluindo contêiner e teste de inicialização; a compilação Android ainda está em andamento. Resultados posteriores devem ser conferidos no CI; não presumir aprovação.

## Pendências comprovadas

- Médias alimentadas por um par de fontes reais com qualidade e pesos verificados ainda não demonstradas no fluxo em produção.
- OpenWeather recusado na verificação anterior por cálculo com cerca de 20 minutos, além do limite de cinco minutos. Não confundir com chave inválida nem relaxar o limite.
- CPTEC respondeu HTTP 403 na última tentativa documentada; não há ondas atuais validadas. Demais produtos marítimos ainda não têm ingestão contínua validada no painel.
- Revisão Cloud Run 00056-vin validada apenas como implantação candidata com 0% de tráfego; não prova validação funcional completa.
- Validação Android ponta a ponta pendente. A memória desta conversa não modifica o aplicativo instalado; implantação e testes precisam de evidências separadas.

## Consulta real à candidata em 16/10/2026 às 19:17:55 (Brasília)

A rota pública respondeu HTTP 200. OpenWeather calculado às 19:15:02, coletado às 19:17:32: 23,91 °C; sensação informada 24,81 °C; umidade 94%; vento 9,25 km/h. Trata-se de complemento combinado, não média municipal ou observação independente. CEMADEN nacional publicou atualização de consulta às 19:17:01; isso não altera a hora de abertura de cada alerta. REDEMET trouxe boletins de 19:00, classificados como degradados. `marine` e `marineForecast` vieram nulos. Estes valores são evidência histórica desta consulta, não dados permanentemente atuais.
