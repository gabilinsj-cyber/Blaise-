# Interface e dados — 08/10/2026

Referência: Referencia_Definitiva_Blaise_V6_RJ_atualizada.md, versão 7.

Android CI da separação voz/texto (9fc02b7): aprovado. Não houve acesso ao celular, instalação ou teste visual em aparelho nesta rodada.

## Mudanças desta revisão

Cartões das duas cidades mostram umidade e vento médio em linhas próprias, além de temperatura, fonte, estação e horário já existentes. Sensação térmica, UV, chance de chuva, rajadas e nebulosidade continuam explicitamente indisponíveis sem produtos válidos.

Rede meteorológica Alerta Rio conectada em painel expansível no painel estadual. Coleta em primeiro plano a cada 60 segundos; idade revalidada pelo relógio de 30 segundos, sem renovar horário da medição. Desligamento retira a rede. Estações desconhecidas são recusadas. Nenhuma estação é usada para preencher Centro, Niterói ou São Gonçalo sem cobertura confirmada. Rede não é mapa de radar, média ponderada municipal nem série histórica.

Removidas menções de INEA da interface, conforme substituição aprovada por Alerta Rio/CEMADEN. Conector legado não ativado nesta revisão.

## Verificação do serviço

GET /health e /readyz: HTTP 200. Página oficial Alerta Rio: HTTP 200. Catálogo INMET: HTTP 502 na consulta desta rodada. Saúde do backend não prova coleta, conteúdo ou revisão implantada.

## Bloqueios para preencher integralmente

Mapa/radar georreferenciado e séries reais, UV, sensação térmica com produto/método validado, previsão com emissão válida, marés/ondas por localidade, trânsito, qualidade do ar, risco, notícias e sismos ainda não estão integralmente ligados. Fornecedores científicos, NOAA/Windy e dados costeiros continuam pendentes. A rota completa de dashboard exige configuração de entitlement e compra verificada; não foi contornada. Cloud Run não foi implantado nesta rodada. A revisão de hoje necessita novo APK e teste no aparelho; os testes de código não substituem essa validação.
