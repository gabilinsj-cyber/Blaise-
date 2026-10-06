# Blaise V6 RJ — conexão dos dados à interface

## Implementado no código

- Cartões e página Cidades consomem observações estruturadas do mesmo cliente usado pelo assistente. Cada medição conserva município, estação, fonte, URL, horário, cobertura, unidades e limite de idade. Não transforma ausência de valores em zero ou ausência de risco.
- Consulta de observações a cada 60 segundos, enquanto o aplicativo está ligado e em primeiro plano; relógio da tela revalida idade a cada 30 segundos. Observação de outra cidade, futura, vencida, não física ou completamente vazia é recusada. O Centro do Rio não recebe valores de outra estação como substituto.
- Cabeçalho mostra a última medição disponível; boletim de duas frases e página Leia mais usam os mesmos resultados, sem uma coleta paralela duplicada. Períodos 06:00, 12:00 e 16:00 em Brasília; o horário do período não vira horário de observação.
- Personagem feminina renderizada a partir de um viewport do arquivo original aprovado 1000007912.png. O arquivo de referência permanece íntegro; apenas o personagem é exibido. Seus números, mapa, alertas e séries ilustrativos nunca são apresentados como dados atuais.
- Ligação do cliente Android à rota existente /v1/data/dashboard após compra verificada. Nenhum token é persistido, mostrado ou registrado pela nova ligação. Revogação, desligamento e mudança de contexto removem a apresentação; callbacks de verificações anteriores são ignorados.
- Resumo de chuva mostra máximos por estação na rede municipal do Rio, fonte e horário, sem tratá-los como média do município, dado do Centro ou de Niterói. Fonte vencida é retirada mesmo quando generatedAt muda.
- Botões Mais de notícias e sismologia passaram a abrir página/detalhes; não afirmam que eventos não integrados estejam ausentes.
- Perguntas mistas mantêm consulta das variáveis disponíveis e identificam variáveis ainda indisponíveis. Bairros reconhecidos mantêm escopo próprio, sem herdar outra cidade; toponímia conflitante pede esclarecimento. Voz mantém envio direto do reconhecimento final e resposta Dora; texto permanece escrito.
- Runtime passa ao coletor existente intervalos alvo de 60 segundos normal e 30 segundos severo. Vector mantém revalidação de 30 segundos. O relógio do backend conta os intervalos entre inícios; tarefas demoradas pulam janelas perdidas sem sobreposição ou rajadas de recuperação. Não garante latência operacional e deve respeitar contratos das fontes. A implantação não foi executada.

## Validação local

81 testes Android passaram; APK debug compilado e testes instrumentados compilados. 410 testes backend passaram, incluindo configuração de cadência sem alterar timestamp da fonte. Compilação incremental Kotlin apresentou conflito de cache; recompilação integral passou. Não houve teste em aparelho/emulador, comparação visual por captura nem medição operacional de áudio, precisão ou latência.

## Bloqueios concretos e pendências

A build local ainda não possui BLAISE_ENTITLEMENT_VERIFY_URL ou produtos Play configurados. A rota protegida continua bloqueada sem configuração e verificação real, preservando a política existente. Não há ferramenta de implantação GCP nesta sessão; gcloud não está instalado e a ferramenta GitHub não disponibiliza despacho de workflows ou leitura de variáveis de configuração. As consultas web a healthz/readyz não puderam acessar o serviço; isso não prova indisponibilidade do serviço.

Faltam chave privada Windy e conectores operacionais NOAA/Windy, ingestão/decodificação/georreferenciamento de satélite, rastreamento e incerteza, fornecedores científicos ativos, CAPE completo, radar, hidrologia e tsunami costeiro validados. A rotina matemática não comprova precisão de previsão.

Centro do Rio e Niterói ainda não têm observações locais confirmadas disponíveis nessa integração. Sensação térmica, UV, previsão com emissão válida, ondas, tráfego, qualidade do ar, risco, notícias e sismos permanecem sem preenchimento operacional integral. Mapa e séries gráficas ainda precisam de dados reais e implementação. A identidade e estrutura foram mantidas, mas a fidelidade integral à imagem aprovada não foi validada. Personagem de referência não equivale a validação visual da tela inteira.

Cloud Run necessita credenciais/configuração, ciclo continuamente ativo com CPU disponível e coordenação entre instâncias/cache. Nada foi promovido para produção. Não apresentar o APK desta etapa como aplicativo concluído ou release para lojas.
