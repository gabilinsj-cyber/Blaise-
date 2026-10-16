# Blaise V6 RJ — regras permanentes dos alertas

Escopo exclusivo: Rio de Janeiro. Requisitos autorizados em 14/10/2026.

- Contar desde a emissão/atualização oficial; baixar o mesmo aviso não renova seu prazo.
- Após 3 horas: mostrar “Sem atualização nas últimas 3 horas”; avançar a cada hora completa.
- Após 4 horas: rebaixar o nível local Blaise 4 → 2 e 5 → 3. Preservar separadamente a gravidade oficial.
- Níveis locais 3, 4 e 5 piscam na respectiva cor.
- Após 12 horas sem atualização oficial, retirar da lista ativa.
- Encerramento/cancelamento confirmado pela fonte ou término oficial retira antes. Falha de consulta não prova cancelamento.
- Histórico por 12 horas após encerramento local, depois remover. Não ressuscitar a mesma emissão por novo download.
- Preservar fonte, horário, identificador e município IBGE.
- Falha de conexão não significa retirada: mostrar a última atualização oficial, manter o relógio original, rebaixar 4 → 2 e 5 → 3 na quarta hora; demais níveis permanecem. Na décima segunda hora, somente histórico por mais 12 horas.
- Limpeza Android agendada a cada 24 horas, persistente após reinício, e também na abertura/leitura do histórico. Apagar somente históricos vencidos, preservando configurações, credenciais e registros ainda necessários. O Android pode adiar a execução em segundo plano por economia de bateria; a validade exibida não depende desse agendamento.
- Mapa, gráficos e cidades usam as mesmas medições validadas, sem misturar cidade 1 e 2.
- Alerta Rio + Defesa Civil RJ em prioridade conjunta; OpenWeatherMap complementar e desempate conforme fenômeno e autorização.

Este registro não comprova implantação em produção, funcionamento contínuo ou atualização do APK instalado.
