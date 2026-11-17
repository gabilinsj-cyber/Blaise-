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
