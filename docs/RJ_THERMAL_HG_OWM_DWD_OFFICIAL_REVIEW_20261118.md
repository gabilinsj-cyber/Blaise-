# Blaise V6 RJ — regra de temperatura e sensação térmica (18/11/2026)

## Decisão operacional mais recente
Por solicitação do proprietário, **NOAA GFS, Climatempo e ECMWF/MET Norway não fornecem temperatura do ar nem sensação térmica**, nem por valor próprio, nem por substituição automática. Os antigos registros NOAA GFS dos 92 municípios continuam como **prova histórica de decodificação**, mas o novo gate de cobertura deve rejeitá-los para temperatura. NOAA/ECMWF continuam autorizados para setores não térmicos conforme contrato de cada produto (mar, ondas, vento, chuva prevista etc.).

Fontes aprovadas para temperatura:
1. HG Brasil — valor atual agregado **E**, com autorização escrita mas compra do Pro **adiada para o último estágio**. Sem chave, servidor ativo ou coleta paga.
2. OpenWeather One Call 4.0 — condições atuais **E**, em servidor com chave protegida, reserva atômica de quota (**900 chamadas/dia no máximo**) e cache. Preservar a distinção entre estimativa e termômetro observado. Só chamar se licença/plano e gates operacionais forem reais.
3. DWD ICON Global (Alemanha) — temperatura a 2 m **P**, previsão numérica com ciclo e hora de validade, não medição física local; exigir ponto de referência oficial IBGE e ecCodes.

Sensação térmica:
- OpenWeather `feels_like` é **E** quando houver retorno novo e homologado.
- HG e DWD não são anunciados como sensores próprios de sensação. Um cálculo Blaise poderá usar temperatura + umidade/vento válidos, **somente** em fórmula aplicável e identificada como derivação; nunca gerar valor na falta de entradas adequadas.
- Sem fonte válida, exibir `indisponível`, jamais 0 ou número inventado.

## Comparação de proximidade com referências oficiais
- **INMET**: consultar visualmente fonte pública e estação próxima, quando tiver um dado realmente comparável (posição, hora, unidade °C e diferença aceitável).
- **Defesa Civil RJ**: consultar visualmente boletim/aviso oficial. Se não houver temperatura instrumental quantitativa comparável, devolver `NO_COMPARABLE_OFFICIAL_TEMPERATURE`; não inferir temperatura a partir de alerta.
- Essa análise ocorre **somente no ADM** e não importa/sincroniza/coleta automaticamente dados ou boletins de INMET e Defesa Civil; referência manual pode ser fornecida explicitamente para comparação pontual. O resultado é exclusivamente qualitativo e a tolerância de exemplo é 3 °C, ajustável segundo microclima e distância. Diferença não causa substituição automática, não cria alertas e não alimenta valores do cliente.
- INMET/CEMADEN conservam papel anterior de comparação interna; Alerta Rio/Defesa Civil mantêm encaminhamento de links de alertas oficiais no app.

## Mudanças em código
- `rj-source-sector-matrix.mjs` e `rj-meteorological-completeness-audit.mjs`: campo temperatura autoriza apenas HG E / OWM E / DWD P; sensação direta só OWM E.
- `rj-thermal-approved-policy.mjs`: pure gate de seleção de valores e comparador manual de referências INMET/Defesa Civil, sem rede, banco nem API cliente.
- `rj-international-forecast-public.mjs`: ECMWF/MET Norway não projeta mais `temperatureC` nem `feelsLikeC` em dashboard público; demais campos permanecem quando autorizados.
- Agente 13: verificação de fontes HG e DWD (não NOAA/ECMWF), preservando cache e quota global. Não ativar temporizador, cobrança ou rotina.
- `probe-dwd-icon-numeric-staging.mjs`: usa coordenada de referência interior ao polígono IBGE Rio, consulta real controlada ao DWD, valida GRIB e extrai valor ecCodes em staging. Sem inserção automática em produção ou no aplicativo até CI/QA e liberação explícita.

## Restrições
Nenhuma contratação Climatempo/HG; nenhuma reintegração Windy, INEA, Marinha, JAXA ou NASA. Código original e demais setores preservados. Alterações em PR empilhada sem merge/deploy automático. O APK ADM compilado anteriormente permanece uma versão QA, não contém estes commits até uma nova compilação aprovada.
