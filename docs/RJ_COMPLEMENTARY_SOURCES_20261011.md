# Blaise V6 RJ — Terceira consulta e fontes oceânicas/satélite

**Versão de cadastro:** `2026-10-11.v2`  
**Aplicação:** somente Rio de Janeiro (92 municípios RJ + Atlântico pertinente).  
**Estado:** política e links da interface cadastrados, sem evidência de integração de API ativa, acesso contratado, cache operacional ou homologação.

## Tabela 1: terceira consulta complementar (itens de 1 a 10)

A prioridade conjunta de fontes locais é **Alerta Rio** somente no município do Rio, quando houver produto apropriado, e **Defesa Civil RJ**, conforme competência e disponibilidade. O **OpenWeatherMap** é a terceira consulta *complementar* de visualização/comparação de produtos, **não** uma terceira autoridade ou terceira estação oficial. O INMET mantém prioridade para observações elegíveis de estação; INPE/CPTEC e Windy permanecem no fluxo de desempate com os limites já definidos. Fontes republicadas não contam como duas medições independentes.

| Item | Variável | Particularidade |
|---:|---|---|
| 1 | Temperatura | Respeitar município, altitude e horário |
| 2 | Sensação térmica | Entradas reais e domínio de cálculo físico |
| 3 | Chuva atual | Produto adequado ao intervalo; sem fabricar medição de 1–5 min |
| 4 | Chuva acumulada | Mesma janela e mesma unidade |
| 5 | Chuva intensa e temporal | Aviso oficial prevalece; não fazer média de alertas |
| 6 | Vento sustentado | Unidade, altura e intervalo explícitos |
| 7 | Rajadas fortes | Diferenciar rajada máxima de vento médio |
| 8 | Pressão atmosférica | Referência altimétrica e mesmo horário |
| 9 | Umidade relativa | Estação/grade e georreferência identificadas |
| 10 | Granizo | API de previsão não comprova evento, confirmação por autoridade |

Portal: https://openweathermap.org/ . Para uso no aplicativo, obter chave API e licença compatível para produto, volume de chamadas, uso comercial e redistribuição. Proteger a chave exclusivamente no backend por armazenamento seguro (como Secret Manager); APK, repositório e interface não podem conter senha ou chave.

**Importante:** estes 10 itens são uma seção explícita de consulta meteorológica dentro da Tabela 1 da interface. A matriz técnica original de **25 categorias** permanece intacta, assim como a Tabela 2 de **8 critérios de desempate**. O backend reutiliza o identificador `CHUVA_ACUMULADA` para chuva atual/acumulados conforme o produto e sua janela; não existe feed independente de chuva atual implementado nesta mudança.

## Mar e oceanografia — prioridades e visualizadores

| Fenômeno | Fontes e função |
|---|---|
| Ciclone sobre o Atlântico | Marinha/CHM, NOAA, EUMETSAT (imagem atmosférica), Copernicus (efeitos no oceano), INMET quando aplicável |
| Tempestades marítimas | Marinha/CHM, NOAA e satélite EUMETSAT conforme produto |
| Ondas, swell e ressaca | Marinha/CHM prioritária nos avisos, NOAA e Copernicus Marine em produtos de ondas, altura, período/direção |
| Marés, correntes e temperatura do mar | Marinha/CHM e produtos específicos do Copernicus/NOAA, com resolução e datum consistentes |
| Tsunami e meteotsunami | **Somente alertas e confirmação das autoridades competentes**: Marinha/CHM, NOAA e Defesa Civil/autoridades brasileiras; origem sísmica USGS quando pertinente |

- MyOcean: https://marine.copernicus.eu/access-data/myocean-viewer
- Copernicus Pro: https://data.marine.copernicus.eu/viewer/expert?view=viewer
- EUMETSAT EUMETView: https://view.eumetsat.int/

A imagem de satélite não comprova ciclone ou inundação sem análise adequada. Ondas de tempestade, swell e modelagem de ondas não comprovam tsunami e não podem disparar alarmes de tsunami.

## Interface / engenharia

- **Mais → Matriz Meteorológica → Tabela 1** mostra a seção 1–10 e a matriz completa de 25 itens. A Tabela 2 e os cálculos ficam preservados.
- **Mais → Fontes oficiais** identifica a terceira fonte complementar e abre o portal OpenWeatherMap.
- **Mar e Ondas** preserva Marinha e NOAA como fontes prioritárias e adiciona links aos dois visualizadores Copernicus e EUMETSAT, com indicação de integração pendente.
- O painel principal marítimo apenas informa as fontes; nenhum valor fictício, onda, aviso de ciclone ou estado de segurança é exibido como observado.
- Novas fontes estão registradas em `backend/src/rj-phenomenon-source-policy.mjs` com `dataAvailability=REQUIRES_LIVE_VALIDATION` e `automaticAlertAuthority=false`; isso **não é** um coletor de dados da OpenWeatherMap ou do Copernicus.
- Para coleta futura: exigir identificação do produto, horário, geolocalização, unidade, licença, proveniência, atualização, tratamento de indisponibilidade e testes operacionais com dados reais. Dados agregados não podem ser contados em duplicidade.

**Credenciais:** nunca publicar login, senha, token ou chave de API neste documento ou em artefatos Android. Uma senha informada numa conversa deve ser substituída antes do uso de produção.
