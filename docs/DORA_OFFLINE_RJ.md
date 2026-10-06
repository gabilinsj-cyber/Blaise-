# Voz Dora — Blaise V6 RJ

Implementação para revisão e teste, sem publicação automática nas lojas.

## Comportamento

- Kokoro v1.0, voz feminina brasileira `pf_dora`, speaker ID 42 conforme o
  mapeamento upstream `scripts/kokoro/v1.0/generate_voices_bin.py`.
- Síntese local com sherpa-onnx 1.13.8; não chama demonstrações públicas,
  serviços de voz nem APIs pagas. A preparação do build baixa os binários.
- Respostas do painel são lidas quando o aplicativo está ligado e fora do modo
  silencioso. Botões `Testar voz`, `Ouvir resposta` e `Parar voz`.
- Interrupção ao desligar, silenciar, sair do primeiro plano ou iniciar nova fala.
- `Blaise` vira `Bleiss` somente no texto de síntese, preservando a interface e
  os valores da resposta. Não muda palavras maiores que contenham a marca.
- Não emite alertas automáticos. O roteador atual orienta para módulos e não
  fornece medições meteorológicas atuais; integrar voz não adiciona essas medições.
- Sucesso em `DoraVoiceService.speak` exige conclusão da reprodução. Falhas de
  síntese/reprodução são apresentadas sem trocar silenciosamente a voz aprovada.

## Build

Requisitos: JDK 17 completo, Android SDK 35/build-tools 35.0.0, Python 3.11+,
curl e acesso aos releases upstream. Execute `./gradlew :app:testDebugUnitTest
:app:assembleDebug`. O Gradle executa `scripts/prepare-dora-voice.py` antes de
compilar, verifica SHA-256 e prepara AAR/assets em `app/build/generated/dora`.
Downloads ficam em `.cache/dora`, fora do Git. O cache pode ser reutilizado no CI.

O modelo FP32 tem cerca de 311 MiB; os assets de voz completos têm cerca de
356 MiB, além do runtime nativo e do aplicativo. Este primeiro pacote é grande:
dimensionar memória, tempo de primeira fala e limites de cada loja antes de release.
Quantização ou entrega separada do modelo requerem nova validação da voz.

## Licenças e release

Kokoro e sherpa-onnx usam Apache 2.0; a cadeia de fonemização também contém
eSpeak NG, GPL-3.0-or-later. As licenças e atribuições ficam em
`app/src/main/assets/voice-licenses`, e a licença original do modelo é preservada.
Não se deve inferir que toda a distribuição Android é Apache por causa da licença
do modelo. Antes de publicar, resolver as obrigações dos componentes GPL, inclusive
fonte correspondente e compatibilidade com a licença do aplicativo. Esta mudança
não concede nem altera a licença do código existente do Blaise.

## Validação

- Assets e runtime conferidos por hashes; script executado com sucesso.
- Classes Kotlin de voz compiladas contra Android SDK 35 e AAR real.
- Síntese nativa offline testada em CPU com `lang=pt-br`, `sid=42`:
  “Olá! Eu sou a Bleiss. Como posso ajudar?” produziu 84.131 amostras a
  24.000 Hz (3,505 s).
- Testes JUnit cobrem marca, maiúsculas, acentos, números e limites de palavras.
- Build `testDebugUnitTest assembleDebug` concluído: 62 testes, zero falhas/erros.
  APK debug gerado (503.057.047 bytes, aproximadamente 480 MiB), assinatura
  verificada por `apksigner`; modelo, vozes e avisos presentes no pacote.
- `compileDebugAndroidTestKotlin` concluído. O teste de controles de voz foi
  compilado, mas ainda não foi executado em emulador ou aparelho físico.
- Pendente: teste no Android físico (som, pronúncia aprovada, cancelar, modo
  silencioso, desligar, segundo plano, memória e latência), e revisão do pacote
  de distribuição antes das lojas.

Fontes técnicas:
https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8
https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
https://github.com/espeak-ng/espeak-ng
