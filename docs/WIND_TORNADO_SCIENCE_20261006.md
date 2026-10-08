# Blaise V6 RJ — rajadas, tempestades e diagnóstico de rotação

Atualização de06/10/2026 ao **Blaise Vector RJ — Agente de Cálculo e Revalidação Científica**. Complementa a especificação científica anterior; uso exclusivamente no RJ e em contexto oceânico com impacto relevante no RJ.

## Cinco rotinas acrescentadas ao agente

| Rotina | Cálculo e entradas | Condição de uso |
|---|---|---|
| Rajada turbulenta estimada | `U_pico ≈ U_médio + g_p σ_u`, em m/s; desvio da componente ao longo do vento, altura, média temporal, janela e fator de pico local | Modelo empírico proposto com política calibrada/versionada fornecida; não aplicar fator universal, nem confundir desvio entre modelos com turbulência medida |
| Cisalhamento por camada | `ΔV = V_topo − V_base`, módulo `sqrt(Δu²+Δv²)` em m/s | Perfil vetorial em alturas acima do terreno (AGL), camadas como0–1/0–6km; cobertura completa e limite explícito de lacunas |
| Helicidade relativa à tempestade (SRH) | `Σ[(u_(i+1)−c_u)(v_i−c_v)−(u_i−c_u)(v_(i+1)−c_v)]`, em m²/s² | Perfil e movimento da tempestade fornecidos; integra e preserva parcelas positivas/negativas; nenhum limiar de ocorrência de tornado |
| Rotação, convergência e deformação horizontal | `ζ=∂v/∂x−∂u/∂y`; `div=∂u/∂x+∂v/∂y`; convergência=`−div`; deformações estiramento e cisalhamento | Gradientes controlados em coordenadas cartesianas locais, x=leste/y=norte e distâncias em metros; s⁻¹. Não usar diferenças em graus diretamente |
| Tendência de pressão | `(p2−p1)/(t2−t1)`, em hPa/h, com janela real | Mesma estação, altura e referência de pressão, dados ordenados; não misturar pressão da estação com pressão reduzida ao nível do mar |

Implementação: cinco funções adicionadas a `backend/src/blaise-scientific-kernels.mjs` e expostas automaticamente pelo despachante `blaise-scientific-jobs.mjs` ao fornecedor `readScientificJobs` do agente. Total passa de11 para16 rotinas. Calibração de rajada deve coincidir com o município/escopo da tarefa, altura e tempos de média/janela.

### Rajadas: limitações relevantes

`U_médio+g_pσ_u` é uma parametrização candidata para janela estacionária calibrada; não é uma garantia de rajada futura. O sistema exige `VALIDATED_STATIONARY`, coeficientes locais, domínio de aplicação e identificação temporal. Sem isso, resultado indisponível. Tempestades com aumento rápido de vento, microexplosões/downbursts e tornados podem ser não estacionárias; esta rotina **recusa** utilizá-las como se fossem uma janela estacionária. Não afirma calcular rajadas convectivas nessas condições.

Fator de rajada `U_pico/U_médio` depende da amostragem, média, exposição e regime; não cadastramos1,3 ou outro multiplicador como constante geral de RJ. Uma rajada oficialmente observada permanece observação, identificada com duração de média e horário, e tem prioridade de apresentação sobre estimativa substituta.

### Tornados: apoio científico, sem diagnóstico isolado

SRH e cisalhamento descrevem o ambiente. Não calculam uma probabilidade calibrada de tornado, não confirmam ocorrência e não fornecem categoria de alerta automática. Preservar o sinal: interpretações no Hemisfério Sul precisam de validação específica, sem copiar limiares norte-americanos de forma automática.

Confirmação/avaliação requer radar Doppler com velocidades desdobradas e controles de aliasing, acoplamento de rotação, trajetória e persistência espacial/temporal, Z/ZDR/ρhv/KDP quando disponíveis, perfil termodinâmico, altura de nuvens e evidência oficial/local. Nem TVS isolada garante tornado, nem ρhv baixo sozinho o confirma. Não inventar movimento da tempestade igual a zero quando desconhecido.

## Próximas rotinas recomendadas, ainda não implementadas

- **DCAPE e perfil de parcela descendente:** para apoio a downbursts, requer perfis completos de pressão, temperatura, umidade e processo de parcela validado. `sqrt(2·DCAPE)` é velocidade ideal de descida sob simplificações, não rajada horizontal à superfície.
- **CAPE/CIN/LCL/LFC/EL e temperatura virtual:** concluir algoritmo termodinâmico de parcela, seleção da parcela, tratamento de múltiplos níveis e comparação com biblioteca científica de referência.
- **Rotação Doppler/mesociclone e rastreamento:** quantificar cisalhamento azimutal com geometria, banda/resolução/feixe, controles de ruído e desdobramento; exigir persistência e validação com eventos de RJ.
- **Convergência de umidade e precipitação convectiva:** perfis/grelhas coerentes; umidade/vorticidade isoladas não determinam chuva forte.
- **Chuva–vazão/infiltração e instabilidade de encostas:** integrar chuva real, níveis de rios, solos, drenagem, maré e cobertura por localidade, com calibração e retrospectiva de eventos. Não calcular deslizamento só com volume de chuva.
- **Índices compostos de tempestade (EHI/STP):** previstos somente após validar entradas e comportamento regional. Não emitir percentual ou tornado automaticamente a partir de índice importado.

## Validação desta revisão

Nove testes novos: limite sem turbulência, rejeição de regime/altura/tempos/calibração, cisalhamento vetorial e interpolação, recusa de extrapolação e perfis incompletos, integração assinada de SRH e invariância de translação, fluxos analíticos rotacionais/convergentes, tendência de pressão e isolamento de município. Fixtures artificiais identificadas nos testes; seus coeficientes não são política operacional de RJ.

Testes numéricos validam matemática e contratos; não medem previsão de evento, precisão operacional ou latência p95. A conexão operacional de perfis/turbulência/radar permanece pendente. Não há fornecedor de tarefas científicas desses dados configurado no runtime. Toda saída continua `CALCULO_BLAISE`, `officialAlert:false`, sujeita à regra já aprovada de convergência de duas agências oficiais independentes mais cálculo Blaise para entrega automática extrema.

## Referências primárias consultadas

- Unidata/MetPy, integral discreta de SRH e entradas: https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.storm_relative_helicity.html
- NOAA/NWS, significado de SRH e cisalhamento sem separação absoluta entre tempestades tornádicas/não tornádicas: https://www.weather.gov/fwd/convectiveparametershelicity e https://www.weather.gov/source/zhu/ZHU_Training_Page/convective_parameters/Sounding_Stuff/MesoscaleParameters.html
- Unidata/MetPy, derivadas de vento: https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.vorticity.html e https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.divergence.html
- NOAA/NWS, TVS não garante ocorrência: https://forecast.weather.gov/glossary.php?word=tornado
- NIST, limitações de perfis/fatores para tempestades não estacionárias: https://www.nist.gov/publications/thunderstorm-characteristics-importance-wind-engineering-part-ii-profiles-gust-factors
- NOAA, dependência de duração/altura/geografia do fator de rajada: https://www.vos.noaa.gov/MWL/dec_08/gust_factor.shtml

Não foi encontrado nem adotado fator local de pico operacional validado para RJ. A equação candidata de pico exige ajuste e validação independentes antes da operação.
