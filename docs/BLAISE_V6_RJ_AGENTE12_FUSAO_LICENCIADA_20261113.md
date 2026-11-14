# Blaise V6 RJ — 12º agente: Geodados e Fusão Científica

**Data:** 13/11/2026 • **Escopo:** 92 municípios do RJ, nunca todo o estado estimado por poucas estações.

## Decisão operacional

- Identificador: `geodados-fusao-licenciada`, já inscrito no catálogo de 12 agentes.
- Função: integrar localização geográfica oficial de estações e estimativas locais a partir de **fontes independentes, licenciadas para uso comercial e derivação**, com validade, hora e fonte.
- Bloqueado: coleta secreta, ocultação de rastros de proveniência, simular origem principal em um provedor que não forneceu a medição, remover a licença original por aplicar médias, burlar restrições de uso, interpolar chuva de bairros como volume total municipal ou publicar diagnóstico como alerta oficial.
- Criptografia TLS/HTTPS é obrigatória nos adaptadores. Telemetria operacional mínima evita gravar histórico de voz, perguntas e dados pessoais; mantém evidencia de autorização comercial, identificadores de produto, estações, versão/horário e fonte necessários para auditoria.
- Os produtos geográficos Geo-Rio CC BY 4.0 são **apenas posições das estações**. Sua licença não estende permissão às respectivas leituras de temperatura, chuva, vento ou radar.
- `COR.Rio` não conta como segunda medição independente quando republica Alerta Rio. Modelos NOAA/INPE/CPTEC não devem ser somados a sensores como se fossem observações de campo. Produtos internacionais precisam de contrato, licença, hora de ciclo e validação próprios.

## Código proposto — não implantado

- `backend/src/rj-licensed-weather-fusion.mjs`: temperatura °C, umidade %, vento médio vetorial de 10 m km/h, chuva acumulada mm com janela idêntica, sensação térmica somente quando fórmula aplicável e entradas correlacionadas.
- `backend/src/rj-licensed-fusion-executor.mjs`: executor **sob demanda**, desativado até o backend injetar autenticação do operador, registro de concessões de direitos por produto e coletor HTTPS autorizado. Consulta o registro de direitos **antes** de solicitar as medições.
- `backend/src/rj-geo-rio-station-locations.mjs`: camada geográfica oficial separada, sem confundir com medições.
- `backend/test/rj-licensed-weather-fusion.test.mjs` e `backend/test/rj-licensed-fusion-executor.test.mjs`: testes de licenciamentos, independência, localização, tempo, vento vetorial e chuva acumulada, sem leituras inventadas em produção.

### Critérios mínimos

| Dado | Política de ponderação | Regra de segurança |
| --- | --- | --- |
| Temperatura | Distância e qualidade, estações próximas com até 100 m de diferença de altitude | Não chamar de temperatura medida de uma cidade inteira |
| Umidade | Média local após QC e consistência temporal | Não simular medição faltante ou zero |
| Vento | Componentes vetoriais de direções e velocidades comparáveis a 10 m | Sem média de rajadas ou direção divergente; não disfarçar vento extremo |
| Chuva | Mesma janela acumulada, pluviômetros próximos e concordantes | Divergência bloqueia; exibir máximos oficiais separadamente; não estimar cidade/estado |
| Sensação térmica | Cálculo derivado de temperatura e umidade/vento validados, quando cabível | Não inventar índice fora do domínio da fórmula |

### Interface cliente e auditoria

Título ao cliente: **“Estimativa Blaise — média ponderada de fontes autorizadas”**. Quando disponível, pode exibir **“Fonte de maior peso: [fonte licenciada]”**; é obrigatório manter **“Ver todas as fontes, horários e permissões”** para as demais contribuintes. A fonte de maior peso não é a única fonte nem um certificado de medição oficial.

Em fontes com exigência de atribuição pública (ex.: CC BY), a atribuição devida tem de permanecer visível na apresentação relevante; não basta anotação interna de auditoria.

Informação insuficiente, sem licença, muito distante, antiga ou heterogênea: **“Indisponível — medições comparáveis autorizadas insuficientes”**. Não exibir 0, previsão fictícia nem “sem risco”.

**Status de homologação:** este PR é apenas código e testes; não prova coleta ao vivo, contrato, licença comercial de qualquer produto meteorológico, publicação, APK assinado ou implantação do agente. Os testes utilizam amostras sintéticas explicitamente marcadas e não alimentam clientes.
