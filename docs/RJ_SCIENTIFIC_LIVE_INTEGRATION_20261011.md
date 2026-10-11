# Blaise V6 RJ — Integração real da ciência, fontes e escala 1–5

Data: 11/10/2026. Escopo exclusivo RJ: 92 municípios e Atlântico adjacente com potencial impacto RJ. Esta especificação corresponde à **PR #101 em rascunho**, não a serviço automaticamente implantado.

## Fluxo integrado e agentes reais envolvidos

1. **Sentinel RJ (1)** verifica URL, HTTPS, município, produto, licença, intervalo e data da medição. O backend existente tem probes, caches e scheduler para Alerta Rio (chuva), CEMADEN-RJ (risco hidrológico de 92 municípios), INMET CAP (avisos) e CHM (avisos marítimos), cada qual dependente da configuração explícita.
2. **Fusion RJ (3)** mantém a matriz de consulta por fenômeno e local: Alerta Rio **somente Rio município** → Defesa Civil competente → INMET; INPE/CPTEC como primeiro desempate de previsão, Windy caso necessário. As previsões são **separadas de medições**. Dois provedores independentes com medições compatíveis bastam para média ponderada; dados não recebidos não são inventados.
3. **Vector RJ (2)** transforma **medições válidas de estações meteorológicas Alerta Rio** (somente IBGE 3304557) em jobs físicos de pressão de vapor, umidade calculada e bulbo úmido, usados por `evaluateScientificJobs`. Os métodos avançados existentes (PWAT, CAPE/CIN entre LFC/EL validados, helicidade, shear, vento, advecção, radar calibrado, chuva acumulada por janela, gradiente térmico, perfis verticais etc.) permanecem condicionados a seus respectivos **perfis/frames/coeficientes reais e comprovados**; **não** são acionados só porque existe CAP ou risco CEMADEN.
4. **Hydro RJ (5)** interpreta níveis de risco hidrológico que a fonte **de fato** atribuiu ao município. Não confunde categoria de risco com chuva medida em estação ou severidade CAP.
5. **Audit RJ (8)** executa verificação de proveniência dos jobs e gera revisão municipal por fenômeno. O diagnóstico é experimental e não constitui segunda autoridade oficial nem indicação de segurança.
6. **Track (4), Ocean (6), Seismo (7)** seguem definidos por domínio e só entram com vetores espaciais, avisos marítimos, sismológicos ou produtos específicos vigentes e autorizados. **Agentes 9/10** têm checklists/schedules de CI e capacidade; isso não comprova 10 processos autônomos implantados.

## Risco por cidade e níveis 4–5

Módulo `backend/src/rj-science-risk-engine.mjs`:

- Usa o **MESMO snapshot vigente** retornado por `buildStatewideDashboardSnapshot(sourceWorker)` com código IBGE exato. INMET CAP Severe corresponde a etiqueta de revisão nível 4 e Extreme nível 5; CEMADEN usa seus níveis próprios 1–5, sem supor cobertura quando a fonte está indisponível.
- `officialDisplayScale` é um **resumo de prioridade da fonte**, e não a aprovação de um novo alerta do Blaise. `hydroScale` e `meteorologicalWarningScale` continuam distintos.
- Em 4/5, `reviewState=HIGH_PRIORITY_OFFICIAL_SOURCE_RECHECK_REQUIRED`, com alvo de coleta/revalidação de 60 segundos no registro de agentes. O controlador de frequência pode reduzir **coleta de fontes para 30 segundos**, somente com consentimento dos termos de frequência; a coleta externa a 25 segundos **não é autorizada**.
- Um único alerta oficial de nível alto deve continuar **visível** sem esperar cálculos. Entretanto, **duas fontes de fenômenos diferentes não contam como dois avisos do mesmo evento**, e nenhuma média, modelo ou fórmula pode disparar alerta P0, voz ou sirene por conta própria.
- O gate `evaluateExtremeAudioGate` exige dois avisos oficiais independentes, atuais, mesmo município e mesmo fenômeno, **mais** um diagnóstico interno revalidado; sua saída é apenas elegibilidade para revisão pelo publicador separado, sem publicação automática.
- Dados antigos, alarmes cancelados, códigos municipais ambíguos, dados externos de outros estados, gráficos sem fonte, parâmetros sintéticos e amostras insuficientes são recusados.
- Sem evidência válida: **não** declarar ausência de risco. Mostrar o último valor permitido com horário original e a indisponibilidade atual.

## Ligações efetivamente implementadas na PR

| Arquivo | Integração |
|---|---|
| `backend/src/rj-station-science-inputs.mjs` | Cria jobs científicos somente com estações meteorológicas recentes do município do Rio |
| `backend/src/blaise-vector-rj.mjs` | Executa jobs da própria estação e outros jobs científicos autorizados; falha segura |
| `backend/src/rj-science-risk-engine.mjs` | Cruza 92 riscos municipais CEMADEN e avisos INMET CAP com resultados científicos realmente calculados |
| `backend/src/rj-public-status-http.mjs` | Acrescenta resumo `scientificReview` ao status público, somente se habilitado e com termos aprovados; **sem dependência de assinatura** |
| `backend/src/rj-severe-cadence-controller.mjs` | Controle da modalidade normal/severa baseado em dados de risco oficiais, sem iniciar coleta por si mesmo |
| `backend/src/runtime.mjs` | Liga o Vector e os coletores ao status/diagnóstico, sob controles de execução |
| `backend/src/rj-source-readiness.mjs` | Diagnóstico interno de status de ciência e cadência, **somente para operador autenticado por OIDC** |

Variáveis do Cloud Run (todas exigem autorização e não devem ser habilitadas sem testes):
- `BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED=true` para coletar fontes já configuradas.
- Para cada fonte disponível: `BLAISE_CEMADEN_RJ_ENABLED`, `BLAISE_INMET_WARNINGS_ENABLED`, `BLAISE_CHM_WARNINGS_ENABLED` e outras flags pertinentes. **INEA permanece aposentado.**
- `BLAISE_RJ_PUBLIC_STATUS_ENABLED=true` **e** `BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED=true` para disponibilizar o produto público da fonte; caso contrário, o endpoint fica inativo.
- `BLAISE_RJ_ADAPTIVE_SEVERITY_ENABLED=true` **e** `BLAISE_RJ_PROVIDER_30S_TERMS_APPROVED=true` para habilitar modalidade de atualização adaptativa de 30 s, **somente após revisar frequência e acesso de cada provedor**.
- `BLAISE_OBSERVABILITY_AUDIENCE` e `BLAISE_OBSERVABILITY_SERVICE_ACCOUNT` configurados apropriadamente habilitam diagnóstico operacional protegido, sem expor compras/assinaturas.

## Pendências fundamentais para alegar "100% tempo real"

- Homologar URLs/APIs e licença de uso comercial e frequência para **INPE/CPTEC e Windy**. A PR **não** cria conectores fictícios ou contorna termos de terceiros.
- Validar acesso efetivo da Defesa Civil regional por município, INMET meteorologia por estação fora da cidade do Rio, ANA/SGB/SACE por estação, NOAA e CHM por produto.
- Radar espacial próprio necessita **grades de chuva calibradas e georreferenciadas reais e licenciadas**; a existência de estações não autoriza desenhar precipitação contínua inventada.
- Para calcular CAPE/CIN, helicidade, nowcasting e deslocamento de ciclones precisam existir **perfis atmosféricos, vetores, imagens/grades válidas, verificação temporal e estudos de skill regional**.
- Testar fonte API ao vivo, rede lenta/intermitente, dados desatualizados, 92 municípios, limites dos alertas, erros de rede e frequência real do Cloud Run.
- Testes físicos do reconhecimento de voz feminina, microfone e assinatura Play precisam de aparelho e ambiente Google Play homologado; verificação de identidade Play permanece condição externa.
- Os testes unitários/CI não equivalem a serviço operacional contínuo. **Nada foi publicado nas lojas por esta PR.**

### Critério para merge e ativação
Backend tests e Android verify aprovados; gate de origem/termos; visualização fiel de dados indisponíveis; inspeção de segurança e auditoria; revisão da política de alertas extremos; evidência real das fontes. Até lá, manter PR Draft.
