# INEA Radar — janela operacional de 30 minutos

## Objetivo

Esta camada implementa o contrato **local e fail-closed** necessário para a animação de radar do Blaise V6 RJ sem inventar frames LIVE. Ela não descobre URLs nem tenta inferir radar/timestamp a partir de nomes de arquivo desconhecidos. Em vez disso, só aceita metadados de frame que já tenham passado por toda a cadeia de validação externa.

O contrato usa os dois radares oficiais conhecidos do INEA, `guaratiba` e `macae`, cadência declarada de 5 minutos e janela móvel máxima de 30 minutos. Nenhuma interpolação é permitida.

## Cadeia obrigatória por frame

Antes de entrar na janela, cada frame precisa trazer:

- `sourceId` exato do gateway de radar INEA;
- `radarId` exato `guaratiba` ou `macae`;
- `provenanceValidated=true`;
- `binaryValidated=true`;
- `metadataBindingValidated=true`;
- `observedAt` normalizado em UTC/RFC3339;
- SHA-256 hexadecimal do conteúdo;
- tipo de imagem permitido (`png`, `jpeg`, `gif` ou `webp`);
- tamanho binário dentro do limite já adotado pelo gate do radar.

`metadataBindingValidated=true` é deliberadamente obrigatório: ele representa a etapa ainda pendente que deverá provar, com evidência LIVE real, que um candidato do sistema oficial corresponde a um radar específico e a um timestamp de varredura verificável. O módulo de janela não tenta substituir essa prova.

## Política temporal

- Janela retida: últimos 30 minutos.
- Tolerância máxima para clock futuro: 2 minutos.
- Freshness operacional: último frame de cada radar com no máximo 10 minutos de idade.
- Intervalo superior a duas cadências oficiais (mais de 10 minutos) conta como gap de animação.
- Dois frames com o mesmo `radarId` e o mesmo timestamp são rejeitados como duplicata temporal, mesmo se os hashes diferirem.
- Frames expirados são removidos da memória e nunca persistidos por esta camada.

A janela fica `operational=true` somente quando Guaratiba e Macaé possuem frame atual. `animationReady=true` exige, para os dois radares, pelo menos dois frames atuais e nenhum gap superior a 10 minutos.

## Privacidade, retenção e renderização

A janela guarda somente metadados sanitizados em memória. URLs brutas e bytes de imagem não entram no snapshot público do contrato. O snapshot declara explicitamente:

- `interpolation=FORBIDDEN`;
- `storage=MEMORY_ONLY`;
- `rawMediaUrls=NOT_RETAINED`;
- `binaryContentRetention=NONE`.

Isso preserva a regra do produto: a animação deve reproduzir frames reais, com horário e fonte, sem criar frames intermediários.

## Evidência atual

`backend/src/inea-radar-window.mjs` e `backend/test/inea-radar-window.test.mjs` cobrem deterministicamente identidade permitida, cadeia de validação, timestamp, futuro, stale, duplicata temporal, gaps, freshness, retenção e ausência de URL/bytes no snapshot.

Este PASS de código **não é PASS LIVE do radar**. O gate externo continua bloqueado até uma execução LIVE no mesmo SHA revelar um contrato real e verificável de associação candidato -> Guaratiba/Macaé -> timestamp. Até isso ocorrer, a UI deve continuar fail-closed para animação operacional do radar INEA.
