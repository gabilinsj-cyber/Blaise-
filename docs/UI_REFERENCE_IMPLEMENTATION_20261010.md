# Blaise V6 RJ — paridade visual com referência de 10/10/2026

## Escopo

Somente Blaise V6 RJ / Rio de Janeiro. A referência visual enviada pela criadora é **um layout de design**, não uma fonte de observações reais; seus 28°C, 27°C, radar colorido, trânsito sem ocorrências, alertas e eventos sísmicos são números ilustrativos e **não devem aparecer como fatos vigentes**.

## Correspondência implementada (Android, Jetpack Compose)

| Área | Implementação |
|---|---|
| Topo | Faixa compacta azul e dourada; foto feminina do arquivo aprovado; nome do produto; botão ligar/desligar e horário de Brasília identificado como relógio, não horário de medição |
| Blaise | Pergunta digitada sempre disponível, microfone e resposta por voz; boletim 06h/12h/16h com acesso a detalhes |
| Alertas | Faixa horizontal com estado real da evidência; "Última hora" somente com evidência de P0, acesso funcional a Alertas |
| Mapa central | Base geográfica local com **92 municípios exclusivamente do RJ**, botões de zoom, abas Radar/Chuva/Temperatura/Vento/Nuvens e acesso à tela Mapa |
| Cidades | Dois cartões compactos com escolha de município, medições atuais somente se validadas; recortes **apenas cênicos** de Rio e Niterói da referência |
| Previsão / gráficos | Abas e quadros compactos, grades de séries temporais; sem colunas, linhas, percentuais ou temperaturas de exemplo |
| Serviços | Mar/risco, trânsito, qualidade do ar, notícias locais/internacionais e sismologia na página inicial |
| Rodapé | Navegação persistente em faixa horizontal rolável para retrato e paisagem |

### Fonte geográfica e licenciamento

Limites dos municípios obtidos de [geodata-br / `geojs-33-mun.json`](https://github.com/tbrugz/geodata-br/blob/master/geojson/geojs-33-mun.json), dados geográficos IBGE, disponibilizados sob CC0 1.0 no repositório de origem. Contornos simplificados offline a 0,016 grau para renderização eficiente. **Não são imagem de radar e não servem à navegação.** A fonte aparece no próprio mapa.

## Pendente antes da interface final de produção

1. Camadas reais e autorizadas radar/satélite/chuvômetros com georreferenciamento, carimbo de data/hora, origem e validação de frescor. Atualmente o painel mostra geografia real e indica que a camada meteorológica não está disponível.
2. Séries de temperatura, chuva, vento e previsões oficiais validadas por região e período. Atualmente exibem indisponibilidade, sem dados inventados.
3. Fluxos de alertas por município, trânsito/COR.Rio/CET-Rio, ar/IQAr, mar/Marinha, notícias e sismos com fonte verificável e atualização real. As telas preservam placeholders responsáveis quando as fontes não estão conectadas.
4. Teste visual efetivo em telefone e tablet (retrato/paisagem), acessibilidade, contraste, tamanho de fontes e falhas de rede.
5. Teste de login/assinaturas e publicação Google Play seguem tarefas independentes; **não é autorização para deploy/merge na main**.

## Critérios de segurança

- Não promover exemplos ilustrativos à condição de medição oficial.
- P0 público e o status do risco independem da assinatura.
- Nenhum novo APK deve ser baixado pela criadora durante esta validação no GitHub, devido ao alto consumo de armazenamento e aos problemas anteriores de instalação.
- Alterações restritas à PR de rascunho até CI e revisão visual.
