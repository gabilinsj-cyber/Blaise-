/**
 * Blaise V6 RJ — sector/product responsibilities (admin reference metadata).
 * Registry != operational ingestion, sensor availability, live warning or a
 * license to distribute data. O=observed, E=satellite/derived estimated,
 * P=forecast. Display actual values only after independent provenance checks.
 */
import {RJ_HG_BRASIL_PRO_PLAN} from './rj-hgbrasil-pro-plan.mjs';
const product=(sourceId,kind,productId,family,role)=>Object.freeze({
  sourceId,kind,productId,family,role,
  liveIngestionConfirmed:false,validatedRjCoverage:false,
});
const sector=(id,title,products,notes)=>Object.freeze({
  id,title,products:Object.freeze(products),notes,
});
const P=(sourceId,productId,family,role)=>product(sourceId,'P',productId,family,role);
const E=(sourceId,productId,family,role)=>product(sourceId,'E',productId,family,role);
const O=(sourceId,productId,family,role)=>product(sourceId,'O',productId,family,role);

export const RJ_SOURCE_SECTOR_MATRIX=Object.freeze([
  sector('AIR_TEMPERATURE','Temperatura do ar a 2 m',[
    E('HG_BRASIL_WEATHER_PRO','CURRENT_CITY_CONDITIONS','HG_BRASIL_AGGREGATED','condições agregadas HG; exibição autorizada, contratação adiada'),
    E('OPENWEATHER_ONECALL4_CURRENT','CURRENT_TEMPERATURE','OPENWEATHER_AGGREGATED','estimativa atual; só com licença, Secret Manager e quota'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','previsão alemã de 2 m; não termômetro observado')
  ],'NOAA, ECMWF/MET Norway e Climatempo estão excluídas de temperatura. Comparar com referência oficial apenas internamente, sem importar dados oficiais.'),
  sector('THERMAL_SENSATION','Sensação térmica',[
    E('OPENWEATHER_ONECALL4_CURRENT','CURRENT_FEELS_LIKE','OPENWEATHER_AGGREGATED','estimativa de sensação térmica atual do provedor'),
    E('BLAISE_VECTOR_RJ','THERMAL_FORMULAE','CALCULATED_FROM_AUDITED_INPUTS','cálculo com entradas HG ou DWD homologadas, quando domínio físico permitir')
  ],'HG não fornece sensação térmica direta comprovada. Sem entradas válidas e fórmula aplicada, exibir indisponível. NOAA/Climatempo/ECMWF excluídos.'),
  sector('AIR_PRESSURE_HUMIDITY','Umidade e pressão',[
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','principal'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','comparação'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    P('METEOBLUE_NEMS10','NEMSSA_RAW','METEOBLUE_NEMS10','comparação regional não homologada'),
    E('HG_BRASIL_WEATHER_PRO','CURRENT_CITY_HUMIDITY','HG_BRASIL_AGGREGATED','umidade agregada candidata, licença de exibição aprovada; não higrômetro homologado')
  ],'Mesmo ponto, nível atmosférico, unidade e horário de validade.'),
  sector('WIND_GUST','Vento sustentado e rajadas',[
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','principal'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','comparação'),
    P('METEOBLUE_NEMS10','NEMSSA_RAW','METEOBLUE_NEMS10','vento previsto, sem feed habilitado'),
    E('HG_BRASIL_WEATHER_PRO','CURRENT_CITY_WIND','HG_BRASIL_AGGREGATED','vento/rajadas atuais agregados candidatos, não anemômetro; sem coleta ativa')
  ],'Previsão de rajadas não é anemômetro medindo vento.'),
  sector('RAIN_NEXT_HOUR','Chuva prevista na próxima hora',[
    P('ECMWF_IFS','IFS_GLOBAL_VIA_MET_NO','ECMWF_IFS','principal'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','comparação'),
    P('METEOBLUE_NEMS10','NEMSSA_RAW','METEOBLUE_NEMS10','chuva futura prevista, não chuva observada')
  ],'Chuva futura prevista não substitui chuva observada agora.'),
  sector('SATELLITE_VISUAL_RJ','Imagens de nuvens e sistemas sobre o RJ',[
    O('RAMMB_CIRA_SLIDER','GOES19_ABI_VISUAL_LINK','GOES_EAST','somente link externo a imagens GOES-19')
  ],'Link de consulta visual ao RAMMB/CIRA SLIDER; sem ingestão, cópia de imagens ou extração de chuva em mm. Não é nova fonte independente do GOES/NOAA.'),
  sector('SATELLITE_VISUAL_ATLANTIC','Imagens de nuvens e sistemas no Atlântico Sul',[
    O('RAMMB_CIRA_SLIDER','GOES19_ABI_VISUAL_LINK','GOES_EAST','somente link externo a imagens GOES-19')
  ],'Observação de estruturas de nuvens e tempestades pelo GOES via visualizador externo. Não mede precipitação, não gera alertas automáticos.' ),
  sector('CLOUDS','Nuvens e sistemas convectivos',[
    O('NOAA_GOES','GOES_EAST_ABI','GOES_EAST','imagens satelitais'),
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','nebulosidade prevista'),
    P('METEOBLUE_NEMS10','NEMSSA_RAW','METEOBLUE_NEMS10','nuvens previstas, não imagem de satélite'),
    E('HG_BRASIL_WEATHER_PRO','CURRENT_CITY_CLOUDINESS','HG_BRASIL_AGGREGATED','nebulosidade atual agregada candidata, não sensor verificado; exibição comercial autorizada')
  ],'Imagem de nuvem observada não prova granizo ou tornado na superfície.'),
  sector('CYCLONE_LAND','Frentes e ciclones com possível impacto terrestre',[
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','principal'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','comparação')
  ],'Diagnóstico científico não vira alerta oficial sem validação por autoridade competente.'),
  sector('CYCLONE_OCEAN','Ciclones e sistemas no oceano',[
    P('ECMWF_IFS','IFS_GLOBAL_TRACKS_WHERE_AVAILABLE','ECMWF_IFS','principal'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    O('NOAA_GOES','GOES_EAST_ABI','GOES_EAST','contexto visual observado')
  ],'Caminho de tempestade previsto não confirma ciclone real; não inventar perigo nível 5.'),
  sector('WAVES_SWELL','Ondas, swell e período',[
    P('NOAA_GFS_WAVE','GFS_WAVE','NOAA_GFS_WAVE','principal'),
    P('ECMWF_WAVE','IFS_WAVE','ECMWF_WAVE','comparação sujeita a produto aberto')
  ],'Dados são previsões marítimas; a maré astronômica requer fonte distinta.'),
  sector('SST','Temperatura da superfície do mar',[
    E('NOAA_COASTWATCH_SST','ACSPO_GOES19_L3C','GOES19_ABI','única candidata; NOAA CoastWatch SST estimada E com máscara/QA')
  ],'A NOAA é a única fonte de SST cadastrada; arquivos recentes, pixels de qualidade e licença devem ser validados antes de exibir qualquer valor.'),
  sector('CLEAR_SKY_UV','UV previsto em céu limpo',[
    P('COPERNICUS_CAMS_UV_VIA_MET_NO','ultraviolet_index_clear_sky','CAMS','única exceção Copernicus')
  ],'NÃO exibir como UV real ajustado pelas nuvens, nem consumir Copernicus diretamente.'),
  sector('LIGHTNING','Relâmpagos',[
    O('NOAA_GLM','GOES_EAST_GLM','GOES_EAST_GLM','deteção satelital candidata')
  ],'É preciso comprovar cobertura, atraso, hora e licença da detecção antes de exibir contagens.'),
  sector('RIVERS_FLOODS','Nível de rios, cheias e alagamento',[
    O('ANA_RIVER','HYDROMETRIC_STATIONS','ANA','candidato a observação por estação'),
    O('SGB_SACE','SACE_STATIONS','SGB','candidato a observação por estação')
  ],'Sem estação homologada por município não há nível numérico válido; satélite de chuva não mede o nível do rio.'),
]);

export const RJ_SOURCE_MATRIX_POLICY=Object.freeze({
  automaticCollection:false,publishedToAndroid:false,
  domesticComparisonOnly:Object.freeze(['INMET','CEMADEN']),
  thermalOfficialVisualReviewOnly:Object.freeze(['INMET','DEFESA_CIVIL_RJ']),
  thermalOfficialAutoFetchEnabled:false,
  thermalApprovedDisplaySources:Object.freeze(['HG_BRASIL_WEATHER_PRO','OPENWEATHER_ONECALL4_CURRENT','DWD_ICON_GLOBAL']),
  thermalExplicitlyDisallowed:Object.freeze(['NOAA_GFS','ECMWF_IFS','MET_NORWAY_LOCATIONFORECAST_2','CLIMATEMPO']),
  officialReferralOnly:Object.freeze(['ALERTA_RIO','DEFESA_CIVIL_RJ']),
  officialPublicLinks:Object.freeze(['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET','INPE_CPTEC']),
  expresslyExcludedDirectSources:Object.freeze(['EUMETSAT','EUMETSAT_SAT','EUMETSAT_OSI_SAF','EUMETSAT_OSI_SAF_SST','INEA','MARINHA_DO_BRASIL','WINDY','COPERNICUS_DIRECT','JAXA_GSMAP','NASA_GPM_IMERG','NASA_SAT','NASA_MUR_SST','ZOOM_EARTH']),
  marineSstApprovedSources:Object.freeze(['NOAA_COASTWATCH_SST']),
  marineSstValidatedLive:false,
  hgBrasilPro:RJ_HG_BRASIL_PRO_PLAN,
  openWeatherOtherFieldsAssessment:Object.freeze({
    recommendedForLaterLicenseReview:Object.freeze(['humidityPct','windKmh','gustKmh']),
    providerRainMayBeModeled:true,
    providerRainQualifiesAsObservedGauge:false,
    extendOperationalAgent13WithoutAudit:false,
    additionalSourcePublicationEnabled:false,
    openWeatherDailyInternalMaximum:900,
    requireIndependentSourceStatusByField:true,
    sourceMeasurementsNotAssumed:true,
  }),
  meteoblueComparison:Object.freeze({
    id:'METEOBLUE_NEMS10',
    service:'meteoblue MultiModel / NEMS10 South America',
    modelDomain:'NEMSSA',nominalGridKm:10,
    representation:'P_FORECAST_ONLY',
    sameEcmwfNoaaDwdInputsNotIndependent:true,
    modelSpecificNemsIndependentCandidate:true,
    learningMultiModelNotIndependentOfConstituentModels:true,
    commercialApiLicenseVerified:false,
    serverApiCredentialsInstalled:false,
    liveNumericIngestionEnabled:false,
    androidObservedDataEnabled:false,
    projectedToMunicipalObservations:false,
    useOnlyWithModelAndForecastCycleEvidence:true,
    freeWeatherApi2026:Object.freeze({
      trialDurationMonths:12,totalCredits:10000000,
      approximateLowestCostCallsTotal:2500,
      oneYearNotRenewable:true,commercialUsePermittedByProvider:true,
      userAccountConnected:false,freeTrialActivated:true,
      trialActivatedFromOperatorScreenshot:true,
      freeTrialExpiresOn:'2027-11-18',
      apiKeyExposedInChatScreenshot:true,apiKeyRotationRequired:true,
      cloudShellUserVerifiedOneShot:true,
      cloudShellOneShotStatus:200,
      cloudShellOneShotPackage:'basic-6h',
      cloudShellOneShotForecastTimeSlots:29,
      cloudShellOneShotEvidence:'USER_SCREENSHOT_2026-11-18_13_15_BRT',
      secretManagerConfigurationConfirmed:false,
      backendProviderConnectionValidated:false,
      serverApiKeyInstalled:false,subscriptionActivated:false,
      purchasedCredits:0,automaticCalls:false,
      eligibleForAirTemperature:false,eligibleForFeelsLike:false,
      eligibleForObservedRain:false,
      freeTierIncludesAirConvectiveForecast:true,
      freeTierNowcastIncluded:false,
      freeTierSeaIncluded:false,
      freeTierCurrentIncluded:false,
      freeTierMeasurementsIncluded:false,
      freeTierWarningsIncluded:false,
      freeTierMaxTemporalResolution:'1h',
      approvedUse:'FORECAST_COMPARISON_ONLY_AFTER_CREDENTIAL_LICENSE_CYCLE_AUDIT',
      officialInfoUrl:'https://business.meteoblue.com/products/weather-apis/free-weather-api',
      currentPricingUrl:'https://business.meteoblue.com/pricing',
    })
  }),
  satelliteVisualReference:Object.freeze({
    id:'RAMMB_CIRA_SLIDER',url:'https://rammb-slider.cira.colostate.edu/',
    underlyingSensor:'NOAA_GOES_19_ABI',type:'EXTERNAL_LINK_ONLY',
    authorizedEmbeddedImagery:false,providesRainMm:false,
    independentFromNoaa:false,operatorValidatedFreshness:false,
    maxAcceptableImageAgeMinutes:30
  }),
  currentRainObservation:Object.freeze({
    maxAgeMinutes:30,
    acceptedKinds:Object.freeze(['O']),
    acceptedLicensedRainGaugeSources:Object.freeze([]),
    satelliteRainEstimateAllowed:false,
    missingDataStatus:'UNAVAILABLE',
    requiresProviderTimestamp:true,
  }),
  singleCamsException:'COPERNICUS_CAMS_UV_VIA_MET_NO',
  agent13:'OWM_ONLY_IF_ALL_VERIFIED_INTERNATIONAL_TEMPERATURE_FEELS_LIKE_UNAVAILABLE_35M_900_DAY',
  notLiveCollection:true
});
export function getUnderlyingFamiliesForSector(id){
  const sector=RJ_SOURCE_SECTOR_MATRIX.find(s=>s.id===id);
  if(!sector)return Object.freeze([]);
  return Object.freeze([...new Set(sector.products.map(p=>p.family))]);
}
