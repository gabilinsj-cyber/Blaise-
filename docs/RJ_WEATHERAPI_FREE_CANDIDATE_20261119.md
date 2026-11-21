# Blaise V6 RJ — WeatherAPI.com Free (candidata, sem chave e sem coleta)

**19/11/2026, PR #173 DRAFT.** Nova fonte mencionada pela titular. **Não é uma assinatura nova, não há chave WeatherAPI.com informada, não há conta WeatherAPI.com verificada, não houve consulta meteorológica WeatherAPI.com e nada foi implantado.** Não alterar Meteoblue Free ou Visual Crossing Free, nem produzir/apagar/resetar arquivos do aplicativo original.

## Verificação direta da oferta

Site oficial: <https://www.weatherapi.com/pricing> (e <https://www.weatherapi.com/signup>). Em 19/11/2026 a página anuncia plano **Free US$0**, **100.000 chamadas mensais**, **10 requisições por segundo**, **previsão de três dias** (diária/horária), condições atuais, previsão, um dia de histórico, recursos limitados de qualidade do ar e alertas, **uso comercial e cadastro sem cartão**, com top-ups apenas **manuais** no Free. Ao atingir a franquia, a API pausa até o dia 1º do mês UTC, sem cobrança automática por excedente conforme a página de preços. Não confundir com a franquia **Visual Crossing de 1.000 registros por dia**: são duas empresas e formas de contabilização diferentes.

Termos oficiais: <https://www.weatherapi.com/terms>. Exigem que o cliente de plano Free atribua **WeatherAPI.com** por nome ou logotipo, e que um aplicativo para usuário final apresente aviso claro de limitação e não use dados como única fonte para decisões sobre segurança, emergência, aviação ou navegação marítima. Uma mesma chave/assinatura é restrita a **um serviço/aplicativo**; o servidor deve compartilhar o cache com todos os assinantes do **Blaise V6 RJ**, nunca criar chave pública ou consultas por usuário. Cache: **atuais no máximo 60 minutos, previsão no máximo 24h, históricos sem limite**, sempre sujeitos à validade da medição/modelo. A API não permite revender o conjunto bruto de dados nem transferir a chave.

## Funções e limites meteorológicos

| Classe | Candidatos úteis | Natureza e cautela |
|---|---|---|
| E — condições atuais agregadas | Temperatura, sensação, umidade, vento, rajadas, pressão, precipitação atual quando fornecida | API agrega múltiplas fontes/modelos e não garante estação física identificada para cada valor. Não classificar E como O. Ausente => indisponível |
| P — previsão horária até três dias Free | Temperatura, vento, chuva/possibilidade e demais produtos retornados pelo plano real | Não é observação de pluviômetro, instrumento ou marégrafo |
| Alertas/qualidade do ar | Recursos limitados no Free | Dados condicionados por região e plano; **não** emitir avisos oficiais com base apenas neste serviço |
| Marinho/radar/chuva minuto a minuto | Consultar plano/limites oficiais | Não presumir acesso no Free: chuva minuto a minuto, dados marítimos avançados, mapas satélite/raios podem exigir plano superior |

**Independência de fonte:** a documentação da WeatherAPI.com informa composição a partir de modelos e fontes internacionais, incluindo ECMWF, NOAA/GFS e outros. Não contar a mesma previsão vendida por outro provedor como uma terceira medição meteorológica independente.

## Compatibilidade com 92 municípios e a interface original

**Um GET horário por município:** 92 × 24 × 31 dias = **68.448 chamadas por mês de 31 dias**. Proposta futura de teto compartilhado **80.000/mês**, deixando 11.552 chamadas internas de margem e 31.552 abaixo do limite nominal 100.000 em meses de 31 dias. Uma consulta a cada 30 minutos exigiria 136.896 chamadas/mês de 31 dias, além da franquia. Os números são **projeção offline**, não disponibilidade real, saldo usado nem confirmação de que o fornecedor atende todos os códigos/latitudes do RJ.

Foi criado `backend/src/rj-weatherapi-free-92-plan.mjs` exclusivamente para projeção offline, com `backend/test/rj-weatherapi-free-92-plan.test.mjs`, sem backend collector, sem cron e sem credencial.

A entrada `WEATHERAPI_FREE` foi incorporada **somente ao catálogo de fontes** da interface original `WeatherSourceResponsibility.kt` e à memória científica administrativa com estado `UNVERIFIED_NO_ACCOUNT_OR_SAMPLE`. `currentlyIntegratedProduct=false`. Ainda **não existem valores numéricos reais WeatherAPI.com para apresentar**. Não bloquear, apagar ou substituir a UI original: duas localidades, mapa meteorológico próprio RJ, painéis de alertas, gráficos, voz, memórias, calculadora, 14 agentes e 19 métodos ficam preservados.

## Antes de homologar, conectar ou coletar

1. A titular confirma se já cadastrou uma conta WeatherAPI.com Free, com **100.000 chamadas/mês**, top-up manual, **sem plano pago** e sem meios de cobrança automática.
2. Armazenar chave exclusivamente no **GCP Secret Manager**, nome reservado `blaise-weatherapi-free-api-key` (somente criar **após** a titular confirmar a conta). Nunca enviar a chave ao chat, APK, GitHub, print ou URL de log. Testar formato sem exibir o segredo.
3. Construir **um teste real privado e de uma única chamada**, Rio IBGE 3304557, após verificar orçamento e permissões no Firestore. Checar latitude/longitude, `location` e `current` + `forecast`, campos numéricos, timestamps UTC, unidade e proveniência; nunca converter risco modelado em aviso oficial.
4. Antes de chamadas regulares, criar ledger atômico Firestore **mensal** com controle agregado de todos os workers, margem de 20%, checagem de saldo externo, regra de no-auto-charge e cache com TTL fornecedor (60m/24h); nenhuma chamada direto do app Android do cliente.
5. Validar termos atuais, atribuição e aviso visível ao usuário, cobertura e quotas reais, regras Firestore e IAM; depois obter aprovação explícita para qualquer implantação ou mudança de tráfego.

**Decisão atual:** incluir como **candidata de alto potencial** para lacunas de condições atuais/temperatura e previsão 72h, não como fonte ativa. Sem custos, consultas, alterações de produção ou liberação para clientes.
