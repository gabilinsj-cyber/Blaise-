/**
 * Blaise V6 RJ — sector/product responsibilities (admin reference metadata).
 * Registry != operational ingestion, sensor availability, live warning or a
 * license to distribute data. O=observed, E=satellite/derived estimated,
 * P=forecast. Display actual values only after independent provenance checks.
 */
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
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','principal via MET Norway'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','comparação independente'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação independente')
  ],'A MET Norway é um distribuidor ECMWF, não um quarto modelo nem observação de termômetro.'),
  sector('THERMAL_SENSATION','Sensação térmica',[
    E('MET_NORWAY_LOCATIONFORECAST_2','apparent_air_temperature','ECMWF_IFS','estimativa do modelo'),
    E('BLAISE_VECTOR_RJ','THERMAL_FORMULAE','CALCULATED_FROM_AUDITED_INPUTS','cálculo administrativo')
  ],'Não inventar sensação fora do domínio das fórmulas nem usar o cálculo para alarmes.'),
  sector('AIR_PRESSURE_HUMIDITY','Umidade e pressão',[
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','principal'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','comparação'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação')
  ],'Mesmo ponto, nível atmosférico, unidade e horário de validade.'),
  sector('WIND_GUST','Vento sustentado e rajadas',[
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','principal'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','comparação')
  ],'Previsão de rajadas não é anemômetro medindo vento.'),
  sector('RAIN_NEXT_HOUR','Chuva prevista na próxima hora',[
    P('ECMWF_IFS','IFS_GLOBAL_VIA_MET_NO','ECMWF_IFS','principal'),
    P('NOAA_GFS','GFS_ATMOS','NOAA_GFS','comparação'),
    P('DWD_ICON_GLOBAL','ICON_GLOBAL','DWD_ICON','comparação')
  ],'Chuva futura prevista não substitui chuva observada agora.'),
  sector('RAIN_SATELLITE_LAND','Chuva estimada por satélite sobre o RJ',[
    E('JAXA_GSMAP','GSMAP_V06','JAXA_GSMAP','principal, sujeito a latência'),
    E('NASA_GPM_IMERG','IMERG_EARLY_V07','NASA_GPM_IMERG','comparação multissatélite')
  ],'Estimativas de grade, sem pluviômetro local. NASA e JAXA compartilham sensores: verificar correlação e independência por insumo.'),
  sector('RAIN_SATELLITE_OCEAN','Chuva estimada no Atlântico',[
    E('JAXA_GSMAP','GSMAP_V06','JAXA_GSMAP','principal'),
    E('NASA_GPM_IMERG','IMERG_EARLY_V07','NASA_GPM_IMERG','comparação')
  ],'Estimativas de precipitação oceânica; não inventar observação de navio ou plataforma.'),
  sector('CLOUDS','Nuvens e sistemas convectivos',[
    O('NOAA_GOES','GOES_EAST_ABI','GOES_EAST','imagens satelitais'),
    O('EUMETSAT_SAT','METEOSAT_IMAGES','EUMETSAT_METEOSAT','cobertura conforme produto'),
    P('ECMWF_IFS','IFS_GLOBAL','ECMWF_IFS','nebulosidade prevista')
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
    E('EUMETSAT_OSI_SAF','OSI_207_C','GOES_EAST_ABI','principal candidato'),
    E('NOAA_COASTWATCH','ACSPO_GOES_EAST','GOES_EAST_ABI','comparação correlacionada'),
    E('NASA_MUR_SST','MUR_L4_SST','BLENDED_MULTI_SAT','referência composta')
  ],'O mesmo GOES/ABI aparece em dois processamentos: NÃO são sensores independentes. Validar máscara e período.'),
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
  officialReferralOnly:Object.freeze(['ALERTA_RIO','DEFESA_CIVIL_RJ']),
  officialPublicLinks:Object.freeze(['ALERTA_RIO','DEFESA_CIVIL_RJ','INMET','INPE_CPTEC']),
  expresslyExcludedDirectSources:Object.freeze(['INEA','MARINHA_DO_BRASIL','WINDY','COPERNICUS_DIRECT']),
  singleCamsException:'COPERNICUS_CAMS_UV_VIA_MET_NO',
  agent13:'OWM_ONLY_IF_ALL_VERIFIED_INTERNATIONAL_TEMPERATURE_FEELS_LIKE_UNAVAILABLE_35M_900_DAY',
  notLiveCollection:true
});
export function getUnderlyingFamiliesForSector(id){
  const sector=RJ_SOURCE_SECTOR_MATRIX.find(s=>s.id===id);
  if(!sector)return Object.freeze([]);
  return Object.freeze([...new Set(sector.products.map(p=>p.family))]);
}
