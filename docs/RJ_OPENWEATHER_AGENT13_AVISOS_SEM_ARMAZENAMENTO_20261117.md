# Blaise V6 RJ — OpenWeather Agente 13 e avisos oficiais somente por encaminhamento
**Regra do proprietário: 17/11/2026. PR #157 permanece em desenvolvimento; sem implantação.**

## 1. OpenWeather One Call 4.0
- Mantida para **Agente 13, contingência estritamente térmica**: temperatura e sensação térmica quando DWD ICON, NOAA GFS e ECMWF/IFS não tiverem o campo válido conforme auditoria da política; **não** vento, chuva, UV, histórico, risco ou avisos.
- Valores do fornecedor são **estimativas E**, nunca temperatura observada de estação; apresentar fonte e UTC. Reavaliar disponibilidade das 3 fontes por campo e município.
- Configuração opcional **DESATIVADA sem assinatura aprovada, chave no servidor e Firestore compartilhado**; não afirmar que está operante. Contingência testada apenas para Rio e Niterói, não generalizar aos 92 municípios sem pontos e auditoria.
- Limite interno de **900 chamadas/dia**, cooldown compartilhado **35 minutos** por município, idade máxima de 35 minutos para a leitura da contingência; separada da regra de 30 minutos para **chuva observada**. Guardar somente quotas/cache de contingência técnica necessários; não dados pessoais ou conteúdo de avisos; chave nunca no APK.
- A API OpenWeather 4.0 possui endpoint de avisos oficiais agregados mas, **por decisão do proprietário, não participa dos quatro links autorizados e não valida/gera avisos Blaise**. Fonte: https://openweathermap.org/api/one-call-4 .

## 2. Exibição dos avisos — quatro portais oficiais, sempre com link
1. **Alerta Rio** — https://www.sistema-alerta-rio.com.br/alertas/ — cobertura do **município do Rio de Janeiro**.
2. **Defesa Civil RJ** — https://defesacivil.rj.gov.br/ — órgão **estadual**; orientações e risco conforme área de competência; não inventar nível estadual para todos os municípios.
3. **INMET** — https://avisos.inmet.gov.br/ — avisos meteorológicos nacionais e cobertura geográfica; escala nativa **amarelo / laranja / vermelho**, que NÃO é equivalente automaticamente à escala 1–5 do Blaise.
4. **INPE/CPTEC** — https://www.cptec.inpe.br/ — avisos/previsão meteorológica; **conteúdo CPTEC não pode ser copiado para uso comercial sem autorização**; fornecer apenas frase original do Blaise e link oficial.

**Uma única frase original, preta e em negrito, por cartão, com nome da fonte e NÍVEL 1–5 apenas quando a evidência atual estiver verificada; botão “Página oficial” separado e direto para o domínio do órgão.** Fundo claro com a cor do nível Blaise:
- 1 verde: Atenção.
- 2 amarelo: Atenção reforçada.
- 3 laranja: Perigo.
- 4 vermelho claro: Perigo elevado.
- 5 vermelho intensificado: Perigo extremo.

**Nunca** reproduzir boletim, descrição, screenshot, mapa ou texto de terceiros. A gravidade, abrangência e validade devem ser comprovadas por fonte autorizada e regras auditáveis antes de exibir nível; nunca converter automaticamente aviso vermelho INMET em nível 5, nem estimativa OpenWeather em aviso oficial. Sem ingestão validada, mostrar **neutro — AVISOS NÃO VERIFICADOS, consulte a página oficial**. A disponibilidade dos links não é confirmação de nenhum aviso ativo, nem de ausência de perigo.

## 3. Sem armazenamento dos avisos
- A faixa `OfficialAlertRibbonPolicy` é uma **função pura de apresentação**, recebe apenas metadados mínimos temporários **em memória durante a exibição**; **não** persiste texto, conteúdo, histórico, áudio, localização, identificador do usuário, resultados de consulta, cor ou severidade em banco local, SharedPreferences, Firebase/Firestore, arquivos ou telemetria de alertas.
- A lista dos quatro **endereços fixos públicos** existe em código e isso **não** é arquivar avisos emitidos.
- O endpoint `/v1/public/official-alert-links` serve **somente links estáticos** com `Cache-Control: no-store` e `alertStatus: NOT_CHECKED`. Não faz scrape, download de boletim nem gravação; ausência de dados não significa sem risco.
- A persistência estritamente técnica de **cotas/cache da OpenWeather** é separada e não pode conter nenhum aviso oficial. Não é correto prometer ausência de logs técnicos de conexão de sistema operacional, navegador, provedor ou hospedagem externa; políticas e configuração de infraestrutura devem ser verificadas separadamente.
- Enquanto não houver um **feed oficial de verificação de avisos contratado/autorizado, com nível e abrangência validada**, manter somente links e texto neutro. Sem comunicação direta com os sistemas de alerta governamentais, não afirmar entrega automática, cobertura de todas as municipalidades ou paridade com **Defesa Civil Alerta** (cell broadcast).

## 4. Implementação
- `backend/src/rj-agent13-temperature-fallback-policy.mjs` e `backend/src/rj-agent13-runtime-optional.mjs` — contingência térmica, quota e estado desligado por padrão; nunca autoridade de avisos.
- `app/src/main/java/br/com/blaise/rj/WeatherSourceResponsibility.kt` — papel OpenWeather visível como contingência E, não feed homologado.
- `app/src/main/java/br/com/blaise/rj/OfficialAlertRibbonPolicy.kt` — 4 fontes fixas e 5 cores; `PERSIST_OFFICIAL_NOTICES = false`; no nível sem evidência.
- `app/src/main/java/br/com/blaise/rj/MainActivity.kt` — **uma única frase em negrito + botão Página oficial**.
- `backend/src/official-alert-links-http.mjs` — `Cache-Control: no-store`; nenhum registro de alertas.
- Testes Android para níveis e proibição de OpenWeather como fonte oficial. **Sem integrar um coletor de alertas ativo nem substituir o sistema governamental de avisos.**
