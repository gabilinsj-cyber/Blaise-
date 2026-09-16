# Auditoria tela por tela — Interface final Blaise V6 RJ

Base auditada: interface final aprovada + contrato `FinalDashboardSpec` + código Android Compose.

## Resultado do ciclo

A interface não foi redesenhada. O ciclo corrige paridade estrutural entre a interface final aprovada e o código Android, mantendo política fail-closed: nenhum valor de clima, alerta, trânsito, mar, ar, notícia, radar ou terremoto é inventado quando o adapter oficial ainda não forneceu evidência válida.

| Tela/área | Paridade corrigida no Android |
|---|---|
| Topo | `BLAISE V6 RJ` compacto, `Clima e Tempo`, última atualização e indicador LIGADO/DESLIGADO |
| Blaise | bloco no topo com `Como posso ajudar?`, microfone visível e campo para digitação; voz/Q&A permanece desabilitado até serviço validado |
| Navegação | Início, Cidades, Mapa, Alertas, Trânsito, Mar e Ondas, Qualidade do Ar, Notícias, Histórico e Mais |
| Início | duas cidades, condições consolidadas, mar/risco, radar real de 30 min, boletins 06:00/12:00/16:00 e notícias |
| Cidades | Cidade 1/Cidade 2 separadas por coluna preta, seleção entre 92 municípios e área de temperatura/térmica/chuva/severidade |
| Mapa | visão Estado do RJ + Cidade 1 + Cidade 2 e camadas de alertas, radar, trânsito, alagamentos, sirenes, apoio e risco |
| Alertas | severidade por cidade, regra de página adicional acima de 3 alertas, urgência/P0, ciclones e regra sísmica >=7,0 sentida no Brasil |
| Trânsito | COR.Rio/CET-Rio/Geo-Rio/Defesa Civil, interdições, acidentes, bolsões d'água, alagamentos, árvores/postes, túneis, deslizamentos, obras e rotas |
| Mar e Ondas | CHM, maré, ondas, vento, ressaca >3,5 m, tsunami meteorológica/tsunami/maremoto e apoio surf/pesca |
| Qualidade do Ar | IQAr, faixa muito ruim/severa, UR ideal 50–60%, faixas abaixo de 30% e UV |
| Notícias | 3 locais recentes, escopos RJ/Niterói/São Gonçalo/Região e bloco internacional; mídia apenas via fonte/embed oficial |
| Histórico | comparação por cidade/período/fonte sem dados sintéticos |
| Mais | Configurações, estado inicial LIGADO, desligamento manual persistido, modo silencioso manual persistido e fontes oficiais |
| Assinatura | Google Play Billing continua fail-closed; P0 oficial permanece independente de assinatura |

## Pontos deliberadamente bloqueados até integração externa

- personagem 3D final e áudio editorial masculino;
- reconhecimento de voz e Q&A remoto;
- dados meteorológicos/alertas/trânsito/radar/notícias ao vivo onde o adapter ainda não estiver conectado;
- mapas georreferenciados reais;
- Firebase/FCM real, Test Lab real, Google Play IDs reais e backend de produção;
- qualquer indicação de “tempo estável/sem alertas” sem evidência oficial vigente.

Esses itens devem aparecer como aguardando/indisponíveis, nunca como sucesso simulado.
