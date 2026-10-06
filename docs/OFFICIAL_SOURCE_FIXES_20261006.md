# Revalidação dos conectores oficiais — Blaise V6 RJ

Execução de 06/10/2026, aproximadamente 19:23 BRT / 22:23 UTC.

## Correções aplicadas

- INMET: o RSS é tratado como índice. Resolve até 128 documentos CAP, com seis acessos simultâneos, limite individual de 2 MiB, agregado de 16 MiB e prazo de resolução de 90 s. Aceita apenas links HTTPS do host oficial, no caminho numérico esperado, sem credenciais, query ou fragmento. Nenhuma falha de documento resulta em aprovação parcial. Cancelamentos CAP exigem referências oficiais válidas e retiram os registros referenciados da lista de alertas.
- CEMADEN: alias específico da fonte “Armação de Búzios” corresponde ao município canônico “Armação dos Búzios”, IBGE 3300233. Mantidos os 92 municípios, rejeição de duplicatas, pares risco/prioridade e horários originais.
- CHM: página observada de 2.610.357 bytes passa a ter limite explícito de 4 MiB. O leitor preserva a direção NW/SW, sem inventar uma direção média. O catálogo não permite que o texto de uma estação de outro estado contamine a identidade da primeira estação RJ.
- PDFs CHM: um único redirecionamento HTTPS para assets.marinha.mil.br é aceito somente com o mesmo caminho da publicação. Mudança de arquivo, host arbitrário, HTTP, credenciais e redirecionamentos subsequentes continuam bloqueados.

## Resultado

| Verificação | Resultado |
|---|---|
| Testes backend | 417 aprovados, zero falhas |
| Sintaxe e whitespace | Aprovados |
| INMET | PASS_SOURCE_CONTRACT; 53 registros não cancelados, 16 com referência RJ; leitura do índice e documentos CAP reais |
| CEMADEN-RJ | PASS_SOURCE_CONTRACT; 92 municípios; validade operacional de cada estado ainda não comprovada |
| CHM avisos | Leitura de inventário e cronologia aprovadas; isto não confirma impacto na costa RJ |
| CHM catálogo | Sete estações e links oficiais identificados |
| CHM marés, PDFs e valores | Bloqueado por chm_tide_pdf_source_http_error; extração e ingestão completas não aprovadas |

Os números do inventário INMET não equivalem a quantidade de alertas atualmente vigentes. O coletor mantém onset/expires e a política de emissão não publicou notificações. Os registros CEMADEN incluem timestamps anteriores ao dia desta consulta; horário de coleta não renova a validade do estado. Os 417 testes incluem contratos e matemática, não validação de previsão ou áudio em aparelho.

Alerta Rio permanece fonte aprovada e não foi substituído. INEA não foi consultado nesta etapa nem considerado dependência. A exclusão documental não implica remoção automática de todos os módulos legados do repositório.

Não houve implantação Cloud Run, atualização do APK instalado, promoção de produção ou emissão de alerta nesta revalidação. Permanecem pendentes conectores operacionais e entradas dos módulos de mapa, ondas, satélite e cálculo científico já registrados no projeto.
