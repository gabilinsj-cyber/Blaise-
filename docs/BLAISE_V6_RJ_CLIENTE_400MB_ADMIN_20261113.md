# Blaise V6 RJ — cliente até 400 MB × administração separada

Data: 13/11/2026. Escopo: **somente Rio de Janeiro**. Não mexer no Cloud Shell ou no aplicativo instalado sem confirmação do pacote e assinatura.

## Distribuição pública — `release`

- **Limite rigoroso:** 400.000.000 bytes (400 MB decimais) no APK individual; não confundir com 400 MiB.
- **App ID:** `br.com.blaise.rj`, versão preparada `6.0.1` / code `6000002`.
- Preserva a interface original da branch `main`: mapa próprio com 92 municípios, dois painéis de cidades, alertas P0, perguntas por texto e voz, fontes, horários, gráficos e funcionalidades já implementadas.
- **Voz:** TextToSpeech em português brasileiro do **Android instalado no aparelho**. A voz e a possibilidade de usar sem rede dependem do motor/idioma do aparelho. Não há garantia de voz feminina idêntica à Dora sem pacote opcional. Respostas em texto continuam sempre disponíveis.
- **Exclui o modelo proprietário do build offline local** `assets/dora/model.onnx`, `voices.bin` e dicionários extraídos do APK distribuído ao cliente. É uma remoção física do artefato, não apenas esconder elementos da interface.
- O script `scripts/enforce-client-package-size.sh` reprova qualquer APK público acima de 400 MB ou com esses arquivos internos. Roda tanto na CI quanto antes da assinatura/publicação pelo release gate.
- O tamanho exato do novo APK **não é conhecido até o build gerar e registrar `client-package-size.txt`**. O antigo APK de depuração não mede o pacote do cliente.
- Recursos remotos sem medição, cobertura, validação de licença ou assinatura **não são chamados de dados em tempo real comprovados**. Sem dado não é ausência de alerta.

## Edição proprietária — `admin`

- Variante distinta `br.com.blaise.rj.admin`, construída a partir das mesmas fontes e tema, com voz Dora/Kokoro local completa e recursos de análise destinados ao proprietário. **Não há limite de 400 MB** para esse APK.
- A variante de teste `br.com.blaise.rj.debug` também mantém a voz offline para o desenvolvimento.
- Uma variante `admin` **NÃO concede autorização**: ferramentas sensíveis (segredos, logs privados, alterações de fonte, publicação, correções automáticas, assinatura e faturamento) ficam no backend autorizado. Uma autenticação administrativa efetiva por identidade, papel e autorização de servidor ainda precisa de validação antes de expor qualquer operação privilegiada.
- Não colocar chaves privadas, senhas, keystore, funções administrativas confiadas ao cliente, dados de outros assinantes ou credenciais de provedores no APK de clientes **nem** no APK admin. A assinatura de distribuição pertence a ambiente protegido.
- A compilação `admin` não instala sobre `release` porque o identificador é diferente; isso é intencional.
- O tamanho `admin` dependerá dos recursos escolhidos; pode superar 1 GB se tecnicamente necessário, mas não é necessário inflar o instalador para torná-lo mais seguro.

## Publicação e integridade

1. `Android CI`: testes backend/Android + `scripts/enforce-client-package-size.sh` sobre APK `release` **não assinado** — mede o conteúdo, mas não autoriza publicação.
2. `Android Release Gate`: exigir a assinatura comercial real, `app-release.apk` e `app-release.aab`, assinatura e hash SHA-256, versionCode, metadados e verificação de tamanho **no próprio APK assinado**.
3. Comparar a assinatura original do usuário e fazer homologação de dados, notificações P0, voz e funcionamento offline no dispositivo.
4. Só liberar ao cliente o APK/Play Store depois das verificações concluídas, inclusive controle de licença e servidores. Nenhum lançamento automático ou remoção de aplicativo local foi autorizado.

Fontes permanentemente excluídas: INEA, Marinha/CHM, Windy, Copernicus. As demais seguem por produto e autorização.
