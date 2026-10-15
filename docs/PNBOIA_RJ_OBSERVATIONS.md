# Boias da Marinha no Blaise V6 RJ

Escopo: boias PNBOIA/REMObs com localização RJ no catálogo oficial indicado pela página do PNBOIA. NOAA, Copernicus Marine e EUMETSAT continuam na matriz existente; não foram implementados conectores dessas fontes nesta alteração.

## Contrato verificado em 15/10/2026

- Página oficial: https://www.marinha.mil.br/chm/dados-do-goos-brasil/pnboia
- Mapa apontado pela página: https://pnboia-brasil.github.io/pnboia-mapa/
- Catálogo público usado pelo mapa: https://api-boias.remobs.com.br/public/moored/stations
- Documentação técnica consultada: https://api-boias.remobs.com.br/openapi.json
- Sensores: GET `/v2/moored/observations`, com HTTP Bearer JWT emitido pelo serviço de usuários REMObs. O catálogo é público; observações não são liberadas por esse endpoint público.

A documentação informa que dados de programas restritos podem ser servidos em horários sinóticos, com timestamp nominal. O conector só aceita `X-Data-Resolution: integral`. Outros valores ficam indisponíveis até validação do horário original. O valor exato do header em resposta autenticada ainda precisa ser confirmado.

## Código e exibição

O backend expõe GET `/v1/public/rj/buoys`, sem incluir credencial em URL, logs, JSON ou APK. O cliente Android consulta esse canal, filtra novamente idade/qualidade/unidades e exibe cada valor como observação pontual da boia. Não atribui leitura a praia/município, não publica alertas nem deriva tsunami ou ressaca.

Primeiras variáveis suportadas: `sig_wave_height` em `m`, e `wind_speed` em `m/s`, citadas na documentação. Requer `aggregate_flag=1`, sensor identificado, profundidade superficial, valor físico finito e horário UTC dos últimos cinco minutos. Leituras suspeitas, futuras, vencidas, conflitantes e de bancadas de testes são descartadas. Não se usa idade de download para renovar a observação.

Após o botão de consulta na tela Mar e Ondas, consulta a cada 60 segundos enquanto a tela permanece aberta e ligada. Para em erro de configuração/autorização. Backend deduplica requisições e usa cache máximo de 30 segundos, revalidando idade ao servir. Catálogo e medições continuam separados.

## Configuração necessária antes de ativar

- Obter credencial oficial REMObs e confirmar condições de exibição/redistribuição aplicáveis ao Blaise (especialmente série integral de programas restritos).
- Configurar `BLAISE_PNBOIA_TOKEN` no ambiente seguro do backend.
- Definir `BLAISE_PNBOIA_DISPLAY_TERMS_APPROVED=true` somente após confirmação das condições.
- Implantar o backend e validar resposta autenticada real, unidades, flags de qualidade, resolução e horário original; não substituir isso por teste com fixture.
- Confirmar o cliente Android apontando para a versão implantada, executar teste de tela com dados reais e revalidar expiração.

Nenhuma credencial foi obtida ou configurada nesta sessão. Não houve deploy nem ingestão real de sensores. A tela de catálogo anterior passou Android CI; a ponte de observações precisa de CI própria e validação real. Período/direção das ondas, temperatura do mar e marés permanecem pendentes.
