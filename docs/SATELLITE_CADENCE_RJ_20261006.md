# Vector RJ: ciclo científico e satélite

Checagem e revalidação a cada 30 segundos em todos os níveis; ciclo base de 60 segundos e recálculo quando mudam as entradas. As rotinas também são avaliadas na revalidação para remover resultados vencidos. Backend usa intervalo entre inícios, pulando janelas perdidas em execuções demoradas e impedindo sobreposição; não garante latência operacional. Horários de processamento não substituem observedAt/validAt.

NOAA e Windy ainda não possuem conectores operacionais nesta implementação. Windy Point Forecast exige chave privada no backend e fornece previsão de modelo; não é observação satelital. NOAA ABI modo 6: disco completo a cada 10 minutos, setores rápidos apenas quando cobertos e disponíveis. Consultas a cada 30 segundos não criam novas imagens. Preservar emissão, validade, origem/modelo, qualidade e georreferenciamento. Um modelo distribuído por dois canais não constitui confirmação independente.

Fontes: https://api4.windy.com/point-forecast/docs ; https://www.star.nesdis.noaa.gov/atmospheric-composition-training/satellite_data_abi_scan_modes.php ; https://www.nesdis.noaa.gov/our-satellites/currently-flying/goes-east-west/goes-schedules-and-scan-sectors .

Pendentes: ingestão/decodificação autorizada, rastreamento entre quadros, incerteza e validação de trajetória, entradas oceânicas e batimetria, propagação costeira, conexão contínua ao Cloud Run, coordenação entre instâncias, precisão/latência medidas e APK integrado. Movimento de nuvem não confirma vento de superfície, altura de onda ou tsunami. Satélite isolado não confirma tsunami sísmico ou meteorológico. Este ajuste não realiza implantação.
