# Blaise V6 RJ — validação de fontes, voz e assinatura

Escopo: somente Rio de Janeiro. Documento de critérios e pendências; não comprova teste físico nem autoriza publicação.

## Dados oficiais

- INMET: catálogo oficial e amostras horárias da estação. Identificar estação/código, fonte HTTPS, data UTC/Brasília, unidade e disponibilidade. Não atribuir medição de uma estação ao município inteiro.
- Temperatura, chuva horária e vento: faixa física, data futura, origem e período devem ser verificados; 9999, NaN, null e dados vencidos não entram no gráfico.
- O último dado de cada variável precisa ter até duas horas. O gráfico exige duas ou mais observações horárias distintas nas últimas 24h; não interpolar lacunas.
- A fonte INMET informa que observações automáticas são dados brutos sem consistência garantida; valores pontuais não autorizam automaticamente alertas P0.
- Mapa: pontos INMET são medições locais. Nunca apresentar o mapa base como radar, previsão, chuva interpolada ou risco municipal.
- Radar Alerta Rio: seus termos exigem autorização expressa para determinados usos comerciais/reprodução; nenhum frame será incorporado comercialmente até confirmar autorização, licença, tempo, fonte e georreferenciamento.
- Termos: https://www.sistema-alerta-rio.com.br/institucional/termos-de-uso/
- Se não houver dados oficiais suficientes, exibir indisponível e manter a distinção entre estação e cobertura do município.

## Teste em aparelho físico: voz Dora

ESTADO: PENDENTE. Não há áudio real nem teste de microfone no GitHub Actions.

1. Registrar versão Android, aparelho, versão do aplicativo e commit testado.
2. Permitir, negar e revogar permissão do microfone; tentar perguntas em português brasileiro. O app precisa informar permissão negada sem fechar.
3. Fazer perguntas sobre chuva, temperatura e ressaca; somente responder como fato quando houver confirmação oficial.
4. Reproduzir a voz feminina Dora por alto-falante e Bluetooth. Testar ligar/desligar, modo silencioso, interrupção de fala e saída/retorno ao app.
5. Repetir sem rede; anotar latência, erro, resultado e evidências sem dados pessoais ou gravações de clientes.

## Teste físico: Google Play e Firebase

ESTADO: PENDENTE. Conta desenvolvedora, produto Play de teste, APK assinado e instalação por trilha de testes são necessários.

1. Verificar conta Play e produtos/planos ativos; instalar exclusivamente da Play Internal Testing ou trilha de teste permitida.
2. Integrar as mudanças de autenticação Firebase feitas em PRs separadas; testar e-mail verificado e vínculo backend da conta ao pagamento.
3. Conta licenciada para testes: conferir ofertas/preços retornados pela Play Billing; comprar, cancelar, simular pendência, estorno, restauração e troca de conta.
4. Confirmar desbloqueio premium só após confirmação server-side da assinatura e propriedade da conta; ofertas ausentes permanecem indisponíveis.
5. Proteção P0 sem assinatura deve permanecer acessível. Nunca incluir tokens, senhas, dados de cartão ou chaves no log.

## Critérios para liberar produção

- Compilação Android, backend, testes de unidade e de instrumentação aprovados.
- Revisão humana das capturas reais em retrato e paisagem, sem sobreposição visual.
- Integridade da origem, horário e cobertura em cada camada oficial implementada.
- Voz e assinatura comprovadas em aparelhos reais com testes seguros e documentados.
- Autorizações de uso comercial dos dados obtidas quando necessárias.
- Enquanto houver item pendente: manter PR draft e não liberar APK em produção.
