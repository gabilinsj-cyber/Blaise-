# Blaise V6 RJ — matriz de fontes por fenômeno e localidade

**Regra do projeto (10/10/2026).** Escopo exclusivo do estado do Rio de Janeiro, seus 92 municípios, litoral adjacente e fenômenos do Atlântico capazes de afetar o RJ. **INEA retirado**, inclusive de coletores opcionais e de sondagens operacionais. Esta matriz é uma especificação de roteamento; **não atesta que todas as integrações já estejam operantes**.

## Classes de origem
- **Medição/aviso oficial:** só quando for do órgão competente, identificando produto, coordenada ou município coberto, valor e unidade, observação/emissão em data válida e URL de origem. NOAA é agência oficial para seus produtos, mas previsões numéricas não são medições locais.
- **Contexto de modelo e comparação:** Windy, suas visualizações de modelos e estimativas de terceiros. Registrar modelo, execução, horário previsto, região e licença. **Não usar como confirmação oficial**, nem criar aviso ou valor observado apenas com esse contexto.
- **Cálculo Blaise:** derivação física e matemática sobre entradas identificadas, distinguida de medição. Não preencher lacunas sem dados ou estimar falsa precisão.
- **Indisponível:** falha de rede, HTTP 204, medição antiga, sem licença, fora da cobertura, variável ausente, georreferenciamento desconhecido ou divergência inconclusiva.

## Fontes por região e fenômeno

| Região / fenômeno | Prioridade de origem | Complementares / critérios |
|---|---|---|
| Rio de Janeiro (município): chuva, radar, acumulados, alertas | Alerta Rio e avisos locais da Defesa Civil; CEMADEN conforme cobertura | INMET para amostra pontual de estação; não chamar estação de radar nem interpolar municípios |
| Demais 91 municípios: chuva/temporal/risco | Defesa Civil competente e CEMADEN; INMET para observações nas estações disponíveis | Comparar Windy apenas como contexto, nunca afirmar que Alerta Rio cobre todo o estado |
| Todos os 92 municípios: temperatura, sensação térmica, umidade, vento/rajadas | INMET e redes oficiais municipais/Defesa Civil **onde houver observações**, com local, horário e qualidade | Sensação térmica calculada quando temperatura, umidade/vento e fórmula se aplicarem; Windy é critério comparativo subsidiário, não desempate autoritativo |
| Nível de rios, cota e vazão | ANA (HidroWeb / serviços hidrológicos) | CEMADEN e SGB/SACE para contexto e situação de cheia; conferir identificação da estação e atualização |
| Risco hidrológico/inundação | CEMADEN, Defesa Civil e SGB/SACE segundo competência | Cruzar com ANA quando disponível; risco não é substituível por vazão isolada |
| Mar, ressaca, ondas, vento marítimo, avisos à navegação | Marinha do Brasil/CHM | NOAA para produtos oficiais pertinentes; INMET costeiro e Windy apenas complemento com tipo de dado explicitado |
| Ciclone extratropical/temporal no Atlântico Sul | Marinha do Brasil e produtos pertinentes NOAA; INMET para observações/avisos nacionais | Windy para comparação de modelos e trajetória estimada; ao ameaçar RJ, priorizar avisos Marinha, INMET, Alerta Rio e Defesa Civil conforme área |
| Acumulado de chuva oceânica, nuvens, frentes e massas de ar quente/fria | NOAA e produtos oficiais pertinentes da Marinha/INMET; satélites/modelos conforme licenciamento | Windy como referência de previsão e visualização, **não como medidor no oceano** |
| Interação oceano–litoral RJ / impactos locais | Marinha do Brasil + INMET + Defesa Civil local/estadual + Alerta Rio (somente município do Rio) | Windy complementar; confirmar distância, direção, horário provável e alcance, sem regra artificial de limite de 1 km quando não houver dados |

## Calculadora científica Blaise V6 RJ — cálculos suplementares

A implementação inicial está em `backend/src/rj-scientific-calculator.mjs` e seu primeiro teste em `backend/test/rj-scientific-calculator.test.mjs`. **Não é validação de previsão meteorológica, nem substitui alertas oficiais.**

- **Média ponderada:** \(\bar{x}=\sum_i w_i x_i / \sum_i w_i\). Só comparar **observações oficiais da mesma variável, unidade e município**, registradas em até 15 minutos de diferença, atuais e de estações a no máximo 25 km de distância entre si; exige no mínimo 2 pontos distintos e pesos de qualidade documentados. Valores Windy/modelo, níveis de alerta e fenômenos diferentes não entram na média.
- **Ponto de orvalho:** aproximação termodinâmica de Magnus, quando temperatura e umidade relativa estiverem medidas e dentro do domínio válido, com carimbo de horário recente.
- **Sensação térmica:** fórmula Rothfusz/NOAA para calor e vento-frio para temperaturas baixas e ventos adequados; fora da faixa da fórmula, mostrar **indisponível**, não a temperatura ambiente como se fosse sensação calculada.
- **Acumulado de chuva:** não somar amostras sem intervalo, horário, duração e unidades comparáveis. Para 5/10/15/30 min, 1h e 24h, usar apenas observações oficiais com janela demonstrável; sem janela completa, não inferir acumulado.
- **Outros diagnósticos atmosféricos** (advecção, tendência de pressão, vorticidade, estabilidade convectiva, cisalhamento, movimento radar) seguem **pendentes de dados verticais/espaciais autorizados e testes de unidade físicos**. A presença da fórmula em uma especificação não prova execução.
- Identificar toda saída como **“Cálculo experimental Blaise — não é medição oficial”**, informar fontes, local, horário, fórmula e limites. Nenhum cálculo isolado aciona P0/voz/sirene.

## Política de divergências, cobertura e cadastro
1. Restringir primeiro **localidade + fenômeno + variável + tempo**. Não combinar medições de escalas temporais distintas ou pontos distantes.
2. Comparar observações oficiais contemporâneas, métodos, precisão, estação, qualificação e unidade; quando não houver acordo, exibir a divergência e bloquear conclusão automática. **Windy pode ajudar a investigar, mas não prevalece sobre medição ou aviso oficial.**
3. A cobertura dos **92 municípios** significa que todos podem ser selecionados; **não** significa que cada município tenha estação INMET, radar, alerta local ou medição atual. Mostrar explicitamente cobertura, origem e horário para cada valor.
4. Em situação severa, a cadência desejada é coleta e recálculo de até 30 segundos **quando a fonte oferecer dados novos e a licença/limite permitir**. Repetir requisições não torna a fonte mais atual.
5. Aviso nível 5 só aciona som e voz conforme regra específica de confirmação e elegibilidade do projeto. Dados de terceiros ou cálculos experimentais não são substitutos de avisos oficiais.
6. Radar real requer fonte licenciada, prova de data do frame, projeção e georreferenciamento; caso contrário a camada permanece **indisponível**.
7. Capturar falhas de autorização, domínios e mudanças de API, com auditoria; nunca alterar origem automaticamente para página não autorizada.
8. Conectores ANA, SGB/SACE, NOAA e Windy devem ser implementados e comprovados separadamente. A presença nesta matriz não equivale a ingestão funcional.

**Situação atual de validação:** o INMET já possui modelo de leitura pontual e testes; última consulta externa reportou HTTP 204 em quatro estações do Rio, portanto **dados horários recentes não comprovados**. As camadas oceânicas, radar espacial, assinatura Google Play e voz física permanecem sujeitas à validação e/ou à autorização aplicável.
