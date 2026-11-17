# Blaise V6 RJ — memória científica administrativa e faixa superior de avisos
**Data da regra: 17/11/2026.** Registro de decisões e implementação em PR #157. Não equivale a lançamento de produto ou validação de feed real.

## Separação obrigatória entre aplicativos
- **Cliente**: `br.com.blaise.rj`, acesso às duas cidades, mapa, boletins e faixa de consulta oficial. **Não recebe o painel administrativo de fórmulas**.
- **Administrador**: variante `admin`, package `br.com.blaise.rj.admin`; `app/src/admin/java/br/com/blaise/rj/AdminScientificActivity.kt` e `ScientificMemoryPolicy.kt`. O launcher requer autenticação Firebase com custom claim `blaise_admin=true`; atividade não exportada no AndroidManifest admin. É apenas *barreira de interface*. Qualquer endpoint de dados administrativos deve exigir verificação do JWT e das permissões no **backend**; nunca confiar no package ID isoladamente.
- **Memória científica**: catálogo estático de métodos versionados e arquivos de código; sem registro de dados pessoais, localização, voz ou contas. Entradas manuais não são sincronizadas nem publicadas.

## Métodos científicos já existentes no ramo de trabalho (19 funções)
Arquivo: `backend/src/blaise-scientific-kernels.mjs` (16) e `backend/src/blaise-marine-kernels.mjs` (3). Exposição atual por `backend/src/blaise-scientific-jobs.mjs`, protegida por contrato de fontes e validade:

1. Termodinâmica/hidrologia: `equivalentPotentialTemperatureApprox`, `clausiusClapeyronDerivative`, `precipitableWater`, `referenceEvapotranspirationDaily`, `soilWaterBalance`.
2. Vento/tempestade/radar: `neutralMeanWindProfile`, `calibratedTurbulentGust`, `bulkWindShear`, `stormRelativeHelicity`, `horizontalWindDiagnostics`, `stationPressureTendency`, `calibratedKdpRainRate`.
3. Estatística: `calibratedMos`, `scalarKalmanUpdate`.
4. Oceano/mar: `oceanWindStress`, `tropicalCycloneHeatPotential`, `significantWaveSpectrum`, `linearWaveDispersion`, `conditionalMarineTravelTime`.

Algumas fórmulas exigem calibração local, perfis verticalizados, altitude, tempo, unidades SI e cobertura; **disponibilidade do código não é evidência de entradas ou execução contínua**. Outras funções científicas no branch `main` deverão ser auditadas antes de portadas, sem sobrescrever implementações. Nunca anunciar cálculo como observação, previsão validada, radar real ou alerta oficial.

### Diagnósticos simples do administrador (calculadora manual)
Entrada digitada pelo administrador no APK administrativo; nenhuma fonte atual é presumida:
- Ponto de orvalho (aproximação Magnus): `γ = ln(UR/100) + 17,625·T/(243,04+T)`; `Td=243,04γ/(17,625−γ)`.
- VPD: `es(T) = 0,6108·exp(17,27 T/(T+237,3))`; `VPD=es(T)·(1−UR/100)`, kPa.
- Bulbo úmido: aproximação empírica Stull, somente no domínio delimitado da fórmula.
- Índice de calor: Rothfusz (quando T ≥ 27°C e UR ≥ 40%).
- Vento-frio: fórmula padrão para T ≤ 10°C e vento ≥ 4,8 km/h.

Sem valor manual: exibir indisponível. Temperatura −20 a 50°C, UR 1 a 100%, vento opcional 0 a 250 km/h. Resultados calculados devem indicar **CÁLCULO MANUAL — NÃO É OBSERVAÇÃO**; fora do domínio uma sensação térmica permanece indisponível. Não usar valores manuais para alertas, mapas, gráficos, boletins, estado climático real ou mensagens a usuários.

## Quatro avisos principais fixos na parte superior
Fonte/URL oficial:
1. **Alerta Rio:** https://www.sistema-alerta-rio.com.br/alertas/
2. **Defesa Civil RJ:** https://defesacivil.rj.gov.br/
3. **INMET:** https://avisos.inmet.gov.br/
4. **INPE / CPTEC:** https://www.cptec.inpe.br/

A faixa abre a página oficial do órgão. Exibir **uma frase própria breve, preta e em negrito**, sem copiar boletim. Cor da escala Blaise somente com evidência do backend autenticado e atual, para município/cobertura RJ, carimbo de checagem, intervalo de validade e nível interno verificado (1–5). Não converter automaticamente as cores/escala nativas dos órgãos para a escala Blaise. Link estático não é prova de alerta ativo; fallback neutro e texto **ALERTAS NÃO VERIFICADOS**. Não presumir `sem alertas`.

**Layout**: quatro cartões fixos, um por fonte, independente de volume ou severidade; em caso de vários alertas de uma mesma fonte, o mais severo permanece no cartão principal e os demais seguem pelo botão **Mais**. Outros avisos verificados obedecem ordem por severidade e preservam frase e link da instituição. A ausência de registros extras mantém o botão oculto e informa ausência de alertas *adicionais validados*, não ausência de perigo real.

**Escala da interface (fundos claros para legibilidade do preto)**:
- 1: verde claro — Atenção;
- 2: amarelo — Atenção reforçada;
- 3: laranja claro — Perigo;
- 4: vermelho claro — Perigo elevado;
- 5: vermelho mais intenso — Perigo extremo.

Frases devem ser orientação curta do **Blaise** a consultar o órgão, não texto atribuído ao órgão. Nível extremo não deve ser disparado a partir de fórmula científica isolada ou site não verificado.

INMET: permanece **apenas como referência interna de divergência meteorológica** nas matrizes de medições, mas agora conta com **link oficial de avisos** na faixa por autorização do usuário. INPE/CPTEC: produto meteorológico de uso licenciado conforme a matriz e link público de previsão/avisos. Alerta Rio/Defesa Civil: seguem como **links oficiais**, não fornecedores de coleta meteorológica nem desempate. Sem reativar INEA, Marinha, Windy nem Copernicus direto; exceção CAMS via MET apenas UV de céu limpo.

## Estado do desenvolvimento
- PR #157 ainda draft / sem merge e sem implantação. Módulos de avisos e a memória científica são mudança de **código de desenvolvimento**.
- Android: `OfficialAlertRibbonPolicy.kt`, `MainActivity.kt`, `AdminScientificActivity.kt`, `ScientificMemoryPolicy.kt`.
- Backend: `official-alert-links-http.mjs` com URLs informativas (não inventário de severidade), `blaise-scientific-*.mjs`.
- Testes: `OfficialAlertRibbonPolicyTest.kt` e `app/src/testAdmin/.../ScientificMemoryPolicyTest.kt`. CI obrigatório antes de merge.
- **Pendente**: fluxo end-to-end de evidência de alertas atualizado por fonte oficial e licenciado; dispositivos físicos; Firebase admin real e autorização no backend; uso de dados meteorológicos internacionais realmente obtidos, validados e exibidos no Android; release gate.
