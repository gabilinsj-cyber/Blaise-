# Blaise V6 RJ — homologação real das cinco fontes (12/10/2026)

## Estado verificado por arquitetura, não por propaganda
- **Alerta Rio:** existe coleta de precipitação da rede da cidade do Rio no servidor e consulta de estação no Android. O produto **não cobre automaticamente todos os 92 municípios**. Verificar dados atuais via cache/operador e respeito a condições de uso.
- **Defesa Civil regional:** o backend contém sonda de **inventário de ativos cartográficos** da Defesa Civil do Rio; isso **não é uma segunda estação meteorológica**, não prova temperatura/chuva local e não equivale a um fluxo de avisos nas 92 cidades.
- **INMET:** há coleta de avisos CAP no backend e consultas de estações locais pelo Android. Avisos e estações são produtos separados. Não atribuir estação de município vizinho ao município selecionado.
- **INPE/CPTEC:** existe documentação de serviços de previsão em XML, mas ainda NÃO há conector de produção localidade/intervalo compatível com o desempate de medição instantânea, nem homologação de licença comercial por produto.
- **Windy:** criado adaptador API Point Forecast v2 e sonda autenticada `POST /v1/internal/rj-model-point`. Acesso DESLIGADO enquanto não existir chave de plano Professional, autorização contratual, e verificação de modelo/grade/frescor. O resultado é *previsão* sem validação de habilidade, não observação ou alerta.

## Teste protegido do Windy (somente operador autorizado)
A chave **nunca** deve ser enviada por chat, incorporada no Android ou gravada no repositório. Configurar no Cloud Run por Secret Manager e restringir IAM da identidade de execução:

- `BLAISE_WINDY_POINT_OPERATOR_APPROVED=true` **apenas após autorização comercial do produto**.
- `BLAISE_WINDY_POINT_PLAN=PROFESSIONAL` apenas após confirmar o plano contratado.
- `BLAISE_WINDY_POINT_API_KEY` com Secret Manager (não armazenar no GitHub nem em prints).
- `BLAISE_OBSERVABILITY_AUDIENCE` e `BLAISE_OBSERVABILITY_SERVICE_ACCOUNT`: OIDC de operador já usado nas rotas internas; autenticação obrigatória.

Com identidade autorizada, consultar um único ponto do RJ:

```http
POST /v1/internal/rj-model-point
Content-Type: application/json
Authorization: Bearer <OIDC_DE_OPERADOR>

{"ibge":"3304557","latitude":-22.9,"longitude":-43.2}
```

A resposta **não** comprova correspondência do ponto com o polígono municipal nem permite distribuição comercial ao usuário. Não repetir para 92 localidades sem revisar limites de taxa/custos/termos e validar cada localização. Os testes não fazem chamadas reais ao fornecedor e não configuram serviços automaticamente.

## Critérios de integração municipal
1. Manter apenas cidades do cadastro IBGE dos **92 municípios do RJ**. Alerta Rio só se aplica à cidade do Rio.
2. Ordem de medições/avisos por fenômeno e jurisdição: Alerta Rio → Defesa Civil → INMET. Em conflito entre observações, procurar terceiro fornecedor oficial, registrar valores e tempos.
3. INPE/CPTEC primeiro como previsão de comparação, Windy apenas se necessário. **Nunca** realizar média entre observação pontual e previsão de modelo. Proximidade da previsão não atesta qual sensor está correto.
4. Utilizar funções científicas Blaise somente com entradas comprovadas, unidade/período/coordenadas e pesos de habilidade verificados. Exibir sempre proveniência e incerteza.
5. Um produto fonte que responde HTTP 200 sem observação válida/fresca **não** equivale a dados em tempo real. O endpoint OIDC `/v1/internal/rj-sources/readiness` agora informa o status individual das cinco fontes, mas o conjunto permanece não comprovado.
6. Nunca preencher mapa/radar com distribuição inventada; não emitir alerta P0 por mera extrapolação sem confirmação oficial, mantendo o canal P0 público independente da assinatura.

## Etapas de comprovação ainda bloqueadas
- Aprovação das condições comerciais e habilitação das APIs de previsão, inclusive INPE/CPTEC e Windy; adaptações de feed por cada município.
- Validação da coleta com tempos e formatos reais, incluindo períodos em que fontes divergem e indisponibilidade, ao longo de vários ciclos.
- Conectar com segurança os dados de produção ao contrato JSON dos painéis Android, conservando informações de estação individual e modelos separados.
- Testes **físicos** de microfone, síntese de voz, notificações e compra/restauração de assinatura em aparelho. Google Play exige validação da conta antes da publicação; CI/emulador não substituem testes reais.
- Revisão e aprovação da PR antes de merge/deploy. **Nenhum APK novo ou instalação no celular são necessários nesta fase.**
