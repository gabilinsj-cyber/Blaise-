set -eu
grib_get -p shortName,units,dataDate,dataTime,validityDate,validityTime,Ni,Nj /fixtures/noaa-wave-20261022-06.grib2
grib_ls -l -23.5,317 /fixtures/noaa-wave-20261022-06.grib2
