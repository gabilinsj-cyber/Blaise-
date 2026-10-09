# Blaise Shield RJ — camada incremental de proteção

**Escopo exclusivo:** Blaise V6 RJ (Rio de Janeiro). Implementado primeiro na branch `codex/blaise-shield-rj-20261008`; não equivale a um deploy em produção.

## Controle já integrado no backend

- `POST /v1/entitlements/verify`: mantém verificação exclusivamente via Google Play Developer API. O cliente Android jamais libera uma assinatura por conta própria.
- Corpo JSON deve ter somente `packageName`, `purchaseToken` e `productIds`. Campos excedentes, inclusive CPF, e-mail, endereço ou localização, são rejeitados (400) antes de consultar a API Google.
- Tokens de compra que geram **8 respostas `active:false` em 60 segundos**, na mesma instância, recebem **HTTP 429** e `Retry-After: 60`. O servidor não encaminha essas tentativas excedentes à Google Play API.
- Apenas um fingerprint HMAC-SHA256 do token, usando segredo aleatório gerado em RAM no processo, é mantido por até 60 segundos, com no máximo 4096 entradas/instância. Não persistir a chave, não incluir fingerprint em logs ou métricas; não guardar o token original, IP, e-mail, CPF, voz ou cidade.
- Respostas sem detalhes pessoais: `{ "active": true }`, `{ "active": false }` ou erro genérico. Os cabeçalhos `Cache-Control: no-store` continuam em vigor.
- Contador agregado `verify_shield_rejected_total` está disponível apenas pelo endpoint de métricas protegido por OIDC.
- Alertas oficiais P0 e serviços meteorológicos são independentes do controle de assinaturas, preservando segurança pública e funcionalidade básica.

## Limites, dependências e checklist de lançamento

Essa medida reduz consultas repetidas com o **mesmo** token negado. **Não é um WAF, proteção DDoS, autenticação de usuário, nem bloqueio de múltiplos tokens ou ataques distribuídos**. Como o estado está na memória de cada instância, outra instância pode aceitar novas tentativas; não anunciar um limite global. Os 8 negados podem ser processados concorrentemente antes do bloqueio começar.

Antes de publicar, validar:
1. Segurança do Android: aplicação da assinatura oficial da loja, Play Integrity/API de atestação quando aplicável, permissões mínimas, não persistir dados além do necessário e ausência de segredos em APK/logs.
2. Vincular transações às contas dos próprios assinantes no servidor de modo verificável, sem supor que um token válido apresentado por terceiro prove identidade. Definir e testar reembolso, cancelamento, expiração, revogação e troca de aparelho.
3. WAF/Cloud Armor e política de proteção contra ataques distribuídos por rota, revisadas contra NAT e tráfego legítimo; limite elástico/autoscaling e testes de carga realistas.
4. Banco e backups (somente se realmente necessários): criptografia, controle de acesso mínimo, segregação, auditoria sem PII, retenção curta documentada, exclusão e plano de resposta a incidentes em conformidade com LGPD.
5. Testes `cd backend && npm run check && npm test && npm run load-smoke`, CI, revisão do código e implantação canário com rollback; não marcar como produção sem logs de testes e evidência de configuração.
6. Controles de lojas Samsung e Amazon exigem backends e APIs próprias; o fluxo Google Play **não** valida assinaturas dessas lojas.

## Agente 10 — escala e segurança

Nos marcos de crescimento (500 mil, 1 milhão, 1,5 milhão e 2 milhões, depois a cada 500 mil), produzir relatório atualizado de capacidade/segurança e custos com fornecedores e links oficiais. O relatório depende de métricas reais e não implica implantação, contratação ou envio de e-mail automáticos sem configuração explícita.
