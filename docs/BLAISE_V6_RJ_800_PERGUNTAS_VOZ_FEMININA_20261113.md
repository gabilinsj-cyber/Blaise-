# Blaise V6 RJ — 800 intenções planejadas e voz feminina (13/11/2026)

## Decisão do produto

- O aplicativo **público/cliente** (`br.com.blaise.rj`) identifica a intenção de perguntas digitadas ou faladas, consulta somente fontes licenciadas e dados **atuais validados** e responde em português brasileiro.
- O banco de perguntas e explicações revisadas, com meta de **800 entradas**, é reservado à variante **admin** (`br.com.blaise.rj.admin`); não é distribuído ao cliente.
- Das 800 perguntas informadas na história do projeto, foi localizado um documento original (06/10/2026) com **170 perguntas numeradas 1–170 e 70 variantes cariocas**. As demais 630 perguntas e o texto de respostas revisadas **não foram comprovados neste repositório/arquivo**. Não inventar nem rotular as 800 como já importadas.
- Material preservado exclusivamente em `app/src/admin/assets/blaise-rj-knowledge/question-bank-recovered-20261006.json`, com contagem, tópicos, status `REQUIRES_OFFICIAL_SOURCE_AND_TIME` e sem respostas meteorológicas fixas.
- A interface admin abre uma lista pesquisável das perguntas importadas com total recuperado, variantes e lacunas. A variante pública não tem o asset. `scripts/enforce-client-package-size.sh` bloqueia qualquer APK/AAB público que o inclua.
- Em `RjClientIntentClassifier` o cliente mantém apenas regras leves para identificar temperatura/sensação, chuva, vento, umidade/ar, previsão, alertas, alagamento, radar, mar, tsunami/sismos, sol/UV, transporte, infraestrutura, climatologia, nevoeiro, cálculos atmosféricos, saúde e notícias. As variantes locais não se transformam em dados meteorológicos.
- **Reconhecer uma pergunta não é saber a resposta.** Falta de fonte, horário ou cobertura gera indisponibilidade. Pergunta composta deve preservar todas as partes; assunto sem produto não pode receber dados de temperatura como resposta substituta.

## Voz obrigatoriamente feminina

- Nome e visual da personagem: **Blaise**, pronúncia em áudio **Bleiss**. Edição admin pode usar o pacote offline existente da voz feminina Dora, em verificação de qualidade.
- No aplicativo público o Android `TextToSpeech` informa idioma, nome de voz e qualidade, **não informa gênero confiável**. Por isso não atribuir sexo pela string do nome e não escolher voz masculina como fallback.
- Em Configurações o cliente pode ouvir amostras das vozes do motor Android em `pt-BR` e **confirmar explicitamente** aquela que soa feminina. O app guarda localmente apenas identificador do motor e da voz, sem histórico de voz ou nome do cliente.
- A síntese pública usa **somente** a voz pt-BR escolhida e ainda instalada no mesmo motor. Enquanto não houver confirmação, falha de motor ou retirada da voz, o conteúdo continua disponível **por escrito**, e o app explica como configurar; jamais força fala potencialmente masculina.
- Os sons e sotaques reais exigem homologação no aparelho Android. Uma voz feminina automática sem escolha exigiria **modelo feminino licenciado e verificado** com custo/tamanho/privacidade analisados; não atribuir tal garantia ao TTS padrão.
- Reconhecimento de fala pt-BR do Android permanece o mesmo: ao fim da fala envia a consulta sem exigir Enviar; respostas sempre dependem das fontes.
- Cálculos científicos, agentes e fontes excluídas não alteram essas regras; excluir INEA, Marinha/CHM, Windy e Copernicus. Alertas P0 oficiais independem do pagamento.

## Gates de produção

1. Testar unidade/classificador, localização e frases compostas.
2. Confirmar que banco de perguntas está apenas em admin e ausente do APK/AAB `release`; limite de clientes **400.000.000 bytes**.
3. Verificar dispositivo físico com motor TTS pt-BR e voz feminina escolhida por audição (inclusive erro/ausência de voz).
4. Exigir dados, fonte, município e horários reais antes de prometer qualquer resposta em tempo real.
5. Validar build e assinatura comercial, sem merge/publicação automática.
