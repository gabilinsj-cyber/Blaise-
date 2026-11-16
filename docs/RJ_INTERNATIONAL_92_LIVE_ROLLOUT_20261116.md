# Blaise V6 RJ — Integração internacional de 92 municípios (16/11/2026)

## Implementação isolada e o que é REAL nesta etapa

- A base cartográfica própria e os 92 nomes/códigos IBGE **já existem** no Android.
- Nesta branch, o novo contrato `BLAISE_RJ_INTERNATIONAL_92_V1` transporta exclusivamente produtos internacionais recebidos **de verdade** pelo backend, atualmente adaptados ao `OPENWEATHER_ONECALL4_CURRENT` do Agente 13.
- A estimativa atual OpenWeather é **MODELADA**, não observação de estação, chuva de radar, boletim da Defesa Civil, alerta oficial ou previsão de tornado.
- Para cada município: `CURRENT_MODELED_ESTIMATE` com fonte, horário, coordenada, temperatura, sensação térmica, umidade, vento, rajadas, pressão e chuva 1h quando presentes; caso contrário `NO_CURRENT_INTERNATIONAL_DATA`, valores `null` e sem marcador inventado.
- O Android, quando a assinatura for validada, chama `POST /v1/data/international-weather` com seu próprio token de compra. O servidor valida acesso *antes* de ler qualquer medição.
- Os cartões das duas cidades e o mapa do Blaise recebem os valores internacionalmente verificados. O mapa pinta **somente pontos** de estimativa com coordenadas fornecidas pela origem; não interpola uma falsa previsão sobre os 92 polígonos e não gera quadros de radar falsos.
- O painel gráfico pode indicar um valor atual único e a necessidade de série histórica: não desenha curva horária inexistente. Previsões futuras, ondas, raio, qualidade do ar, UV e radar continuam aguardando produtos separados adequados.
- Links oficiais de alertas continuam separados do canal meteorológico, preservando a exigência de autenticação, validade, stage mapping e cor 1–5 somente quando verificadas.
- Os 14 agentes continuam cadastrados, mas isso não comprova execução. Agente 14 permanece auditor, sem consulta GPT automática.
- Original, branches anteriores, job NOAA, backup e fontes permanentemente excluídas **não foram alterados**. Nenhum deploy, assinatura, APK ou mudança de IAM foi efetuado.

## Como efetivar a coleta

O conector original do Agente 13 (`rj-openweather-agent13-service.mjs`) já exige:
- Secret Manager server-side: `BLAISE_OPENWEATHER_API_KEY`;
- assinatura One Call 4.0 efetiva, usos comerciais aprovados;
- Firestore compartilhado com transação atômica e limite de **900 chamadas/dia**, nunca cache local;
- cache do provedor de 10 min;
- alvo IBGE 33xxxxxx e coordenada verificável (não basta nome da cidade);
- aprovação explícita do operador e autenticação OIDC para ativação.

O **Agente 13 ainda não está agendado automaticamente** nesta branch. Seu código existente diz `automaticSchedulingEnabled:false`. A nova interface **não inicia coleta paga** por si só, apenas lê o cache originado por uma coleta real previamente autorizada. Não trocar a coleta por dados brasileiros, mocks ou IA.

No serviço Cloud Run, o novo leitor Firestore poderá ser ligado **somente após a aprovação de IAM e dos direitos do provedor**, com as duas variáveis simultâneas:

```text
BLAISE_RJ_INTL_PAID_READ_ENABLED=true
BLAISE_OPENWEATHER_COMMERCIAL_USE_VERIFIED=true
```

Se alguma condição estiver ausente, o endpoint responderá 503. A operação usa ADC da conta de serviço do Cloud Run e *apenas leitura* da coleção `blaise_rj_openweather_current_cache`, com cache de memória de 60 s por instância; nunca tenta alterar permissões, dados, planos ou faturamento.

O Android exige `BLAISE_ENTITLEMENT_VERIFY_URL` válido, plano ativo e versão que contenha o novo parser.

## Limite físico de cobertura

**900 chamadas/dia não permitem atualizar os 92 municípios com uma chamada por cidade a cada 10 minutos.** Uma rodada completa de 92 municípios consome 92 chamadas; dez rodadas consomem 920, excedendo o teto interno. Portanto, o Agente 13 não pode sustentar cobertura atual homogênea de 92 municípios em alta frequência usando One Call isoladamente.

A estratégia de produção deve priorizar (1) avisos oficiais independentes, (2) cidades visíveis, (3) dados globais licenciados de modelos NOAA para o mapa, (4) OpenWeather como complementação e desempate dentro da quota. Uma futura ingestão única de grade global NOAA pode cobrir muitas cidades sem 92 chamadas OpenWeather, **mas ainda não está conectada**.

## Comprovação antes do lançamento

1. Rodar `node --test backend/test/rj-international-92-snapshot.test.mjs backend/test/rj-international-92-http.test.mjs` e todos os testes anteriores.
2. Confirmar licença comercial, assinatura OpenWeather 4.0, orçamento, alertas de custo e quota compartilhada em Firestore.
3. Conferir endereço do endpoint e origem de todos os municípios; construir catálogo de coordenadas a partir de cartografia aprovada com IBGE exato, sem inventar centros urbanos.
4. Auditar dados realmente coletados: `sourceId`, instante de validade, idade, localidade, natureza modelada, correspondência de cidade, campos faltantes e cobertura de 92.
5. Validar autenticação do assinante, fail-closed em erro de Firestore, falha de API e baixo saldo de quota.
6. Testar APK no Android real (assinatura, minSdk, tablets e smartphones) antes de publicar; não copiar interfaces de terceiros.
7. Confirmar atualização de radar por quadros reais, notícias via links e alertas públicos por fonte oficial antes de marcar esses subsistemas como operacionais.

**Status:** código integrado em branch isolada, dados não coletados nesta sessão. Não foi feita implantação em produção, nem fornecidos valores meteorológicos fictícios.
