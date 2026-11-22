# Blaise V6 RJ — Visual Crossing + WeatherAPI.com na interface oficial (22/11/2026)

## Autorização recebida e limites de significado

O proprietário autorizou **preparar e incorporar em desenvolvimento** as duas fontes adicionais **Visual Crossing** e **WeatherAPI.com** ao Blaise V6 RJ (92 municípios). Essa autorização **não equivale** a contrato/licença de redistribuição verificada, chave existente no Secret Manager, consulta meteorológica nova, execução continuada de 92 coletores, implantação, merge ou publicação aos clientes.

- **Visual Crossing:** conta cadastrada, resposta real de 19/11 já registrada em staging privado; uma chamada reservada na campanha de teste, sete campos E atuais e 36 intervalos P possíveis. O orçamento de teste continua fechado. Existe cache privado e projeção para assinantes, mas liberação efetiva depende de verificação legal/atribuição, QA, rotatividade de chave e autorização operacional.
- **WeatherAPI.com:** cadastro informado; o Cloud Shell de 22/11 11h53 mostrou segredo `blaise-weatherapi-free-api-key` **não encontrado** em `blaise-v6-rj`. Isso não prova ausência da chave na conta; ainda não existe prova de consulta autenticada. Nenhuma chave foi criada ou colocada no repositório.
- **INMET** continua árbitro privado **somente em conflitos** entre duas fontes Blaise comparáveis; dados do INMET não entram nos JSONs do cliente. Sem revisão admissível, o conflito térmico é retido, nunca substituído por média ou valor inventado.
- **OpenWeather** permanece contingência especial, máximo **1 chamada global/dia UTC** no código, não atualização térmica a cada 35 minutos.
- **HG Brasil Pro** continua para futura contratação; DWD/ICON permanece previsão P. Climatempo radar permanece condicionado à contratação e licença, não integrado como radar ativo.

## Campos da interface implementados

| Campo para município escolhido | Visual Crossing | WeatherAPI.com | Exibição |
| --- | --- | --- | --- |
| Temperatura e sensação térmica (°C) | E, valor agregado por cidade | E, agregado por cidade | Fonte e hora de validade independentes; divergência retida |
| Céu: sol, nublado, parcialmente nublado, chuva, trovoada | Só após mapear código de produto validado | Códigos meteorológicos `condition.code` conhecidos | **Condição estimada**, jamais alerta oficial ou prova de tempestade real |
| Umidade relativa (%) | E | E | Campos atuais do painel da cidade |
| Vento / rajadas (km/h) | E conforme campo disponível | E | Camada Ventos do mapa e painel |
| Chuva atual (mm) | E, não pluviômetro observado | E, não pluviômetro observado | Camada chuva e gráfico (ponto atual) |
| Probabilidade / chuva da próxima hora | Previsão P quando o cache inclui próximo intervalo | **Não** obtida por `current.json` | Painéis de previsão, não somados ao observado |
| Nebulosidade (%) | Depende de contrato e produto, ainda sem campo no cache projetado | E via `cloud` | Condição do céu/estimativa |
| Pressão (hPa) | E | E | Painel da cidade |
| UV | Sem campo na projeção atual | Índice agregado, não sensor local | Painel da cidade |
| Radar, nuvens raster, ciclone, chuva acumulada observada, alertas 4/5 | **Não** | **Não** | Sem dados homologados = indisponível |

O cliente Android foi modificado para consumir dois novos campos opcionais no mesmo snapshot autenticado `/v1/data/dashboard` **somente quando o backend realmente os publicar**:
- `weatherApiCurrent`: código IBGE, horário fornecido pela fonte `last_updated_epoch`, horário do cache, temperatura, sensação, umidade, vento/rajada, precipitação estimada, nuvens, pressão, UV e condição do céu. Parser estrito rejeita chaves não reconhecidas, valores fora do intervalo, segundos vencidos, alertas falsos e ausência de município válido.
- `approvedThermal`: ponte condicional que conserva registros individuais de `VISUAL_CROSSING_FREE` e `WEATHERAPI_FREE` como E, com origem e instante de validade. Divergência maior que 4 °C de temperatura ou 6 °C de sensação entre fontes próximas em até 15 min bloqueia o campo em vez de eleger arbitrariamente um vencedor. O desempate autorizado via INMET requer revisão **privada e separada**, ainda não conectada a esse release.

**Padrão de segurança**: `readWeatherApiPrivateCache=null`, `weatherApiSubscriberReleaseApproved=false`, `weatherApiThermalRedistributionApproved=false`, `visualCrossingSubscriberReleaseApproved=false`, `visualCrossingThermalRedistributionApproved=false`. O handler não consulta o provedor. Sem cache verificado/licença liberada, o campo é omitido e a tela diz `Indisponível`; em nenhum caso uma consulta do cliente consome franquia WeatherAPI/VC.

## Coletores e planos

- `backend/src/rj-weatherapi-free-92-collector.mjs`: futuro coletor privado `current.json` por coordenada do município. **Inativo**; exige flags separadas para licença comercial, saldo/termos, projeto/segredo, permissão da titular, política de plano gratuito e reserva de cota antes do GET. Faz parse por campo sem copiar `condition.text` nem URL/chave. Nunca publica diretamente ao cliente.
- `backend/src/rj-weatherapi-free-monthly-budget.mjs`: reserva transacional Firestore compartilhada para 80.000 chamadas/mês UTC, com intervalo mínimo de 25 min por município. Só controla as reservas internas. Não conhece chamadas feitas fora do Blaise; exige conferência externa do saldo e ausência de cobrança.
- A oferta WeatherAPI Free é de **100.000 chamadas/mês**: 92 cidades **uma vez por hora** durante um mês de 30 dias equivalem a 66.240 chamadas; 92 cidades **a cada 30 min** equivalem a 132.480 chamadas/mês, excedendo a cota. Planejamento selecionado 25–35 min depende do orçamento compartilhado e do horário real publicado pela fonte, não da frequência de consulta ao servidor.
- Visual Crossing Free oferece **1.000 registros/dia**, não necessariamente equivalentes a 1.000 solicitações. Retornar horas/dias pode consumir vários registros; não reabrir o coletor sem saldo confirmado e orçamento atômico adequado ao pacote realmente solicitado.
- Segundo a documentação da Visual Crossing publicada em outubro/novembro de 2026, há uso comercial gratuito com **atribuição**; a distribuição de **dados brutos** depende de direitos do plano. O texto de atribuição fica próximo dos campos no aplicativo. Exigir revisão da licença para assinatura comercial antes de alterar a flag de release.
- WeatherAPI Free informa uso comercial leve permitido, sujeito aos termos e cota da conta. Não confundir disponibilidade de `current.json` com radar em tempo real ou observação oficial.

Fontes externas de referência:
- https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/
- https://www.visualcrossing.com/weather-service-terms/
- https://www.weatherapi.com/pricing
- https://www.weatherapi.com/docs/realtime-api/

## Retomada segura 22/11 — horários e preflight sem chaves

A revisão dos testes Android de 22/11 encontrou duas expectativas anteriores incorretas: o teste de OpenWeather tentava interpretar como válida uma medição já vencida, e o teste administrativo esperava o texto antigo de "quota" do Agente 13. Os testes foram ajustados sem retirar os limites de frescor ou a política de desempate INMET. **A evidência final do CI da nova revisão é necessária antes de homologar.**

A apresentação de E válido da WeatherAPI pode permanecer por até **35 minutos a partir da medição original** `last_updated_epoch`, mesmo quando a consulta foi realizada há mais de 12 minutos. O relógio nunca é renovado artificialmente; caso chegue ao limite, a interface exibe `Indisponível`. A Visual Crossing permanece até 30 minutos. O cache Firestore privado `rj-weatherapi-free-private-cache.mjs` salva exclusivamente os 92 IBGE autorizados, valores normalizados, condição por código, timestamps e metadados, sem copiar chave ou texto livre do provedor; a leitura revalida prazo e geografia. **Não há conexão de runtime/deploy habilitada**.

O preflight de metadados `backend/scripts/rj-free-weather-secret-metadata-readonly.sh` confere apenas a existência e versões **ENABLED** dos segredos `blaise-weatherapi-free-api-key` e `blaise-visual-crossing-free-api-key` no projeto `blaise-v6-rj`. Rodar somente em Cloud Shell autenticado, dentro do repositório, com:
```bash
bash backend/scripts/rj-free-weather-secret-metadata-readonly.sh
```
Este procedimento **não lê conteúdo de nenhuma versão**, não altera permissões/IAM, não liga Cloud Run e não consome chamadas. `NOT_FOUND` é diferente de `UNKNOWN_OR_PERMISSION_DENIED`. Metadados positivos **não** comprovam chave válida nem habilitam sua publicação: será necessário um único teste controlado posterior sujeito a saldo e autorização.

## Testes e revisão necessários

Arquivos novos de teste:
- `backend/test/rj-weatherapi-free-client-projection.test.mjs`
- `backend/test/rj-weatherapi-free-92-collector.test.mjs`
- `backend/test/rj-weatherapi-free-monthly-budget.test.mjs`
- `backend/test/rj-vc-weatherapi-thermal-bridge.test.mjs`
- `app/src/test/java/br/com/blaise/rj/DashboardWeatherApiCurrentTest.kt`
- `app/src/test/java/br/com/blaise/rj/ApprovedThermalDisplayTest.kt` ampliado

**Pendências operacionais objetivas:** chave WeatherAPI existente deve ser provisionada em Secret Manager com identidade mínima sem exibi-la; resposta real controlada (uma chamada com cota e horário) ainda precisa ser comprovada; validar Visual Crossing licença e registros reais; instalar leitor de cache privado injetado no runtime com parâmetros de autorização distintos; homologar IAM, cotas compartilhadas 92 cidades, qualidade por cidade/região e seletor, testes Android com interface; obter autorização separada antes de implantação. Os 14 agentes, calculadora científica, mapa original, backups, Cloud Run atual, PR #173, tráfego 99%/1% e APK instalado são preservados.

**Nenhuma alteração nesta PR acionou API meteorológica real, contratação, pagamento, leitura de chave, Cloud Run deploy, merge, Play Store ou substituição do APK atual.**


## Validação real WeatherAPI V2 — 22/11/2026, 14h52 BRT

O operador executou **uma única consulta controlada** a `https://api.weatherapi.com/v1/current.json` no **Cloud Shell**, fora da PR e fora do runtime, usando a versão **2** do segredo `blaise-weatherapi-free-api-key` do projeto `blaise-v6-rj`. Tela enviada às 14h52 BRT registra **`WEATHERAPI_V2_OK` (HTTP 200 implícito pelo tratamento do script)**, com chave não impressa. A versão 2 constava `ENABLED`; a versão 1, `DISABLED`. O binding IAM `roles/secretmanager.secretAccessor` foi concedido ao serviço `blaise-cloud-run-runtime` apenas para esse segredo. **A leitura efetiva assumindo a conta do Cloud Run NÃO foi demonstrada**, pois a impersonação pelo Cloud Shell falhou por falta de `iam.serviceAccounts.getAccessToken`. A consulta válida demonstra autenticação da **chave no fornecedor** pela sessão do usuário, não homologação de execução Cloud Run.

### Snapshot real validado — local consultado Rio de Janeiro (-22.9068,-43.1729)

| Dado da WeatherAPI | Valor retornado |
| --- | --- |
| `temp_c` | **31.1 °C** |
| `feelslike_c` | **35.5 °C** |
| `humidity` | **61%** |
| `cloud` | **93%** |
| `wind_kph` | **6.1 km/h** |
| `gust_kph` | **20.1 km/h** |
| `precip_mm` | **0.17 mm** no campo de condições atuais, **não acumulado diário** |
| `pressure_mb` | **1007.0 mb (hPa)** |
| `uv` | **8.2** |
| `condition.code` | **1153** = light drizzle / **garoa fraca**; categoria simplificada `CHUVA`, **não tempestade** |
| `last_updated_epoch` como UTC | **2026-11-22T17:45:00+00:00** = **14h45 BRT** |
| Idade informada | **7.4 minutos** na consulta às ~14h52 BRT |

Fontes documentais para código e natureza dos campos: https://www.weatherapi.com/docs/weather-icons/ e https://www.weatherapi.com/docs/realtime-api/ . **Não há comprovação de estação física ou pluviômetro próprio naquela coordenada**, nem de radar, chuva observada acumulada, alerta oficial ou atualização contínua. A medição ficou dentro da política de 35 minutos **no instante do teste** e deve ficar `Indisponível` após expiração. Foi acrescido um teste de regressão offline que aplica os campos do snapshot ao parser projetor com relógio congelado, sem retornar chave nem publicar a medição histórica como atual.

### Ações pendentes após a prova real

1. Confirmar identidade e leitura do segredo **pelo runtime em ambiente isolado/sem tráfego**, sem atribuir `Service Account Token Creator` ao usuário só por conveniência, antes de qualquer deploy.
2. Homologar o consumo da cota WeatherAPI Free e as permissões de redistribuição; guardar atribuição na interface e não abrir todos os 92 coletores de uma vez.
3. Conectar `readWeatherApiPrivateCache` ao backend em homologação **após** autorização separada e teste dos controles de cota, validação por IBGE e freshness; sem ativação em produção nesta etapa.
4. Para concorrência entre dados Blaise, continuar retendo valores conflitantes e usar INMET **somente como referência privada** se houver revisão de estação/horário comparáveis. Não publicar INMET na interface.

**Estado de homologação atualizado:** chave principal v2 e `current.json` funcionaram numa chamada real; o código de desenvolvimento está preparado e em testes. **Ainda não** existe coletor WeatherAPI ativo no Cloud Run nem liberação dos resultados na interface pública. Sem merge/deploy/tráfego alterado por esta atualização documental.


## Auditoria das revisões em produção — 22/11/2026, 17h23 BRT

Evidência de leitura **somente de metadados** enviada pelo operador, sem alteração GCP:

- Cloud Run `blaise-v6-rj-backend`, projeto `blaise-v6-rj`, região `southamerica-east1`.
- Revisão `blaise-v6-rj-backend-00031-vep`: **99%** do tráfego; nenhum `secretKeyRef` localizado com nomes de ambiente `BLAISE_OPENWEATHER_API_KEY` nem `BLAISE_REDEMET_API_KEY` na configuração de contêiner inspecionada.
- Revisão `blaise-v6-rj-backend-00038-pin`: **1%** do tráfego; idem, referências não encontradas nos nomes pesquisados.
- A ausência nessas duas revisões **não prova** ausência de credenciais por SDK, cache ou outros caminhos, nem prova saúde de runtime ou acurácia de dados.
- Modelo atual do serviço exibe OpenWeather segredo `blaise-rj-openweather-api-key` versão **2**, REDEMET `blaise-rj-redemet-api-key` versão **1**. Versões OpenWeather 1 **DISABLED**, 2 **ENABLED**, REDEMET 1 **ENABLED**.
- Revisão histórica e **sem percentual de tráfego** `blaise-v6-rj-backend-00058-sos`: OpenWeather v1 desativada e REDEMET v1; três HTTP 500 históricos nas rotas `/readyz` (11:14:06Z, 11:26:08Z) e `/health` (11:26:07Z), em 21/11/2026. As requisições foram rápidas e a causa **não está comprovada**. Não reativar versão 1 nem mutar esta revisão.
- O CI do head `92f290cb2acd0b24d8cb6048b2b4c17a6d4b381a` da PR #174 concluiu em **success** nos jobs backend, Android verify, auditoria meteorológica e Visual Crossing security gate (checagem via GitHub, 22/11/2026). Esta evidência não autoriza deploy.

Próxima ação de engenharia: planejar em código (não executar) um ambiente isolado/sem tráfego com leitura da WeatherAPI v2 e cache privado, controles de franquia desligados e avaliação explícita de licença; solicitar autorização separada antes de criar qualquer revisão, job ou liberar o cliente. Preservar a produção 99%/1%, os 92 municípios, os 14 agentes, a PR #173, as chaves, o APK original e backups.
