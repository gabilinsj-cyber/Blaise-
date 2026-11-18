# Blaise V6 RJ — ADM APK e medições reais (18/11/2026)

## Administrador (APK de teste interno)
- Build type `admin` usa o identificador independente `br.com.blaise.rj.admin`.
- Launcher é `AdminScientificActivity`; o launcher do aplicativo cliente é removido apenas do manifesto ADM.
- Tela administrativa requer **Firebase ID token válido com custom claim `blaise_admin: true`**, além de verificação de permissões a cada acesso aos endpoints administrativos do backend. Somente autenticação no cliente não autoriza nenhuma operação de backend.
- Há formulário Firebase e-mail/senha quando o projeto Firebase está configurado. Se a autenticação estiver ausente ou a claim não existir, a tela permanece em **ACESSO RESTRITO**.
- CI gera `app-admin.apk` **para QA interno** (debug-key se não houver assinatura de release). Isso **não** é release de loja, e não comprova configuração de identidade administrativa ou serviços produtivos.
- Caminho: GitHub → Actions → Android CI → última execução aprovada do PR → artifact `blaise-v6-rj-administrador-apk-interno`. Baixar ZIP, extrair `app-admin.apk` e instalar no Android. Instalar apenas quando o SHA256, assinatura, identificador e CI estiverem confirmados.
- Senhas/credenciais, certificados privados e chaves meteorológicas não devem ser guardados no repositório nem inseridos no APK. Sem credenciais de servidor neste build.

## Meteoro: NOAA GFS atmosférico
- Novo adaptador opt-in usa NOAA NOMADS oficial e ecCodes para um subconjunto GRIB2 de temperatura 2 m do modelo GFS 0,25° (previsão **P**).
- Confere ID IBGE e ponto interior ao polígono RJ, domínio NOAA HTTPS, seção GRIB2, metadados, ciclo de emissão, horário previsto, unidade Kelvin, plausibilidade e idade máxima de 3 horas.
- Teste live autorizado roda em staging para **um ponto Rio de Janeiro**. A evidência real fica no artifact `blaise-rj-noaa-gfs-atmos-one-point-proof`. Em falha, estado `UNAVAILABLE` com `temperatureC:null`; sem dados fictícios.
- O método ainda **não está ligado** a agendador de 92 municípios, Firestore, API pública ou dashboard Android. Devem ser feitos testes de carga/quota, deduplicação por grade, série temporal e homologação antes da publicação.
- NOAA GFS é previsão, **não** substitui termômetro/estação observada ou chuva de pluviômetro.

## Gates atuais
- NOAA GFS Wave: houve prova real de um ponto oceânico; falta cobertura operacional e correnteza.
- DWD ICON: produto GRIB validado em teste anterior; temperatura do RJ ainda não georreferenciada conclusivamente.
- MET Norway/ECMWF: runtime opt-in exige revisão humana de Termos, User-Agent real e cache Firestore; não ativar sem isso.
- Chuva atual observada de até 30 minutos: sem fornecedor O de pluviômetro homologado, status `indisponível`.
- INMET/CEMADEN: comparação interna somente. Alerta Rio/Defesa Civil: links de alertas oficiais somente.
- HG Brasil Pro: autorização comercial escrita confirmada, mas a compra e a coleta pagas permanecem adiadas para a última fase. Sem autorização de pagamento.
- Climatempo: orçamento solicitado; nenhuma contratação.
- Windy, INEA, Marinha, JAXA/NASA, e outros provedores excluídos continuam fora.
- PR de trabalho: revisão e CI devem passar antes de qualquer mescla. Não alterar a `main` automaticamente.
