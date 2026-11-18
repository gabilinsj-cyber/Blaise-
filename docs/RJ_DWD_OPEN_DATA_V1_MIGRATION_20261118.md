# Blaise V6 RJ — migração DWD Open Data v1, 18/11/2026

## Fonte alemã — novo caminho confirmado
- Diretório oficial: https://opendata.dwd.de/weather/nwp/v1/m/icon/p/T_2M/r/
- Padrão: `/weather/nwp/v1/m/icon/p/T_2M/r/YYYY-MM-DDTHH%3A00/s/PT003H00M.grib2`.
- O formato passa a ser **GRIB2 puro**, não `.bz2`. O parâmetro é temperatura de ar a 2 metros, origem **DWD ICON Global**, categoria **P (previsão)**, não termômetro ou estação meteorológica local.
- No Blaise, consultar os 92 pontos interiores aos polígonos municipais IBGE (dados de referência; altitude ainda não homologada), **um download da grade por ciclo**, uso de ecCodes/CDO para os pontos. Nunca confundir com 92 estações físicas.
- A mudança está proposta na PR #165 em branch de desenvolvimento; não está publicada aos assinantes e não ativa um agendador em produção.

## Remapeamento com pesos oficiais: outra migração obrigatória
A DWD anuncia fechamento de `/weather/lib/cdo/` **após 30/11/2026**. O regradeamento ICON Global depende do pacote oficial `ICON_GLOBAL2WORLD_025_EASY.tar.bz2`. Como ele desaparecerá do endereço público antigo:

1. O **teste pré-corte** pode fazer download temporário de pesos antigos da DWD e guardá-los como artifact de migração no GitHub Actions com checksum SHA-256, **não como dependência de produção**.
2. Para produção, um administrador deve armazenar o arquivo original **fora do APK, em armazenamento privado e persistente do servidor**, sob nome de versão e com checksum SHA-256 verificável. Não publicar binário de terceiros no cliente.
3. O coletor v1 suporta `BLAISE_DWD_ICON_WEIGHTS_ARCHIVE_PATH` e `BLAISE_DWD_ICON_WEIGHTS_SHA256` no ambiente servidor (chave SHA conhecida; não credencial secreta), bloqueando arquivo sem hash correspondente.
4. Sem pacote pré-provisionado e hash correto, o coletor falha com `DWD_PINNED_OFFICIAL_WEIGHTS_NOT_PROVISIONED`; não estimar valores artificiais. O uso de pesos legados só pode acontecer em **staging explícito ANTES do corte**, nunca após 30/11/2026.
5. Para independência de longo prazo, validar possibilidade de regenerar pesos a partir da grade nativa oficial sob licença, usando a documentação DWD/MPI-M; não assumir disponibilidade futura de servidores externos sem contrato.

## Verificações e critérios
- Índice de ciclos ISO e etapas do modelo pesquisado no domínio `opendata.dwd.de`, arquivo GRIB2 íntegro (cabeçalho e marcador final), ciclos, unidades Kelvin, data de validade e tempestividade.
- Origem DWD, fonte exata e hora visíveis para administrador; apenas campos meteorológicos com licença comercial aplicável.
- Testes negativos para falsa estação, horário vencido, formato BZIP2 antigo, registros repetidos e qualquer dado não georreferenciado.
- O relatório interno pode retornar `FULL` para 92 pontos com previsão **P** quando houver prova real; não equivale a temperatura observada por 92 estações.
- Sem ativar HG Brasil, nenhuma contratação/pagamento, sem mudanças em fontes descartadas e sem alterar `main` automaticamente.

## Evidência e implantação
A PR #165 aciona o workflow de estágio DWD. Só registrar sucesso de nova rota quando o workflow entregar arquivo `dwd-icon-rj-92.json`, relatório `dwd-icon-rj-92-admin-audit.json` e checksum oficial de pesos. **A implantação em produção permanece bloqueada até disponibilização do pacote de pesos em armazenamento persistente, CI verde, revisão de licença e testes contínuos.**

Referências: portal oficial DWD Open Data v1; boletim DWD Open Data setembro/2026 sobre encerramento das rotas legadas e pesos CDO.
