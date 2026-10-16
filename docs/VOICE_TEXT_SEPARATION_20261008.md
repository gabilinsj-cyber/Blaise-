# Voz e digitação — Blaise V6 RJ

08/10/2026. Relato do usuário: fala transcrita para o campo, envio manual e ausência de resposta. O aparelho não está conectado a esta sessão, portanto versão instalada e causa específica no dispositivo não foram confirmadas.

Correções:
- Estado de texto explicitamente separado como typedQuestion; o reconhecimento final continua chamando ask(text, true), sem escrever no campo nem usar o botão de texto.
- Botão identificado “Perguntar por voz”; “Enviar texto” aparece apenas no campo de digitação expandido.
- Erros de reconhecimento recebem orientação falada, respeitando o modo silencioso.
- Consulta com prazo de 12 segundos e tratamento de falha: responde que a medição não foi confirmada; no fluxo de voz, a orientação também é falada. Cancelamento por nova consulta ou saída da tela não produz resposta antiga.
- Modo silencioso informa explicitamente por que a voz não foi reproduzida.

O reconhecimento de fala ainda converte áudio em texto internamente para interpretar a intenção; isso não obriga o cliente a transcrever ou apertar Enviar. O microfone do teclado é ditado de texto, separado do botão do assistente.

Validação necessária em dispositivo: digitar texto sem enviar, fazer pergunta por voz e confirmar que o rascunho não muda; resposta falada sem envio; erro de rede ou dado ausente falado; enviar texto e confirmar resposta escrita; respeitar silêncio/desligamento; confirmar fonte, município e horário. Não há evidência de teste em aparelho nesta etapa. A compilação anterior, commit 2e5989a, passou; esta correção requer sua própria execução CI e atualização do APK.
