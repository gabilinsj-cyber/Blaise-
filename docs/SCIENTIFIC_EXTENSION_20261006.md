# Blaise V6 RJ — extensão científica de 06/10/2026

Agente: **Blaise Vector RJ — Agente de Cálculo e Revalidação Científica**. Escopo exclusivo do Estado do Rio de Janeiro, com contexto oceânico relevante. Esta extensão complementa `BLAISE_VECTOR_RJ_SCIENTIFIC_ENGINE.md` sem substituir fontes ou alertas oficiais.

## Termodinâmica e coluna atmosférica

- **θe aproximada:** `T (100000/p)^(287.05/1004) exp(2500000 q/(1004 T))`, T em K, p em Pa e q umidade específica em kg/kg. Implementa exatamente uma aproximação de calor latente constante; não é a formulação de Bolton nem um diagnóstico completo de estabilidade. A formulação aprimorada de Bolton, com ponto de orvalho e temperatura do LCL, fica prevista para comparação independente antes de uso operacional.
- **PW/PWAT:** `1/g ∫ q dp`, resultado em kg/m² equivalente a mm de água. Integração trapezoidal de perfil de pressão estritamente decrescente; cada camada mantém sua extensão. Um perfil parcial não recebe o rótulo de coluna total. Se a entrada for razão de mistura r, converter explicitamente `q=r/(1+r)` antes do cálculo.
- **Clausius–Clapeyron:** `de_s/dT=L e_s/(R_v T²)`, Rv=461,5 J/(kg K). A fase e o calor latente devem ser informados. O crescimento termodinâmico próximo de 7%/°C não garante aumento idêntico da chuva em cada bairro ou evento.
- Os valores PWAT abaixo de 20 ou acima de 50 mm ficam registrados como exemplos heurísticos enviados pelo usuário. Não são limiares operacionais universais para RJ: exigem climatologia sazonal, circulação, convergência, relevo e validação por região. Nenhum alerta é emitido apenas por PWAT ou θe.

## Radar polarimétrico

Registrar entradas observadas **ZDR** (dB), **KDP** (graus/km) e **ρhv** (adimensional), com radar, banda, elevação, georreferenciamento, horário, calibração, controle de qualidade e resolução. Não derivar esses produtos de uma simples imagem colorida.

ZDR próximo de zero não confirma granizo. ρhv baixo também pode indicar mistura, alvos não meteorológicos e problemas de qualidade; assinatura de detritos depende de contexto espacial e sinal de rotação, não de `ρhv<0,80` isolado.

Implementada relação `R=a KDP^b` para portões de chuva líquida com KDP não negativo e coeficientes locais fornecidos, versionados e calibrados para banda S/C/X. Não há coeficientes operacionais de RJ cadastrados. Classificação de hidrometeoros, atenuação, filtragem/desdobramento de fase e detecção de tornados/granizo continuam pendentes.

## Agrometeorologia

**FAO-56 Penman–Monteith diário:**

`ET0=[0,408 Δ(Rn−G)+γ (900/(T+273)) u2(es−ea)]/[Δ+γ(1+0,34u2)]`.

ET0 em mm/dia; T média diária em °C; Rn/G em MJ/(m² dia); u2 médio em m/s a 2 m; es/ea em kPa; Δ/γ em kPa/°C. Resultado de referência para gramado, não evapotranspiração real. Não alimentar essa fórmula diária com uma observação instantânea e chamar o resultado de atualização de 30 segundos. A versão horária tem outra parametrização e não está implementada.

**Balanço do solo:** `ΔARM=P+I+C−ETR−Q−D` em mm para a mesma área e intervalo: precipitação, irrigação, ascensão capilar, evapotranspiração real, escoamento e drenagem profunda. A forma reduzida solicitada `P−ETR−Q` só se aplica quando I/C/D forem explicitamente zero. ARM inicial, capacidade do solo, infiltração, saturação e calibração hidrológica continuam necessários para estimar armazenamento e riscos.

## Oceano e vento

- **Tensão superficial:** `τ=ρa Cd U10²` em Pa; velocidade em m/s a 10 m e Cd fornecido conforme condições. Calcula magnitude, sem converter automaticamente em altura de ondas ou ressaca.
- **TCHP/energia acima de 26°C:** `ρ cp ∫[T(z)−26] dz` da superfície à primeira isoterma de 26°C, profundidade positiva para baixo. Resultado J/m² (`1 kJ/cm²=10⁷ J/m²`). Integra perfil e interpola o cruzamento; perfil quente que não alcança a isoterma é recusado. Isto é um produto específico, não OHC genérico. Não determina sozinho intensificação rápida e não é critério transferível automaticamente a ciclones extratropicais do RJ.
- **Perfil logarítmico neutro:** `U(z)=u*/κ ln((z−d)/z0)`, κ informado (normalmente 0,40), rugosidade e deslocamento em m. Exige estabilidade neutra e validade na camada superficial. Calcula vento médio; não rajada e não a espiral completa de Ekman. Rajadas exigem dados e modelo de turbulência adicionais.

## Ajustes estatísticos

- **MOS multivariado:** `ŷ=β0+Σβi Xi`. Coeficientes, unidades e domínio de cada preditor, município, variável e horizonte precisam de política calibrada/versionada. Elevação e uso do solo podem ser preditores; uso do solo exige codificação consistente. Não inventar coeficientes ou tratar MOS como etapa obrigatória de toda fonte.
- **Kalman escalar:** atualização de uma medida com `K=P⁻/(P⁻+R)`, `x⁺=x⁻+K(y−x⁻)` e covariância na forma de Joseph. Implementado núcleo de atualização; faltam modelo de evolução, ruído de processo, calibração de covariâncias e validação regional. Não é um filtro temporal completo em operação.

## Implementação e critérios de validação

Código: `backend/src/blaise-scientific-kernels.mjs` e `blaise-scientific-jobs.mjs`. Onze rotinas numéricas. O agente aceita lotes limitados via fornecedor `readScientificJobs`; cada tarefa exige escopo RJ, fonte HTTPS, horário de origem, qualidade validada, natureza observado/modelo, validade comum e política de idade explícita. Falha recusa a tarefa; nenhuma saída recebe natureza de alerta oficial. A presença de metadados não comprova autenticidade: o fornecedor deve validar o contrato da agência.

O runtime ainda não tem fornecedor operacional desses perfis/radares/modelos. Por padrão o lote é vazio. Unidades nos parâmetros são explícitas; dados devem ser normalizados antes de entrar. Não há promoção automática destes cálculos à escala 5. Mantém-se a regra de duas agências oficiais independentes e cálculo Blaise compatível para áudio automático extremo.

Testes: limites secos, perfis analíticos, derivada por diferença finita, conservação de água, vento quadrático, integral oceânica com cruzamento interpolado, posterior Gaussiano, recusas de localidade/idade/calibração e ligação ao agente. A evapotranspiração reproduz o exemplo 18 da FAO, aproximadamente 3,88 mm/dia. Dados dos testes são artificiais identificados, nunca observações de RJ. Testes numéricos não medem precisão de previsão, p95 de latência nem validação com eventos reais.

## Referências técnicas primárias

- FAO-56, capítulos 2 e 4, equação e exemplo 18: https://www.fao.org/4/x0490e/x0490e06.htm e https://www.fao.org/4/x0490e/x0490e08.htm
- Unidata/MetPy, θe e PW: https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.equivalent_potential_temperature.html e https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.precipitable_water.html
- IPCC AR6 WG1 capítulo 8: https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-8/
- NOAA/NWS, produtos polarimétricos: https://www.weather.gov/jan/dualpolupgrade-products e https://www.weather.gov/media/crp/DualPol_OnePager.pdf
- NOAA/AOML, definição TCHP: https://www.aoml.noaa.gov/phod/cyclone/method.php e https://www.aoml.noaa.gov/phod/cyclone/intro.php
- Artigo no repositório NOAA, perfil médio neutro: https://repository.library.noaa.gov/view/noaa/45067/noaa_45067_DS1.pdf
- NOAA/NWS, MOS: https://forecast.weather.gov/glossary.php?word=model+output+statistics
- NASA, equações de atualização e Joseph: https://ntrs.nasa.gov/api/citations/20050061035/downloads/20050061035.pdf

## Interface integral — comparação estrutural desta etapa

Comparada a imagem aprovada com o código Compose; não houve captura ou teste visual em aparelho nesta etapa. Interface integral **não aprovada para conclusão**.

| Item da imagem aprovada | Evidência no código | Resultado |
|---|---|---|
| Azul, identidade RJ, botão ligado e navegação inferior | Cores, AppHeader e PrimaryNavigation | Estrutura presente; fidelidade visual pendente |
| Personagem feminina pequeno ao lado do boletim | Avatar ainda usa letra B | Pendente |
| Boletim de duas frases + Leia mais com página e volta | Resumo textual e Dialog integral implementados | Página presente; resumo ainda genérico e posição/proporções pendentes |
| Voz sem envio manual; digitação compacta expansível | Reconhecimento final automático e expandedInput | Código presente; teste em aparelho pendente |
| Rio e segunda cidade ao lado do grande mapa | HomeScreen organiza três colunas em tela larga | Estrutura presente; métricas dos cartões não ligadas |
| Mapa meteorológico real, camadas, controles e animação | ExpandedRadarPanel ainda contém texto de espera | Pendente |
| Gráficos preenchidos por séries reais | DailyChartPanel ainda contém texto de espera | Pendente |
| Mar, previsão, qualidade do ar, riscos, trânsito, notícias e sismos | Painéis ou páginas existentes, vários sem conteúdo | Integração e composição integral pendentes |
| Botões Mais e detalhes | Alguns onClick vazios | Pendente |
| Sem cortes em retrato, paisagem e tablet | Sem ensaio visual dessas resoluções nesta etapa | Não validado |

Preservar a imagem completa como referência. Não transformar seus valores ilustrativos em dados atuais nem declarar ausência de risco ao faltar informação.
