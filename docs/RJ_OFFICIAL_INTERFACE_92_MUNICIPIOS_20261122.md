# Blaise V6 RJ — interface oficial aprovada e ligação segura de dados (22/11/2026)

**Referência aprovada pela titular:** última imagem do dashboard Blaise V6 RJ nesta conversa: cabeçalho azul neon com Blaise e microfone, dois municípios, mapa central RJ+Atlântico, três alertas oficiais na faixa superior, tráfego em painel separado e **três maiores terremotos recentes** na caixa inferior direita. A imagem **não fornece medições reais** (mostra data 15/09/2026 e números ilustrativos). Não reproduzir esses números, avisos de nível 4 nem sismos como evento ao vivo. A identidade visual e a disposição são alvo da variante Android, não artefato meteorológico reutilizável. Nenhum segredo nem foto com chave entra no Git.

## Status da implementação desta PR

**Branch:** `feature/rj-official-dashboard-92-alerts-sismos-20261122`, derivada da PR #173, **draft**. Código de desenvolvimento, **sem instalação no aparelho, sem APK assinado, sem merge, sem deploy, sem alterar main ou o tráfego 99%/1%**.

| Componente | Código nesta branch | Limitações verificadas |
|---|---|---|
| Municípios | Lista IBGE 92 e escolha da Cidade 1/2 já existente; mapa central agora acompanha a Cidade 1, contorno dourado no polígono IBGE selecionado | Não comprova 92 medições atuais; regiões geográficas no seletor ainda não possuem recorte/homologação de geometrias |
| Camadas do mapa | Radar; temperatura e sensação; chuva e acumulado; tempestades; ondas de calor; qualidade do ar; ventos/ciclones | Radar não possui pixels/fonte licenciados homologados; nunca pintar chuva fictícia. Dados de temperatura/vento/previsão somente de snapshots assinados válidos, quando disponíveis |
| Gráficos | Abas temperatura, sensação térmica, chuva e acumulado da cidade escolhida; exibe dado pontual com origem quando existe | Não inventa série histórica, curva de 24h ou acumulado observado; todos indisponíveis sem dados reais |
| Intervalo dos dados | Trava geral projetada para 30 min; Visual Crossing E verificado até 30 min, MET Norway ECMWF P usa validação de emissão/checagem existente | Dados modelados P não são observação O nem radar. Revalidação do lado do servidor e cobertura 92/92 não homologadas |
| Alertas oficiais | **Três** cartões superiores com frases próprias e links Alerta Rio, Defesa Civil RJ, INMET e INPE/CPTEC; prioridade a evidências validadas, demais em "Saiba mais" | Sem evidência ativa, cartão neutro. **Nenhum** portal/link sozinho cria um alerta nível 1–5 |
| Escala 1–5 | Cinco cores; níveis 4 e 5 **bloqueados** sem flags científicas de entradas em tempo real e recálculo feito nos últimos 20 s | O motor científico marítimo e meteorológico 20 s **não foi homologado/ativado**. A regra de apresentação evita falso alerta; não declara que o cálculo corre no backend |
| Trânsito | Painel próprio da Cidade 2 e tela Trânsito: só links diretos para CET-Rio, Ecovias Ponte, DER-RJ, e legenda verde/amarelo/vermelho | Sem fonte oficial atual assinada não mostra **verde "trânsito estável"** nem copia ocorrências; estado "indisponível". Trânsito/CET/Governo removidos das camadas do mapa meteorológico |
| Sismos | `UsgsRecentEarthquakes` consulta `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson` no Android **apenas quando tela ativa**: três eventos de maior magnitude nos últimos 7 dias, desempate por recência, data/local/magnitude, URL por evento, link "todos" USGS. Validação da idade do feed em 30 min e limite de bytes | Não constitui alerta sísmico/tsunami para o RJ nem garante que o endpoint esteja acessível na máquina do cliente; se falhar, mostra indisponível. Não usa chaves/meteo/cliente/localização. Fonte: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php |

### Fronteiras rígidas de fontes

- **Meteoblue Free**: 7 campos P, 29 períodos de 6h da consulta de 19/11, histórico privado. Reserva local 4k/8M, chave anteriormente exposta e 29/29 coincidências de chuva total/convectiva ainda em revisão científica. **Não** publicar/recapturar no cliente; licença do app de assinantes a esclarecer. Não é radar ou medição O.
- **DWD/ICON**: 92 pontos privados em staging e pesos oficiais ainda em QA; sem certificado de previsão continuamente válida para todos municípios.
- **NOAA**: mar/GFS Wave, SST, GOES/GLM e outros produtos com ciclos/QA por setor; apenas os snapshots NOAA já conectados à API aprovada podem aparecer com validade, e não automaticamente no mapa como radar.
- **OpenWeather/Agente 13**: contingência térmica limitada, sem ativação nem credencial embutida. V2 do Secret Manager preparado, mas três HTTP 500 históricos não têm causa conclusiva e não houve novo deploy.
- **INMET/CEMADEN**: comparação numérica admin apenas; **Alerta Rio/Defesa Civil RJ** continuam links curtos de avisos, sem coleta direta nem reprodução de boletins. HG Pro não contratado.
- Fontes excluídas de coleta meteorológica RJ não foram reativadas.

### Regras de segurança e homologação

1. APK cliente continua dependendo de snapshot autenticado e entitlement ativo. `current(now)` e janela de 30 min são aplicados à leitura existente; se o backend não publicar snapshots válidos, a tela mostrará "Indisponível" e não inventará valores.
2. A capa com horário ilustrativo é apenas protótipo visual; o Android usa relógio local real e informações de fonte/atualização por campo.
3. "Três alertas" significa **três cartões**; para avisos extras, `Saiba mais` apresenta demais links, mesmo quando nenhuma autoridade emitiu evento verificável.
4. Cores Blaise 1–5 não são cores oficiais de INMET/CEMADEN. No nível 4/5, recalculado há mais de 20 s ou sem flags de ciência/tempo real torna o cartão neutro/link-only. Isso não substitui o protocolo de segurança P0.
5. USGS livre é fonte de eventos sísmicos globais: nunca usar magnitude isolada como prova de tsunami no Rio; cada evento tem seu próprio URL oficial e horário UTC.
6. Checar CI Android (app + variantes), testes novos da política de alertas, tráfego e sismologia, tamanho APK cliente ≤400 MB e revisão visual nos tamanhos de tela móveis/tablets. Nenhuma versão foi distribuída nesta PR.

### Pendências reais para publicar meteorologia completa em até 30 min

- Dados atuais/licenciados de radar, pluviômetros/chuva acumulada, ventos/rajadas, ondas de calor, IQAr e ciclones no Rio e costa oceânica;
- Grade/mapas com regiões oficiais e renderização de camadas raster vetoriais georreferenciadas aprovadas;
- Fonte/horário do último ciclo por cada município (92/92), controle da latência, confiança e contingência de indisponibilidade;
- Homologação científica do recálculo 20 s (níveis 4 e 5), especialmente mar/ciclones, e autorização de alertas de segurança críticos;
- Revisão contratual/credenciais de cada fornecedor, estabilidade Cloud Run, integração ADM e canário separado com rollback;
- Autorização separada do responsável antes de deploy, merge, novos planos ou atualização Play Store.

**Importante:** este documento não implica que todas as 92 cidades estejam recebendo dados "em tempo real". A função da interface é exibir dados já autorizados de forma segura e mostrar falhas honestamente até os coletores reais estarem homologados.
