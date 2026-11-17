# Blaise V6 RJ — Agente 13: contingência de temperatura e sensação térmica (35 min)

## Política solicitada
OpenWeather One Call 4.0 é fonte **complementar de estimativa modelada**, não estação e não alerta oficial. A exceção de 35 minutos aplica-se **exclusivamente** a `temperatureC` e `feelsLikeC`.

1. O servidor cruza os três medidores/fontes prioritários **efetivamente homologados para o município e a variável**. Cada verificação precisa ter identidade de fonte, prioridade, comprovação feita no backend e horário de checagem de no máximo 12 minutos.
2. Se um dos três fornecer um valor **válido e atual**, preservá-lo; não substituí-lo por OpenWeather. Se somente a temperatura estiver ausente, usar somente temperatura complementar; se somente a sensação térmica estiver ausente, usar somente essa variável. Se a situação das fontes não estiver comprovada, retornar indisponível: ausência de inventário não é prova de falha.
3. Consultar o provedor somente **sob demanda e com necessidade**, com um mínimo de **35 minutos entre reservas por município IBGE**, compartilhado entre todos os usuários e instâncias do backend. O bloqueio permanece após falha, virada de dia, reinicialização ou troca de servidor.
4. Um documento diário de Firestore regula **900 reservas no total, UTC**, somando consultas legadas e futura contingência. Uma transação atômica reserva simultaneamente a cota diária e o horário municipal. Não iniciar uma chamada se qualquer etapa falhar.
5. Reutilizar resposta já adquirida e homologada, mantendo a idade do **dado de origem (validAt)** limitada a 35 minutos. Após esse tempo, exibir indisponível (até a próxima consulta permitida). **35 minutos é limite de idade, não autorização para tratar estimativa antiga como medição em tempo real**.
6. Exibir `Estimativa OpenWeather — contingência`, município, hora efetiva de validade e última checagem. Não ocultar a proveniência, não dizer `estação oficial` ou `tempo real` ao exibir o dado de exceção.
7. **Vento, chuva, rajadas, tempestade, mar, radar, níveis de risco e alertas** continuam com suas próprias prioridades e atualidade <=12 minutos, conforme o produto. OpenWeather não emite alertas oficiais nesta integração.
8. Sem localização do usuário: chaves internas por código IBGE, cache compartilhado, nenhuma chave de API no cliente, sem histórico de consultas pessoais.

## Dimensionamento da quota

Se todos os 92 municípios precisassem de uma consulta a cada 35 minutos durante 24 horas, a demanda teórica seria aproximadamente **3.785 chamadas/dia** (92 x 1440/35), **mais de quatro vezes** a quota interna de 900. O ritmo efetivo precisa ser subordinado à quota, e depender apenas dos municípios realmente sem valores de fonte prioritária. Uma mesma consulta pode preencher ambos os campos.

## Situação de implementação

**Proposta isolada / não ativada em produção.**

- Implementado: decisão fail-closed por variável; rejeição de fontes sem auditoria; filtro que só retorna temperatura/sensação; validade 35 min e rotulagem de estimativa; transação Firestore de cooldown municipal + quota global; cache Firestore apenas com os dois campos térmicos e expiração baseada no `validAt` de origem; coletor com uma única requisição One Call, somente para Rio e Niterói calibrados; ligação ao serviço interno do Agente 13 sob chave separada `BLAISE_AGENT13_TEMPERATURE_CONTINGENCY_ENABLED`, cujo padrão é **desativado**; testes automatizados.
- **Ainda NÃO ativado no aplicativo:** inventário real e auditado dos três medidores por variável/município; alimentação desse inventário por adaptadores oficiais homologados e permitidos; referências geográficas verificadas para os demais 90 municípios; invocação controlada do coletor pelo backend; integração de exibição à interface original; testes instrumentados do fluxo de assinante e canário. **Somente testes simulados foram realizados para a nova exceção**. Os testes de coleta real anteriores foram da modalidade de 12 minutos da PR #156.
- O endpoint atual da PR #156 continua com a regra anterior de até 12 min e os pontos calibrados de Rio/Niterói. **Não alterar sua semântica nem ativar a nova exceção** antes de concluir as dependências.
- Nenhum robô de sondagem de todos os municípios; não há polling agendado.
- Qualquer implantação no Cloud Run exige revisão, credenciais mínimas, canário separado, métricas de quota, teste de faturamento e aprovação explícita.

## Evidências e referências

- OpenWeather One Call API 4.0, `/data/4.0/onecall/current`: https://openweathermap.org/api/one-call-4
- Fonte oficial deve ser sempre atribuída por variável e município. Alerta Rio/Defesa Civil não devem ser assumidos como estações de temperatura quando apenas divulgam alertas.

## Observações de segurança

- Nenhuma URL pública/rota HTTP foi adicionada para ativar a contingência. Uma eventual futura rota autenticada não deve receber `prioritySources` informadas pelo cliente.
- Os exemplos `INMET`, `INPE_CPTEC` e `ECMWF_IFS` usados nos testes são **fixtures simuladas**; não constituem três medidores homologados de temperatura em todos os municípios.
- A implementação isolada não altera a janela de 12 minutos da interface já publicada para os demais fenômenos.


## Priorização complementar aprovada em 17/11/2026 — Meteologix/Kachelmannwetter

**Ordem de decisão para temperatura e sensação térmica no RJ (por município e variável):**

1. **INMET**: observação real de estação representativa, quando disponível, licenciada e com `validAt` confiável.
2. **DWD/ICON Global**: previsão/modelo de temperatura, com rodada, horário válido, grade e posição geográfica identificados.
3. **NOAA/GFS**: previsão/modelo global independente do ICON, com rodada, horário válido, grade e posição geográfica identificados.
4. **Meteologix/Kachelmannwetter**: **conferência e eventual desempate**, inicialmente só por inspeção visual do site `https://meteologix.com/br`, **não coletor nem quarto medidor independente**. Seus mapas incluem ICON, GFS e ECMWF: uma representação do mesmo ICON/GFS não acrescenta evidência independente. Se a Meteologix disponibilizar produto próprio ou observação distinta **na API devidamente licenciada**, verificar a origem de cada produto, independência, termos e horários antes de qualquer ativação.
5. **Agente 13 / OpenWeather One Call 4.0**: **última contingência**. Somente para o(s) campo(s) térmico(s) sem valor confiável após as etapas anteriores, com intervalo mínimo de 35 minutos por município, cache compartilhado e 900 chamadas/dia em todas as consultas OpenWeather.

**Divergência:** comparação exige mesma variável/unidade, mesma área representativa, instantes compatíveis e natureza claramente distinguida (estação vs modelo). Divergência por si só **não invalida** uma observação oficial correta e **não autoriza sobrescrita automática**. Sinalizar discrepância, verificar rodada/erros e fonte original e somente classificar o campo como indisponível/inconclusivo se houver evidência técnica documentada de invalidade. Abrir exceção de consulta OpenWeather por discrepância só após essa auditoria. O algoritmo atual da PR #157 permanece **fail-closed** e ainda **não implementa** resolução independente de divergências, nem coleta dados da Meteologix.

**Licenciamento:** o site pode ser usado para consulta visual de comparação, não para espelhamento, raspagem automatizada, replicação de mapas ou publicação no Blaise. Os termos gerais do site restringem uso comercial; a API é um **produto separado**, sujeito a contratação de pacote Business e licença de cada produto/dado para uso em aplicativo público. Consulta visual gratuita **não equivale a uma API comercial gratuita**. Não habilitar nenhuma integração Meteologix antes de autorização/licenciamento, preço e endpoint contratual confirmados.

**Fontes:**
- Site: https://meteologix.com/br
- Modelos para o Brasil: https://meteologix.com/br/model-charts/standard/temperature.html
- API comercial: https://www.business.meteologix.com/en/api
- Termos do site: https://meteologix.com/br/site/tos
- Termos da API: https://accounts.meteologix.com/static/api-nutzungsbedingungen?_locale=en

**Sem mudanças em produção ou precedência geral de fenômenos não térmicos.** Earth Nullschool continua apenas como outro visualizador interno, não um medidor independente. Alertas oficiais seguem somente por links de Alerta Rio e Defesa Civil RJ, sem coleta meteorológica dessas instituições.


## Separação obrigatória entre interface do cliente e aplicativo administrativo

**Cliente Blaise V6 RJ:** exibir apenas temperatura e sensação térmica que passaram nas verificações de origem/validade, a fonte **específica do valor usado** e sua hora efetiva; quando faltarem, mostrar `Indisponível`. Não apresentar nomes, números ou lista de agentes, quatro medidores, discrepâncias internas, cálculos, reservas de cota, diagnósticos ou hierarquia de desempate. Preservar o layout original aprovado.

**Administrador:** visualizar o inventário auditável de fontes, disponibilidade por município/variável, modelo/rodada, observação versus previsão, idade do dado, comparações e discrepâncias, decisão, histórico operacional estritamente necessário e reservas diárias agregadas; autenticação administrativa necessária. Não enviar esses campos internos para o aplicativo do cliente.

**INMET e CEMADEN na comparação interna:** INMET serve como referência de observação térmica **somente quando houver estação com valor recente, coordenadas e uso permitido**. CEMADEN contribui com observações de chuva/contexto de risco hidrológico e checagem meteorológica cruzada; o coletor CEMADEN existente NÃO mede temperatura ou sensação térmica. Não marcar CEMADEN como um termômetro térmico nem como quarta evidência independente de temperatura a menos que um produto térmico específico, licenciado e validado seja realmente integrado. Visualizações Meteologix e Earth Nullschool não devem ser contadas como medições independentes dos mesmos modelos subjacentes.

**Situação no Android:** o botão manual de consulta OpenWeather e o relatório detalhado de modelo foram retirados do painel municipal na PR #157, preservando a apresentação de observação válida com fonte e hora. O aplicativo do cliente NÃO pode acionar o fallback pago enquanto `THERMAL_FALLBACK_INTEGRATED=false`. A implementação do serviço interno continua isolada e desativada até haver três verificações térmicas reais e auditadas. Não declarar valores fictícios nem disponibilidade para todos os 92 municípios.


## Breezy Weather / AccuWeather: referência visual para umidade, UV e fenômenos complementares (17/11/2026)

- **Papel permitido atualmente:** `Breezy Weather` é um aplicativo Android FOSS e uma referência de consulta humana para administradores; seus documentos e repositório são acessíveis pela web. **Não é uma API de dados de uso comercial autorizada para Blaise** e não constitui um novo medidor independente da AccuWeather.
- A documentação das fontes do Breezy confirma que sua integração AccuWeather disponibiliza **umidade, UV, temperatura, ponto de orvalho, pressão, vento e visibilidade**, mas requer chave de API. A chave incluída no Breezy é destinada ao uso do próprio Breezy, não a consultas feitas pelo Blaise, nem à extração de dados ou ao espelhamento por integrações não licenciadas.
- **Licença:** o portal AccuWeather distingue avaliação/trial e assinaturas comerciais. Seus termos para a licença Starter restringem o uso a fins pessoais/não comerciais e impõem limitações à redistribuição, combinação com outras fontes e uso para avaliação/treinamento algorítmico. O aplicativo Blaise V6 RJ é comercial: nenhuma coleta, cálculo, validação automatizada, exibição de dado, cópia de chave ou integração Breezy/AccuWeather deve ser ativada sem contrato específico que permita o caso de uso. A licença de código LGPL do aplicativo Breezy não licencia dados de provedores terceiros.
- **Umidade do ar:** a rotina operacional futura deverá priorizar observação INMET comprovada quando representativa, depois dados de fontes internacionais aprovadas e devidamente licenciadas; identificar natureza de cada valor, horário de origem e cobertura espacial.
- **Índice UV:** somente usar produto UV diretamente fornecido por fonte autorizada, com época de validade e cobertura do RJ demonstradas; não inferir UV de temperatura, nebulosidade ou radiação solar global sem modelo UV validado. Mantém-se `Indisponível` até existir integração comprovada.
- **Atualidade:** para umidade e UV aplicam-se os critérios de atualidade próprios do fenômeno e do produto. **Não transportar a exceção de 35 minutos da contingência térmica** para UV, umidade, raios, chuva ou vento. Uma previsão com rodada recente não pode ser anunciada como estação observada em tempo real.
- **Privacidade/interface:** clientes veem somente valores válidos, fonte e hora específicos, ou `Indisponível`; não veem app de comparação, agentes, chaves, cálculos ou divergências. Uso visual interno não autoriza copiar telas, mapas, dados, capturas ou logotipos do Breezy ou AccuWeather para a interface.
- **Status:** apenas política documentada na PR #157, sem coletor de AccuWeather, sem consulta externa, sem alteração no app em produção e sem gastar chamadas OpenWeather.

Referências verificadas:
- https://github.com/breezy-weather/breezy-weather
- https://github.com/breezy-weather/breezy-weather/blob/main/docs/SOURCES.md
- https://developer.accuweather.com/documentation/overview
- https://developer.accuweather.com/documentation/terms-of-use
