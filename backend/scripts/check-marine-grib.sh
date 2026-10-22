set -eu
grib_get -p shortName,units,dataDate,dataTime,validityDate,validityTime,Ni,Nj /fixtures/noaa-wave-20261022-06.grib2
grib_ls -n geography /fixtures/noaa-wave-20261022-06.grib2
