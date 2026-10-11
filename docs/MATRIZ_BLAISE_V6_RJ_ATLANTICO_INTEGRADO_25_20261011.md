# Matriz Blaise V6 RJ — Atlântico Integrado | 25 Fenômenos

**Versão:** 2026-10-11 — Atlântico Integrado V1
**Território exclusivo:** 92 municípios do estado do Rio de Janeiro, litoral fluminense e partes do Atlântico com potencial impacto no RJ. **Não misturar outros estados.**
**Status:** matriz aprovada como especificação em PR #102; cadastro de fontes adicionais e adaptador OpenWeather de servidor implementados, **sem garantia de coleta ao vivo**, licença/conta/chave de serviço ainda não atestadas; Copernicus Marine e EUMETSAT precisam de produtos georreferenciados definidos.

A matriz de **25 fenômenos numerados** é uma tabela de apresentação, interoperável com as **28 regras especializadas já cadastradas** em `backend/src/rj-user-source-priority-policy.mjs`. Nenhuma regra das outras categorias foi apagada ou trocada de número.

| Nº | Fenômeno | Hierarquia oficial/preexistente (conforme local e produto) | Nova fonte complementar e finalidade |
|---:|---|---|---|
| **1** | Temperatura | Alerta Rio (cidade do Rio), Defesa Civil RJ, INMET | **OpenWeatherMap:** temperatura pontual agregada/modelada; não estação INMET |
| **2** | Sensação térmica | Alerta Rio, Defesa Civil, INMET + cálculo Blaise | **OpenWeatherMap:** `feels_like` do produto, diferente do cálculo independente |
| **3** | Chuva atual e acumulada | Alerta Rio (Rio), Defesa Civil RJ, INMET, CEMADEN conforme evento | **OpenWeatherMap:** chuva da última hora quando disponível; **não** inventar 24 h |
| **4** | Previsão de chuva | INMET, INPE/CPTEC e produtos de previsão autorizados | **OpenWeatherMap:** previsão conforme endpoint/plano contratado (API Current não dá probabilidade) |
| **5** | Temporais/tempestades | Defesa Civil/Alerta Rio, INMET, CEMADEN | **OpenWeatherMap:** condições meteorológicas/modelos, não aviso oficial |
| **6** | Vento sustentado/direção | Alerta Rio, Defesa Civil, INMET | **OpenWeatherMap:** vento e direção em coordenada válida |
| **7** | Rajadas de vento | Defesa Civil, INMET, Alerta Rio quando houver estação | **OpenWeatherMap:** rajada do produto quando presente, não criar dado ausente |
| **8** | Pressão atmosférica | INMET e fontes barométricas pertinentes | **OpenWeatherMap:** pressão do produto, validar referência ao nível do mar |
| **9** | Umidade relativa | Alerta Rio, Defesa Civil, INMET | **OpenWeatherMap:** umidade de produto agregado, não medição oficial independente |
| **10** | Granizo | Defesa Civil, INMET, radar/rede autorizada | **OpenWeatherMap:** contexto meteorológico, **não** detecção direta confirmada de granizo pela API Current |
| **11** | Raios | NOAA GOES GLM + rede terrestre autorizada | **EUMETSAT:** lightning imager/satélite **se footprint incluir RJ**; **Copernicus Marine** consta na consulta mas **não tem produto direto de raios** |
| **12** | Ciclones e tempestades extratropicais | Marinha, INMET, NOAA, INPE | **Copernicus Marine:** ondas/correntes/SST; **EUMETSAT:** nuvens, massas de ar e ventos satelitais conforme área coberta |
| **13** | Ondas | Marinha/CHM, boias, NOAA | **Copernicus Marine:** altura, período e direção; **EUMETSAT:** altimetria/vento oceânico quando produto adequado |
| **14** | Ressaca | Avisos da Marinha/CHM | **Copernicus Marine:** estado do mar; **EUMETSAT:** vento/ondas; **não substituem alerta oficial de ressaca** |
| **15** | Marés e nível do mar | Marinha/CHM, marégrafos oficiais | **Copernicus Marine:** nível oceânico/modelo; **EUMETSAT:** altimetria; não equivalem à tabela local de marés |
| **16** | Temperatura do mar | NOAA, boias e satélites oficiais | **Copernicus Marine:** SST; **EUMETSAT:** SST satelital com cobertura confirmada |
| **17** | Tsunami sísmico/meteorológico | NOAA + Marinha + autoridade brasileira competente | Mantido — sem inserção automática de fornecedor europeu não especializado em aviso de tsunami |
| **18** | Nível e vazão dos rios | ANA, SGB/SACE, redes oficiais | Mantido; INEA continua excluído |
| **19** | Cheias, enchentes e inundações | Defesa Civil RJ, SGB/SACE, CEMADEN, ANA | Mantido |
| **20** | Deslizamentos | Defesa Civil, Geo-Rio, CEMADEN | Mantido |
| **21** | Abalos sísmicos | USGS + redes sismológicas oficiais | Mantido |
| **22** | Alagamentos | Defesa Civil RJ, CEMADEN, ANA/SGB conforme local | **Copernicus Marine:** influência oceânica/coastal flood; **EUMETSAT:** nuvens/chuva/satélite; **não confirmam alagamento de rua** |
| **23** | Trânsito/interdições | COR.Rio, CET-Rio, Defesa Civil e órgãos rodoviários | Mantido |
| **24** | Calor extremo e índice UV | Monitora RJ/SES, INMET e fontes competentes UV | **Copernicus Marine:** calor oceânico/SST como contexto; **EUMETSAT:** atmosfera/superfície como contexto; **não substituem índice UV nem aviso de saúde** |
| **25** | Qualidade do ar | MonitorAr-Rio/SMAC e redes oficiais | Mantido, sem reintroduzir INEA |

## Aplicação de prioridade e desempate

1. **Rio município:** Alerta Rio → Defesa Civil → INMET, conforme observação realmente publicada para a variável. **Demais 91 municípios:** Defesa Civil por competência → INMET conforme estação/produto. Municípios de divisa continuam exclusivos RJ; não atribuir uma estação de outro estado ao RJ.
2. Duas **medições oficiais independentes, atuais, geograficamente próximas e compatíveis** bastam para média ponderada (pesos calibrados e justificados). Se divergirem, buscar a terceira fonte oficial.
3. Persistindo divergência, **INPE/CPTEC primeiro**, depois **Windy somente se necessário** como comparação entre previsão e observação. Mostrar uma medição oficial e uma previsão rotuladas separadamente, preservando todas as medições originais. **Não** tirar média de estação com modelo; nenhuma aproximação de modelo comprova estação defeituosa.
4. **OpenWeatherMap** entra nos itens 1–10 como fonte **complementar agregada/modelada**, não substitui observação oficial, aviso da Defesa Civil/Marinha nem conta como segunda estação independente. Produtos derivados podem compartilhar dados/modelos com Windy/NOAA/INPE: detectar origem republicada e evitar dupla contagem.
5. **Copernicus Marine e EUMETSAT** só fornecem dados nos itens 11–16, 22 e 24 **quando o produto exato, variável, footprint no Atlântico do RJ, resolução, horário, latência, qualidade e direito de uso forem demonstrados**. Não pegar apenas imagens de um visualizador e rotulá-las como camada própria em tempo real.
6. Se não houver o produto adequado ou autorização válida, mostrar a medição ou informação realmente disponível **com fonte e horário**; não inventar dado, faixa de gravidade, radar colorido nem aviso de segurança. Somente **categoria 5** pode produzir aviso sonoro, após autoridade e revalidação independentes.
7. Dados atuais 1–5 min conforme publicação e licença; situações de nível 4/5 podem ter reavaliação interna mais frequente, **não** fazer polling externo além de quota, disponibilidade ou contrato.

## Referências oficiais, uso comercial e segurança

| Origem | Consulta / produto | Condição para ativação |
|---|---|---|
| OpenWeatherMap | https://openweathermap.org/ e [Current Weather API](https://openweathermap.org/api/current) | Plano e quota conferidos; atribuição visual **Weather data provided by OpenWeather**. Verificar licença ODbL e uso de base derivada. Servidor guarda **somente** `OPENWEATHER_API_KEY` em Secret Manager/env protegida; **não** publicar chave no GitHub nem embarcar em `BuildConfig`/APK. |
| Copernicus Marine | https://marine.copernicus.eu/access-data/myocean-viewer e https://data.marine.copernicus.eu/ | Usar produto/dataset por variável; acesso programático via **Copernicus Marine Toolbox** com recorte geográfico; registro/licença e citação de **produto e DOI**. Visualizador não equivale a uma API de dados pronta. |
| EUMETSAT | https://view.eumetsat.int/ e https://data.eumetsat.int/ | Selecionar produto do Data Store, EUMDAC/serviço autorizado; confirmar pegada satelital que cubra o RJ, licença e crédito do produto. Conteúdo do site e dados de satélite não têm necessariamente a mesma licença. |

**Segurança do proprietário:** credenciais fornecidas em chat não devem ser transferidas para documentação, relatórios ou repositório público. **Revogar/rotacionar a senha e a chave divulgadas; registrar novos valores exclusivamente no gerenciador de segredos do servidor.** Não executar compras, contas externas, alteração de assinatura nem publicação automaticamente.

### Arquivos da integração

- `backend/src/rj-matriz-atlantico-25.mjs` — tabela numerada, função `rjAtlanticMatrixRow` e validação de produto europeu `europeanProductUsableForPhenomenon`.
- `backend/src/rj-phenomenon-source-policy.mjs` — mantém autoridades e expõe metadados de complementos por fenômeno sem autorizar alertas.
- `backend/src/rj-openweather-current-adapter.mjs` — adaptador **somente servidor** para produto Current Weather; faltam segredo rotacionado, licença/conta e instalação no worker para consulta contínua.
- `app/src/main/java/br/com/blaise/rj/RjAtlanticMatrixSpec.kt` e `MainActivity.kt` — painel interativo em **Mais → Matriz Atlântico Integrado**, com filtros 1–10, 11–16, 17–25 e status de indisponibilidade.
- `backend/test/rj-matriz-atlantico-25.test.mjs` e `backend/test/rj-openweather-current-adapter.test.mjs` — critérios de segurança, correspondência e presença de fontes.

**Gate de liberação:** somente após CI Android/backend, autorização de uso por produto, configuração segura no GCP e testes de ingestão ao vivo com horário/município/qualidade. PR Draft não equivale a implantação no celular.
