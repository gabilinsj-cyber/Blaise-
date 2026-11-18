# Blaise V6 RJ — recuperação do chat “Reenviar e-mail HG Brasil” e alinhamento de interface

**Data:** 18 de novembro de 2026. **Escopo:** aplicativo original Blaise V6 RJ, 92 municípios do estado do Rio de Janeiro, Atlântico adjacente e variante administrativa. Esta recuperação compila **decisões verificáveis e referências ao código**, não a transcrição literal do chat nem das capturas de tela.

**PR de integração da interface:** branch `feature/rj-hgbrasil-chat-interface-sync-20261118`, criada sobre `feature/rj-meteoblue-free-credential-gate-20261118` (PR #171). **Não mesclar automaticamente, não implantar, não mudar Cloud Run, não atualizar Play Store ou APK atual**. Preservar `main`, `~/Blaise-RJ`, backups `~/blaise-rj-safety/` e aparelho dos clientes, sem operações destrutivas.

## 1. Resposta comercial HG Brasil — confirmada por e-mail

Em 17/11/2026 às 21:03 BRT houve resposta escrita da HG Brasil ao pedido de autorização comercial. Condições declaradas pelo fornecedor:

- Plano **HG Weather Pro** considerado adequado para aplicativo Android com assinantes, sem licença adicional para **exibir informações como parte das funcionalidades do Blaise**, desde que observados os termos.
- **Proibida revenda/redistribuição da base bruta da API como produto independente**.
- Atribuição `HG Brasil` e horário de atualização recomendados; chave de API apenas no servidor; **cache temporário permitido/recomendado**.
- 100 cidades distintas por ciclo mensal; **20.000 requisições/dia**; previsão de até **15 dias**; periodicidade da API de até **1 hora**.
- Planejamento: **92 municípios × 24 consultas/dia = 2.208 consultas/dia**, 66.240 em 30 dias. Saldo teórico da quota diária: 17.792 antes de retries e requisições administrativas.
- Valor de referência **R$ 49,90 por mês** (preço anunciado no momento do pedido, confirmar no momento da assinatura).
- **Limitação científica determinante:** a HG Brasil **não disponibiliza identificação individualizada da estação ou fonte original por campo retornado**. Logo, temperatura, vento, umidade, chuva agregada e demais condições não podem ser apresentadas como leitura instrumental `O` de um sensor identificado. Usar `E` (agregado/estimado) para condições atuais e `P` para previsão, sujeito ao contrato do campo.
- A autorização escrita **não é contratação**: plano **não adquirido**, chave HG não instalada, zero consultas HG habilitadas, nenhum pagamento autorizado até a etapa de lançamento.

Referências: correspondência Gmail `Solicitação de autorização comercial — API HG Weather no aplicativo Blaise V6 RJ`, com resposta de 17/11; plano técnico e gates do repositório em `backend/src/rj-hgbrasil-pro-plan.mjs`; PR #158.

## 2. Climatempo — orçamento enviado, não contratação

Em **18/11/2026 às 10:45 BRT**, foi enviado pedido de proposta à consultoria Climatempo para **API Advisor e produtos adicionais**. Dimensionamento solicitado: 92 municípios, **2.208 requisições/dia / 66.240 em 30 dias**, consulta horária compartilhada entre assinantes e dados por fonte/horário.

Perguntas enviadas: preço mensal/anual, implantação, excesso, sandbox, licença comercial, cache, SLA, observação instrumental de temperatura/vento/pressão/umidade, chuva de pluviômetros/radar até 30 min, raios/granizo/visibilidade/UV, previsões e produtos oceanográficos/hidrológicos. Não há resposta comercial conclusiva verificada neste registro; **sem contrato, sem chave, sem ativação**.

**Decisão do proprietário:** concluir primeiro coletores gratuitos e validações técnicas; deixar HG Brasil Pro para o lançamento e manter Climatempo apenas como orçamento, sem pagamento antecipado.

## 3. Hierarquia térmica efetivamente aprovada em 18/11

Temperatura:
1. **HG Brasil (E, atual agregado)** — somente quando plano Pro realmente contratado, licença/credencial, município e validade auditados.
2. **OpenWeather One Call 4.0 / Agente 13 (E)** — disponibilidade/termos e `Firestore` com teto interno 900 consultas/dia e cache, sem mascarar estimativa como medição.
3. **DWD ICON Global (P)** — temperatura 2 m **prevista**, por célula/ponto IBGE auditado, com rodada/validade e pesos de regrade oficiais.

Sensação térmica: diretamente `OpenWeather.feels_like` como estimativa E validada; cálculos Blaise (índice de calor / vento-frio etc.) só com entradas auditadas e domínio físico aplicável; não chamar formulações de medição `O`.

**Proibido para temperatura e sensação:** NOAA GFS, ECMWF/MET Norway, Climatempo, SST oceânica, meteoblue Free `basic-6h` e imagens RAMMB/CIRA. NOAA e ECMWF permanecem candidatos em **outros** setores conforme produto e licença. INMET/CEMADEN, quando relevantes, permanecem **comparação administrativa**, sem dados numéricos no Android público. Defesa Civil RJ/Alerta Rio permanecem somente encaminhamentos oficiais próprios por frase curta + link.

## 4. Medidores e coletores: posição consolidada

| Setor | Implementação reaproveitável | Pendência concreta |
|---|---|---|
| Temperatura prevista 2 m | DWD ICON T_2M / 92 pontos IBGE em staging (PRs #163 e #165) | Fixar pesos CDO oficiais + SHA-256 no DWD Open Data v1, rodadas/validade e ponte homologada ao app |
| Temperatura / térmica estimadas | Gates HG Pro (PR #158), Agente 13 OpenWeather com teto 900/dia (PRs #157/#164) | Nenhuma aquisição HG; OpenWeather exige auditoria de resposta real e conexão segura |
| Chuva observada agora e acumulados | Catálogo O/E/P e filtro de validade | Instrumento/pluviômetro/radar de origem licenciada e tempo <=30 min; sem valores disponíveis não inferir zero |
| Chuva futura / vento / pressão / umidade | DWD/ECMWF/NOAA + meteoblue mLM 6h (PR #171) | Validar produto, intervalo, unidade, emissão, licença e cobertura; mLM não é voto independente |
| Raios | NOAA GOES-19 GLM staging (PR #170) | Provar leitura real de flashes, atraso e abrangência; não transformar contagem de ~20s em aviso oficial |
| Ondas / swell | NOAA GFS Wave (PR #166) | Prova atual, 3 áreas oceânicas e interface sem atribuição a municípios do interior |
| SST oceânica | NOAA CoastWatch GOES-19 (PRs #168/#169) | Validar pixel QA=5 e arquivo recente; não misturar SST com temperatura do ar |
| Rios e cheias | ANA/SGB catálogo | Acesso/autorização exigidos para algumas APIs e validação de estações; sem níveis fictícios |
| Satélite visual | RAMMB/CIRA SLIDER | Só link externo ao visualizador NOAA; não copiar mapa ou extrair medições numéricas |
| Alertas oficiais | Páginas Alerta Rio/Defesa Civil RJ | Frase curta + link; indicador ativo só de evidência autenticada, nunca de cor ilustrativa |

**Fontes retiradas diretamente da coleta/interface meteorológica:** EUMETSAT, NASA, JAXA, INEA, Marinha/CHM, Windy, Zoom Earth e Copernicus **direto**. O código antigo e histórico podem conter esses nomes. UV `CAMS clear-sky via MET Norway` aparece como exceção técnica em versões anteriores: **não presumir ativação nem ressuscitar um feed Copernicus direto** sem revalidar política/licença. Índice de UV de céu limpo não equivale a UV observado com nuvens.

## 5. meteoblue Free — aproveitar sem consumir créditos indevidamente

- O operador viu **10.000.000 de créditos gratuitos**, validade indicada até 18/11/2027. Uma chamada Cloud Shell anterior obteve HTTP 200 e 29 horários `basic-6h`.
- **Somente comparação privada P**, não fonte de temperatura atual, sensação, chuva observada, alertas, raios ou dados de estações.
- Parser e testes offline validam sete campos: chuva acumulada 6h, parte convectiva 6h, probabilidade de chuva 6h, vento médio/máximo 6h (NÃO rajada instrumental), umidade média 6h, pressão nível do mar média 6h.
- Custo previsto **4.000 créditos/chamada**; `Firestore` transacional: teto interno **8.000.000**, máximo **4 chamadas por UTC/dia**, **1 chamada por município a cada 24h**, cache privado de **6h**. O saldo **real do fornecedor não foi lido**; números no código não são saldo confirmado. A chave exposta em print exige rotação antes de coleta contínua.
- Resposta real com valores/unidades ainda não auditada pelo novo coletor. Sem agendamento, cliente ou publicação. Caminho legado de teste sem ledger desativado na PR #171.
- Uma varredura de 92 municípios custa 368 mil créditos, impedindo que o Free seja tratado como feed contínuo horário dos 92 municípios.

## 6. Interface original do Blaise V6 RJ — atualização segura

Referência original visual recuperada: painel azul-marinho com logotipo dourado **Blaise V6 RJ • Clima e Tempo**, botão **LIGADO** verde, assistente/microfone, dois painéis municipais laterais, **mapa próprio do RJ central**, radar/chuva/temperatura/vento/risco, alertas, mar, trânsito, ar, notícias, históricos e rodapé de navegação. Os números e boletins da imagem são **ilustrativos**, assim como algumas referências antigas a fontes excluídas. **Nunca** copiá-los para uso real.

Alterações implementadas nesta branch de **desenvolvimento, não no APK existente**:
1. `FinalDashboardSpec.officialSources`: **remove EUMETSAT** e substitui rótulo `meteoblue NEMS10` por **meteoblue Free • mLM 6h**. Prioridade térmica de planejamento alinhada: HG não contratado, OpenWeather/Agente 13 e DWD/ICON.
2. `MainActivity.kt`: duas tarefas de coleta **legadas de estações brasileiras no aplicativo de assinantes** ficam explicitamente bloqueadas pelo novo gate `DOMESTIC_STATION_COLLECTION_IN_SUBSCRIBER = false`. O back-end de assinaturas e os produtos internacionais com validação própria permanecem independentes. Como ainda faltam coletores substitutos homologados, campos podem aparecer como indisponíveis; não preencher com INMET/CEMADEN ou números inventados.
3. `WeatherSourceResponsibility.kt`: HG com estado de autorização sem contrato e falta de estação individual, meteoblue mLM corretamente classificada `P`, não `NEMS10` nem fonte ativa.
4. **APK administrativo**: após autenticação por claim Firebase `blaise_admin`, exibe **status documental** de HG, Climatempo, DWD, OpenWeather, meteoblue, NOAA e avisos oficiais, sem consultar provedores nem revelar dados de clientes. Não diz que o saldo real foi consultado. Os cálculos administrativos originais são preservados.
5. Testes de regressão Kotlin para fonte térmica, exclusões, orçamento e assinaturas não ativadas. Sem imagens de mapa de terceiros, sem novos endpoints de usuário, sem chave ou rastreamento de localização/voz.

Aparência e disposição das telas originais permanecem as mesmas; esta atualização corrige **os conteúdos, o contrato de fontes e o painel administrativo**, não substitui a interface por um protótipo.

## 7. Trabalho já pronto, mas sem confundir com operação contínua

- PRs fundacionais #141/#142: unificação por município e validade/histórico.
- PR #152: UI adaptativa, mapa próprio do RJ e fontes/timestamps.
- PR #153: gate APK cliente até 400 MB, voz pt-BR preservada.
- PRs #157/#158/#159: Agente 13, HG Pro planejada e APK admin QA.
- PRs #163–#170: DWD, NOAA mar/SST/raios, exclusão EUMETSAT, código staging.
- PR #171: meteoblue Free, parser, créditos Firestore, testes offline e documentação.
- Nova branch desta etapa: integração da memória do chat HG + correções de UI e ADM.

Todos os commits permanecem no GitHub, inclusive histórico anterior a mudanças de política. PRs **draft empilhadas** precisam de revisão de dependências, CI de HEAD verde e inspeção manual antes de merge, release ou canário.

## 8. Próximos gates concretos (sem contratação)

1. Rodar CI do commit mais novo da branch; testar compilação Android `client` e `admin` e confirmar que nenhum cliente consome estação doméstica/instrumento proibido.
2. Validar trabalho DWD ICON 92/92 e migração Open Data v1, pesos + hash para operação futura. Só emitir valores assinados, geoverificados, com carimbo de validade.
3. Inspecionar **sem chamada externa** o orçamento Firestore meteoblue e comprovar no painel do fornecedor o saldo real e ausência de auto top-up. Se a infraestrutura/segredo não estiver disponível, manter OFF, sem gastos.
4. Homologar coletor privado com uma única chamada meteoblue após revisão e reserva de créditos (não executar automaticamente).
5. Conectar aos cards, gráficos, mapa e assistente **somente** campos e fontes com prova de licença, categoria O/E/P, ponto/hora e entrada válida; preservar `Indisponível` no restante.
6. Validar observações de chuva, tempestades, rios, ondas, corrente/swell e riscos específicos separadamente; falta de registro `O` não se corrige com previsão `P`.
7. Acompanhar **resposta comercial da Climatempo**, comparar com lacunas ainda reais, e só considerar contrato HG Pro **próximo ao lançamento**, mediante autorização expressa.

**Regra:** preparar/cadastrar/testar não é ativar. Dados reais só podem ser declarados em produção após evidência. Não alterar Cloud Run, loja, APK ou plano pago nesta branch.
