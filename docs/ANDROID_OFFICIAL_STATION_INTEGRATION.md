# Integração Android de observações oficiais —06/10/2026

Consulta direta ao HTML público do Alerta Rio para perguntas que indiquem estação/bairro disponível: São Cristóvão, Jardim Botânico, Barra/Riocentro, Guaratiba, Santa Cruz, Alto da Boa Vista, Vidigal e Irajá. Temperatura/umidade/vento médio podem estar ausentes por estação. Medição representa estação, não todo bairro/município. O parser recusa valores impossíveis, duplicação, datas inválidas e leituras futuras ou com mais de30min. Mantém unidades, hora de Brasília e identificação da fonte. Teste com HTML oficial capturado em06/10 preservado como fixture.

Contexto da estação permanece nas perguntas seguintes. Rio/Rio de Janeiro continua Centro do Rio; não substituir por São Cristóvão. Niterói ainda depende do INMET ou outro contrato local validado. Sensação térmica/UV/probabilidade de chuva/nebulosidade/rajadas não são produzidos a partir desses campos. Previsão continua indisponível sem provedor validado.

Interface: Leia mais abre informativo em tela inteira com retorno; botão superior liga/desliga; navegação foi posicionada depois dos painéis. Preserva painéis existentes, mas não implementa toda a referência visual: personagem, fundo cartográfico/camadas/radar e vários conteúdos oficiais ainda faltam. A imagem de referência tem números ilustrativos que não foram inseridos no aplicativo.

Validação:75 testes unitários Android passaram; assembleDebug e compilação dos testes instrumentados passaram. Testes instrumentados/microfone/áudio não executados em aparelho. A consulta de fonte no ambiente de desenvolvimento respondeu200 em9272ms, medição única: não é p95 de produção nem validação de precisão meteorológica. Resultado em ALERTA_RIO_FETCH_LATENCY_20261006.json.

Bloqueios para entrega completa: serviços INMET502 e CPTEC403 nos testes anteriores; faltam perfis atmosféricos para CAPE/CIN/SRH, radar georreferenciado/calibrado, entradas hidrológicas locais e batimetria/contornos para simulação de tsunami. Não há acesso de implantação Cloud Run executável neste ambiente. Workflow atual usa min-instances=0 e não demonstra CPU permanente/eleição de coletor único; runtime iniciado não equivale a serviço contínuo de produção. Não alterar configuração de custo/escala sem validação operacional.

Esta revisão é integração parcial executável; não é a implementação completa dos cinco motores nem a interface oficial final.
