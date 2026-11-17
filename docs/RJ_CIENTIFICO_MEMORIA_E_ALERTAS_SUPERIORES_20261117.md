# Blaise V6 RJ — memória científica e alertas superiores (17/11/2026)

## Decisão atual do responsável
Preservar a interface original, o mapa próprio dos 92 municípios, 13 agentes projetados e a calculadora Blaise Vector RJ. Mostrar, no **topo do aplicativo**, quatro encaminhamentos para alertas oficiais: **Alerta Rio, Defesa Civil RJ, INMET e INPE/CPTEC**, nessa ordem, com frase curta em **preto e negrito** e link para a página oficial. Os níveis **1, 2, 3, 4, 5** usam cores próprias de risco Blaise. **Links sozinhos não são alertas ativos.** Nenhum nível é inferido sem resultado auditado do servidor.

### Exceções de fonte
A inclusão de INMET é exclusivamente para **link público de avisos oficiais**; os dados INMET/CEMADEN continuam fora do aplicativo como provedores meteorológicos e permanecem apenas na comparação interna. A inclusão de INPE/CPTEC permite link de avisos; não libera reprodução comercial de mapas, boletins ou previsões. Alerta Rio/Defesa Civil são links de consulta sem coleta meteorológica. INEA, Marinha, Windy e coleta direta de Copernicus continuam excluídos. A exceção anterior de UV CAMS **via MET Norway** permanece restrita a UV de céu limpo.

### URLs de encaminhamento
- Alerta Rio: https://www.sistema-alerta-rio.com.br/alertas/
- Defesa Civil RJ: https://defesacivil.rj.gov.br/
- INMET: https://avisos.inmet.gov.br/
- INPE/CPTEC: https://www.cptec.inpe.br/ (portal com seções de tempo severo; não afirmar ser endpoint de avisos)

### Escala Blaise 1–5; texto preto negrito sobre fundos claros
| Nível | Fundo | Frase genérica de orientação |
|---|---|---|
| 1 | Verde-claro | Atenção: acompanhe as orientações oficiais. |
| 2 | Amarelo-claro | Atenção reforçada: acompanhe a situação e evite exposição desnecessária. |
| 3 | Laranja-claro | Perigo: evite áreas de risco e consulte as orientações oficiais. |
| 4 | Vermelho-claro | Perigo elevado: siga as recomendações das autoridades. |
| 5 | Vermelho extremo claro | Perigo extremo: siga imediatamente as orientações das autoridades. |

A fonte não determina automaticamente o nível Blaise por cor ou pelo nome. A UI só aceita um alerta de nível 1–5 quando há registro do backend com fonte correspondente, ID de aviso, severidade Blaise validada, cobertura do RJ homologada, verificação recente, janela válida e sem expiração. **Até isso existir, cada órgão aparece em cinza-claro como “ALERTAS NÃO VERIFICADOS”**, com o link de consulta. A legenda colorida é rotulada como referência e não indica alerta ativo.

## Memória científica existente no desenvolvimento da PR #157
**19 rotinas científicas já implementadas** em `backend/src/blaise-scientific-kernels.mjs` e `backend/src/blaise-marine-kernels.mjs`, despachadas por `backend/src/blaise-scientific-jobs.mjs`, em 4 grupos. O total refere-se a esses módulos **nesta branch**, não significa que todas as fontes ou cálculos estejam operando em produção.

**Termodinâmica e atmosfera:** `equivalentPotentialTemperatureApprox`, `clausiusClapeyronDerivative`, `precipitableWater`, `referenceEvapotranspirationDaily`, `soilWaterBalance`.

**Ventos, radar e tempestades:** `neutralMeanWindProfile`, `calibratedTurbulentGust`, `bulkWindShear`, `stormRelativeHelicity`, `horizontalWindDiagnostics`, `stationPressureTendency`, `calibratedKdpRainRate`.

**Estatística e calibração:** `calibratedMos`, `scalarKalmanUpdate`.

**Oceano e física marinha:** `oceanWindStress`, `tropicalCycloneHeatPotential`, `significantWaveSpectrum`, `linearWaveDispersion`, `conditionalMarineTravelTime`.

As rotinas antigas da branch `main`, incluindo `rj-scientific-calculator.mjs`, `blaise-rj-advanced-physics.mjs`, e `ScientificDashboardPolicy.kt`, **não foram sobrescritas ou copiadas cegamente** para a branch da PR #157. A auditoria de diferenças deve preceder portabilidade. Arquivos legados podem conter fontes excluídas.

## Cinco cálculos térmicos adicionados à camada Android
Em `ScientificMemoryPolicy.kt`, um núcleo puro **sem rede, persistência nem dados pessoais** calcula quando o servidor futuro entregar entrada internacional licenciada, georreferenciada, válida e auditada:
1. Ponto de orvalho: Magnus, usando temperatura e umidade relativa;
2. Déficit de pressão de vapor (VPD): pressão de saturação e umidade;
3. Bulbo úmido: Stull, aproximação empírica e domínio limitado;
4. Índice de calor: Rothfusz, somente no domínio térmico e de umidade;
5. Vento-frio: fórmula para temperaturas frias e velocidade mínima.

Toda saída declara natureza `CÁLCULO BLAISE • ESTIMATIVA`, fórmula, horário, fonte e `officialMeasurement=false`, `officialAlert=false`, `mayTriggerAlert=false`. O cálculo nunca é usado para fabricar temperatura observada ou aviso oficial. A calculadora foi transferida do código Android público para o source set `app/src/admin` e para o build type `admin`, com pacote separado `br.com.blaise.rj.admin`. O menu de entrada só aparece nessa variante. A tela não é exportada e exige token Firebase com claim `blaise_admin=true` para mostrar o inventário; os futuros serviços de cálculo também deverão validar identidade e papel no **backend**. A versão pública, inclusive Debug, não inclui os núcleos termodinâmicos administrativos. Até receber dados internacionais auditados, a tela indica indisponibilidade. Os critérios de licença e cobertura geográfica são pré-condições, não comprovados pelo usuário.

## Física científica avançada prevista / recuperada
Além dessas 19 rotinas, o histórico do projeto inclui diagnósticos com perfis verticais para CAPE/CIN, LCL, umidade específica, razão de mistura, lapse rate, espessura hipsométrica, acumulação de chuva com janelas completas, estimativas radar Z–R/KDP calibradas, advecção de fenômenos, torque/tensão de vento, balanço hidrológico, correntes/ondas e propagação de tsunami condicionada à profundidade `c=sqrt(g*h)`. Esses cálculos exigem entradas observadas/modeladas corretamente rotuladas, cobertura, calibração e incerteza; **não são previsões operacionais de desastre nem alertas automáticos**. Não afirmar que todos estão na branch atual.

## Arquitetura e implantação
- Público: quatro portais oficiais visíveis em cima; uma frase curta preta e negrito por portal; status neutro até comprovação; sem copiar conteúdo do portal. A escala colorida 1–5 é referência.
- Administrador: trilhas de ciência, medidores, auditoria, fórmulas, divergências, testes, agentes, métricas, quotas e resultados protegidos por backend e autorização. A exibição do inventário no menu “Mais” não dá privilégios administrativos ao cliente.
- Cálculo: dados ausentes, obsoletos, inválidos, de fonte nacional só comparativa ou de produto licenciado incorretamente devem resultar em **indisponível**, nunca 0 ou alerta inventado.
- Release: somente branch de desenvolvimento PR #157; sem merge, Cloud Run, mudanças no APK instalado ou publicação. Exigir CI Android/backend, testes instrumentados, compatibilidade de assinatura, fontes ao vivo e revisão do produto antes da liberação.

## Ajuste de apresentação e acesso restrito (pedido posterior em 17/11)
- A faixa superior mostra **no máximo quatro alertas Blaise verificados**, classificados do nível **5 para 1**, com cor distinta, grau numérico, nome do órgão e **uma única frase de orientação original em preto e negrito**, seguida por link direto ao portal oficial. Outros avisos validados aparecem em **Mais → Mais alertas oficiais**, a partir do quinto. Sem aviso auditado, mostram-se quatro links neutros e o texto "alertas não verificados", jamais uma declaração de normalidade.
- O produto original de terceiros não é copiado: sem reprodução de boletins, mapas, fotografias, marcas ou longas passagens; somente nomes dos órgãos, frases genéricas originais e hyperlinks.
- A hierarquia meteorológica original e as exceções permanecem; links públicos de INMET e INPE não tornam suas observações ou modelos fornecedores do aplicativo, tampouco duplicam o ECMWF.
- A calculadora científica Blaise é **exclusiva da variante administrativa**; a biblioteca e os testes adicionados na revisão anterior foram realocados para `app/src/admin/java` e `app/src/testAdmin/java`. Não existe importação dessas rotinas nos APKs de clientes. O backend científico histórico continua preservado para auditoria. A exibição administrativa não prova coleta de entradas reais nem autorização de serviços em produção.
- `OfficialAlertRibbonPolicy.layout` ordena por severidade validada e desloca avisos adicionais para "Mais"; a UI Android recebe atualmente lista vazia até integrar um contrato assinado e auditado. Não inserir alertas falsos para preencher posições.
