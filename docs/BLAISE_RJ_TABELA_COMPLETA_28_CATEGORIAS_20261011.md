# Blaise V6 RJ — TABELA COMPLETA de 28 categorias e desempate
**Consolidação:** 11/10/2026 • **Localidade:** exclusivamente 92 municípios do RJ, litoral e Atlântico adjacente com possível impacto no RJ

> Esta tabela é **a configuração aprovada de monitoramento e fontes**, não uma declaração de que 28 coletores já transmitem dados ao vivo. `INEA` está excluído. O mapa e os gráficos são desenhados pelo Blaise, usando somente dados atuais, autorizados e rastreáveis.

## Matriz principal de 28 categorias

| Nº | Categoria monitorada | Fonte prioritária (conforme cobertura) | Desempate / complemento | Cálculo ou decisão |
|---:|---|---|---|---|
| 01 | Temperatura do ar | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; MonitorAr-Rio e NOAA | Média condicional de medições válidas |
| 02 | Sensação térmica | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; cálculo Blaise/NOAA | Índice de calor ou vento-frio, método adequado |
| 03 | Chuva atual | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; CEMADEN, MonitorAr-Rio, radar validado | Comparar mesma janela/estação |
| 04 | Chuva acumulada | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; CEMADEN, radar calibrado | 5/10/15/30 min, 1h, 24h por janela completa |
| 05 | Temporal / tempestade | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; CEMADEN e NOAA conforme produto | Severidade não é média |
| 06 | Vento | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; Marinha/NOAA | Média de mesma altura/intervalo; direção vetorial |
| 07 | Rajadas de vento | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; Marinha/NOAA | Rajada máxima do período; não média de alertas |
| 08 | Pressão atmosférica | INMET | Marinha, NOAA, INPE/CPTEC | Mesma pressão de referência, tendência |
| 09 | Umidade relativa | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; NOAA | UR, ponto de orvalho, bulbo úmido |
| 10 | Granizo | Alerta Rio / Defesa Civil RJ / INMET | INPE → Windy; radar/CEMADEN | Confirmar fenômeno; sem média de risco |
| 11 | Raios | NOAA GOES-GLM + rede terrestre autorizada | Segunda rede terrestre independente; radar como contexto | Densidade/taxa apenas com cobertura georreferenciada |
| 12 | Ciclones / tempestade extratropical | Marinha/CHM + INMET | NOAA → INPE → Windy | Advecção, rota e ETA com incerteza |
| 13 | Ressaca | Marinha/CHM | NOAA, boias oficiais, INPE e Windy | Aviso oficial prevalece; comparar ondas/rajadas |
| 14 | Ondas altas | Marinha/CHM + boias oficiais | NOAA, modelo oceânico autorizado, INPE/Windy | Altura/período/direção comparáveis |
| 15 | Marés | Marinha/CHM | Marégrafos oficiais, modelo de maré validado | Horários e altura referidos ao mesmo datum |
| 16 | Temperatura do mar | NOAA + boias oficiais | Satélites autorizados, modelos oceânicos, Windy | Média ponderada apenas entre dados compatíveis |
| 17 | Nível dos rios | ANA + SGB/SACE | Rede hidrológica local, CEMADEN | Cota/estação e nível de referência |
| 18 | Vazão dos rios | ANA | SGB/SACE, rede hidrológica local | Vazão observada m³/s; não derivar risco sozinha |
| 19 | Enchente / inundação | Defesa Civil RJ + SGB/SACE | CEMADEN, ANA | Aviso competente prevalece; nível e cota como apoio |
| 20 | Deslizamento | Defesa Civil RJ + Geo-Rio onde competente | CEMADEN, Defesa Civil local | Risco geotécnico por área, sem média de aviso |
| 21 | Sismos | USGS + rede sismológica oficial | Centro sismológico regional | Magnitude, profundidade, distância e impacto |
| 22 | Tsunami / maremoto | NOAA + Marinha + autoridade brasileira competente | Centro oficial de alerta, USGS, marégrafos/DART | Sem alerta automático por magnitude isolada |
| 23 | Seca / estiagem | CEMADEN + ANA + INMET | INPE, monitor climático autorizado, Windy como modelo | Anomalia e acumulados em períodos comparáveis |
| 24 | El Niño / La Niña (ENSO) | NOAA + centro climático oficial | INPE/CPTEC | Anomalias oceânicas; não alerta municipal automático |
| 25 | Excesso de calor / saúde | Monitora RJ/SES | INMET, Alerta Rio (capital), MonitorAr-Rio | Risco à saúde; não contar republicação INMET duas vezes |
| 26 | Qualidade do ar | MonitorAr-Rio (capital) | Data.Rio, redes oficiais de ar e índices validados | PM2.5/PM10/O₃ e índice conforme método da autoridade |
| 27 | Radiação solar / UV | MonitorAr-Rio (quando houver produto) | INMET, satélite oficial, modelo autorizado | Mesma variável/método; índice UV não inferido sem dado |
| 28 | Previsão de 1 a 7 dias | INMET + modelos oficiais | INPE/CPTEC, NOAA, Windy, modelo autorizado | Ensemble ponderado só com calibração histórica |

## Fontes especializadas e temas complementares não contados nas 28 linhas

| Fenômeno / camada | Fontes | Critério técnico |
|---|---|---|
| Massa de ar polar/quente; frente fria | INMET, INPE/CPTEC, NOAA, Marinha quando marítimo, Windy complementar | Gradiente térmico, pressão, advecção e trajetória com dados espacializados |
| Chuva acumulada no Atlântico | NOAA, Marinha, INPE/CPTEC; Windy como previsão | Grades espaciais e janelas equivalentes; não interpolar de 2 estações |
| Ciclone extratropical e impacto no RJ | Marinha/CHM, INMET, Defesa Civil, NOAA/INPE; Windy para comparação | Rota, distância, direção e ETA condicionados à confirmação |
| Radar e nuvens próprios | Grades/frame oficiais georreferenciados com uso permitido | Desenho 100% Blaise, sem copiar mapas ou imagens de terceiros |
| Tsunami meteorológico | Marinha, NOAA e autoridades competentes conforme mecanismo | Tratar separadamente de tsunami sísmico; confirmação oficial |
| Trânsito e ocorrências | COR.Rio, CET-Rio, Defesa Civil e autoridades rodoviárias | Horário, local e ocorrência confirmada; não inventar riscos |

## Hierarquia dos cinco canais meteorológicos municipais

**1 Alerta Rio → 2 Defesa Civil competente → 3 INMET → 4 INPE/CPTEC → 5 Windy.**

**Atenção à área:** Alerta Rio só se aplica ao município do Rio de Janeiro. Nas demais 91 cidades, não inventar cobertura Alerta Rio: começar pela Defesa Civil competente, INMET e redes especializadas existentes. A localização dos 92 municípios não demonstra 92 estações. Quaisquer dados de outro estado são somente contexto regional, nunca medições atribuídas ao RJ.

**Resolução de divergências:** duas **observações oficiais independentes, atuais e comparáveis** entre as primeiras fontes bastam para uma média ponderada com pesos justificados. Se divergirem, tentar a terceira fonte oficial. Persistindo a discrepância, consultar **primeiro INPE/CPTEC como previsão**, e **somente se não orientar suficientemente, Windy como modelo comparativo**. Mostrar separadamente uma **medição oficial** e a **previsão de desempate** com fonte, intervalo e horário; preservar as demais medições divergentes para auditoria. A proximidade de um modelo não comprova que o outro sensor esteja errado. **Não fazer média de previsão com observação, nem média de categoria de alerta.** Se nenhuma fonte atual puder ser verificada, não inventar valor nem emitir alerta automático.

**Autonomia dos dados:** NOAA + Marinha + autoridades brasileiras para alerta de tsunami, sem fonte única substituindo aviso competente. USGS e redes oficiais para sismos. NOAA GOES-GLM e redes terrestres autorizadas para raios. ANA e SGB/SACE para rios; CEMADEN e Defesa Civil para enchentes/deslizamentos; Marinha para mar/ressaca/ondas.

**Independência:** repetição de um boletim do INMET no Monitora RJ/SES não vira segunda medição independente. Windy visualiza modelos: usar a origem e a execução do modelo para evitar contar o mesmo modelo duas vezes.

## Calculadora Blaise Vector/Fusion — módulos exigidos

| Bloco | Fórmulas / métodos | Limites / validação |
|---|---|---|
| Comparação | Média ponderada, dispersão, detecção de discrepância, metadados e independência | Mesma unidade, período, região, origem e pesos comprovados |
| Térmica | Temperatura, Rothfusz, vento-frio, ponto de orvalho Magnus, bulbo úmido, pressão de vapor, temperatura virtual | Fórmula só dentro de domínio físico; dados válidos |
| Atmosfera | Tendência de pressão, gradientes térmicos, advecção, vorticidade, divergência e convergência de umidade | Estaçõ​es/grades e projeção física necessárias |
| Tempestades | CAPE, CIN, LCL/LFC/EL quando calculáveis, cisalhamento 0–1/0–6 km, helicidade, água precipitável | Perfis verticais reais; não assumir ocorrência |
| Radar/chuva | Extrapolação por frames reais, Z–R calibrada, acumulados 5/10/15/30 min, 1h, 24h | Calibração e janela completa; sem colorização fictícia |
| Oceano | Ondas, tendência de maré, rajadas, circulação e advecção, deslocamento de ciclones | Produtos/boias/marégrafos reais, horizonte de previsão e incerteza |
| Hidrologia | Cota, vazão, tendência, acumulados e risco por fontes competentes | Distinguir leitura de estação, previsão e aviso |
| Aprendizado/erro | MOS, Kalman e média de previsões com habilidade histórica | Coeficientes e validação regional demonstrados |

**Cadência desejada:** níveis 1–3 a cada até 5 min; 4–5 a cada 1 min; em confirmação dupla independente de severidade 5 + validação Blaise, recálculo interno alvo 25 s **somente se fontes/dados/licenças suportarem**. Som e voz **apenas categoria 5**. Nenhum cálculo é autorização isolada de sirene.

**Agentes:** Sentinel 1 (fontes), Vector 2 (ciência), Fusion 3 (desempate), Track 4 (rota), Hydro 5 (rios), Ocean 6 (mar), Seismo 7 (sismos), Audit 8 (ciência), Correção Horária 9 (qualidade/bugs), Auditoria Profunda 10 (segurança/escala). Os rótulos 9 e 10 permanecem funcionais; não declarar dez processos autônomos implantados.

**Estado de implantação:** configuração declarativa na PR #102 (rascunho). Sem alegar integração real dos 28 feeds, lançamento, licenças de todos os produtos, monitoramento contínuo ou teste físico de voz/assinaturas.
