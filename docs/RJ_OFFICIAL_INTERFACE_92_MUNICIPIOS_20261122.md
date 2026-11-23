# Blaise V6 RJ — interface oficial aprovada e ligação segura de dados (22/11/2026)

**Referência aprovada pela titular:** última imagem do dashboard Blaise V6 RJ nesta conversa: cabeçalho azul neon com Blaise e microfone, dois municípios, mapa central RJ+Atlântico, três alertas oficiais na faixa superior, tráfego em painel separado e **três maiores terremotos recentes** na caixa inferior direita. A imagem **não fornece medições reais** (mostra data 15/09/2026 e números ilustrativos). Não reproduzir esses números, avisos de nível 4 nem sismos como evento ao vivo. A identidade visual e a disposição são alvo da variante Android, não artefato meteorológico reutilizável. Nenhum segredo nem foto com chave entra no Git.

## Status da implementação desta PR

**Branch:** `feature/rj-official-dashboard-92-alerts-sismos-20261122`, derivada da PR #173, **draft**. Código de desenvolvimento, **sem instalação no aparelho, sem APK assinado, sem merge, sem deploy, sem alterar main ou o tráfego 99%/1%**.

| Componente | Código nesta branch | Limitações verificadas |
|---|---|---|
| Municípios | Lista IBGE 92 e escolha da Cidade 1/2 já existente; mapa acompanha Cidade 1, contorno dourado no município selecionado; regiões imediatas são obtidas do endpoint oficial IBGE de localidades e seus municípios são destacados em azul-petróleo | Não comprova 92 medições atuais nem radar regional; se o endpoint IBGE falhar, seletor regional permanece indisponível em vez de inventar vínculos |
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
- Recorte/zoom por região IBGE, legendas raster e mapas meteorológicos georreferenciados licenciados (já é possível destacar municípios membros de uma região imediata com fonte IBGE, mas **não** renderizar radar vivo);
- Fonte/horário do último ciclo por cada município (92/92), controle da latência, confiança e contingência de indisponibilidade;
- Homologação científica do recálculo 20 s (níveis 4 e 5), especialmente mar/ciclones, e autorização de alertas de segurança críticos;
- Revisão contratual/credenciais de cada fornecedor, estabilidade Cloud Run, integração ADM e canário separado com rollback;
- Autorização separada do responsável antes de deploy, merge, novos planos ou atualização Play Store.

**Importante:** este documento não implica que todas as 92 cidades estejam recebendo dados "em tempo real". A função da interface é exibir dados já autorizados de forma segura e mostrar falhas honestamente até os coletores reais estarem homologados.


## Atualização 22/11 — frequência térmica, 14 agentes, HG e radar Climatempo

### Inventário preservado (não é prova de 14 serviços ativos)

O app administrador contém os 14 papéis definidos: 1 Sentinel, 2 Vector, 3 Fusion, 4 Track, 5 Hydro, 6 Ocean, 7 Seismo, 8 Audit, 9 Correção Horária, 10 Auditoria Profunda, 11 IA Pesquisa, 12 GeoFusion, 13 OpenWeather/Contingência Térmica, 14 Auditor Meteorológico Internacional. `AdminAgentsArchive.kt` mantém todos como `autonomouslyRunningVerified=false`. `ScientificMemoryPolicy.kt` registra os **19** métodos numéricos backend de termodinâmica, meteorologia, hidrologia, ventos, oceanografia e calibração, além de **5** cálculos administrativos: ponto de orvalho Magnus, VPD, Stull, índice de calor Rothfusz e vento-frio. Não iniciar processos autônomos nem emitir alertas críticos a partir de calculadora manual. A regra para níveis 4/5 continua exigir dados em tempo real e recálculo **dentro de 20 segundos**, mas o motor de risco automático NÃO está operacionalmente homologado.

### Matriz de frequência: taxa de consulta ≠ medição nova

| Fonte/campo | Idade/ciclo candidato | Condição na versão de desenvolvimento | Temperatura e sensação |
|---|---|---|---|
| **HG Brasil Weather Pro** | fornecedor atualiza os dados em **até 60 min**; planejar **1 consulta/hora por município** | R$ 49,90/mês, 100 cidades, 20.000 requisições/dia; e-mail de autorização comercial recebido 17/11; **contratação adiada para dezembro de 2026**, sem chave/solicitações atuais | Temperatura e condição do céu **E** quando o produto estiver ativo; HG não comprovou campo de sensação térmica direta. Um cálculo futuro dependerá de temperatura, umidade, vento, hora e fórmula adequada |
| **OpenWeather / Agente 13** | intervalo mínimo de **35 min/mesma cidade**, idade limite 35 min para *temperature/feels_like* | recurso apenas de contingência se fontes principais falharem; teto interno persistente 900 consultas/dia, cache e segredo somente servidor; não reativar devido a risco antigo v1 | Temperatura e sensação E, **não estação observada**, sob licença e gates |
| **DWD/ICON Global** | P, ciclo e hora de validade específicos, não intervalo de sensor; UI agora exige válido **até 60 min**, sem garantia de novas execuções a cada 30 min | produto de 2m em staging, QA espacial/ciclo e publicação 92/92 ainda pendentes | Temperatura modelo **P**; sensação só com cálculo Blaise e entradas auditadas, jamais automaticamente |
| **Visual Crossing** | código atual aceita agregado E até 30 min da validade; não garante medição nova a cada 30 min | coletores/segredos/quotas em revisão; permanece **excluído para temperatura/sensação** pela política 18/11 | Pode complementar outros setores como chuva *estimada* e vento se autorizado, não termômetro |
| **WeatherAPI Free** | planejamento usa cache E de **60 min**, quota de 100.000/mês | OFF, orçamento central projetado e direito comercial/credencial/QA pendentes | Não promovido a fonte térmica aprovada |
| **ECMWF/IFS via MET Norway, NOAA, satélites** | ciclos próprios, não equivalentes às consultas de 12/30/45 min | demais setores de chuva prevista, vento, nuvens, mar e outros com proveniência O/E/P | **Explicitamente não** temperatura/sensação no gate atual |
| **meteoblue Free** | `basic-6h`, **29 passos de 6 horas** em resposta privada; TTL privado 6h | 7 campos auditados; 4.000 créditos na consulta controlada e chave exposta, sem redistribuição pública | **Não contém** temperatura/sensação e não pode melhorar a frequência térmica |
| **Climatempo Radar** | objetivo futuro 2–5 min de quadros, **máximo 12 min** de defasagem | proposta/solicitação empresarial, **sem contrato, API, cobertura e direitos para 92 municípios+Atlântico comprovados**. Sem cópia, raspagem, incorporação ou frame baixado | Radar observa refletividade/chuva, **não temperatura do ar nem sensação térmica** |

**Cálculo de orçamento necessário:** HG 92 municípios × 24 consultas = **2.208 requisições/dia** (sob limite Pro 20.000). Consulta HG a cada 30 min seria 4.416/dia, mas **não torna um produto horário mais fresco**. OpenWeather: `ceil(1440/35)=42` chamadas/município/dia; **92×42 = 3.864/dia**, muito acima de 900. Para **duas cidades** selecionadas seriam **84 chamadas/dia** em um plano hipotético integral de 35 min, antes de reservar margem para outros usuários, tentativas, diferenças de janela, cache e limites contratuais. Distribuir todas as 900 igualmente entre 92 cidades equivale a **147,2 minutos por chamada por município**, portanto não se pode garantir 35 min em todo o estado. A regra real do Agente 13 é **fallback**, não uma rodada aberta e obrigatória.

**Conclusão de frequência:** duas cidades com fonte HG horária disponível teriam a possibilidade de valor válido com idade **até 60 min**; OpenWeather poderá fornecer leitura estimada a **35 min** se permitido, necessário e dentro do limite, mas não há promessa de atualização 35 min em todos os horários. As demais fontes de 12/30/45 min podem ajudar **outros campos**, não a cadência de temperatura sem licença específica, campo térmico e medições novas. O monitor do Android consulta o backend em intervalo de 30 s quando autorizado; isso **não cria medição**. Falta de dado/idade excessiva/ausência de licença = **Indisponível**, exibindo última origem quando tiver significado.

### Código novo e controles não operacionais

- `backend/src/rj-thermal-multisource-cadence.mjs`: plano puro com frequência, orçamento, 92 códigos e separação de natureza. Sem agendador, rede, créditos ou escrita.
- `backend/src/rj-climatempo-radar-readiness.mjs`: gate empresarial de contrato, imagem/raster georreferenciada, semântica, fonte, prazo de 12 min e cobertura RJ+Atlântico; **até que todos sejam comprovados, não publica**.
- `app/src/main/java/br/com/blaise/rj/data/ApprovedThermalDisplay.kt`: novo campo **opcional** `approvedThermal` no contrato autenticado `/v1/data/dashboard`, até duas cidades × três fornecedores com proveniência por campo, HG E se contratação ativa, OpenWeather E se contingência autorizada, DWD P se válido, fonte e hora **separadas para temperatura e térmica**, condição do céu somente HG. Não aceita Climatempo/ECMWF/Visual Crossing como temperatura, senhas ou segredos. Backend ainda **não gera** esse campo, portanto exibição efetiva depende de release e conector homologado.
- A camada de mapa **Radar** exibe "Climatempo aguardando licença" em vez de exibir um mapa de terceiros ou fingir quadros em tempo real.

**A Climatempo permanece exclusivamente cotação:** no Gmail consultado havia solicitações comerciais enviadas em novembro de 2026, não autorização formal para usar um raster ou endpoint no aplicativo de assinaturas. Exigir por escrito: endpoint/API, termos de redistribuição, cobertura de 92 municípios e Atlântico, resolução espacial, últimos 30 min e quadro 2–5 min, custo mensal/franquias, formato/tiles, SLA e prazo máximo 12 min; contar cada quadro com timestamp, bounding box e QA. Não coletar radar de Alerta Rio por caminhos indiretos.

Este registro **não altera PR #173, produção Cloud Run, o tráfego 99%/1%, chaves, franquia, assinatura HG, orçamento Climatempo, Google Play ou APK instalado**. Backend e compilação Android da branch devem passar CI antes da entrega de qualquer APK de teste, sem publicação automática.
