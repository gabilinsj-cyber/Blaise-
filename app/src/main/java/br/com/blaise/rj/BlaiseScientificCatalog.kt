package br.com.blaise.rj

/**
 * Read-only registry of the existing backend's exported scientific methods.
 * A method's presence here does NOT mean a provider supplied validated inputs
 * or that a calculation is live. Calculations and alerts remain backend-gated.
 *
 * Regenerate/check this catalogue when backend/src/blaise-scientific-kernels.mjs
 * or any of its re-exported modules changes.
 */
data class BlaiseScientificMethod(
    val id: String,
    val domain: String,
    val backendSource: String,
)

object BlaiseScientificCatalog {
    const val STATUS = "MÉTODOS CADASTRADOS • NÃO SÃO MEDIÇÕES NEM ALERTAS"
    val methods: List<BlaiseScientificMethod> = listOf(
        BlaiseScientificMethod("equivalentPotentialTemperatureApprox", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("clausiusClapeyronDerivative", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("precipitableWater", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("referenceEvapotranspirationDaily", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("soilWaterBalance", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("oceanWindStress", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("tropicalCycloneHeatPotential", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("neutralMeanWindProfile", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("calibratedKdpRainRate", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("calibratedMos", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("scalarKalmanUpdate", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("calibratedTurbulentGust", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("bulkWindShear", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("stormRelativeHelicity", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("horizontalWindDiagnostics", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("stationPressureTendency", "Núcleo atmosférico e hidrometeorológico", "backend/src/blaise-scientific-kernels.mjs"),
        BlaiseScientificMethod("linearFeatureAdvection", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("vaporPressureFromDewPoint", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("relativeHumidityFromDewPoint", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("mixingRatio", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("specificHumidityFromMixingRatio", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("observedEnvironmentalLapseRate", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("meanVirtualTemperatureSeaLevelPressure", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("wetBulbStullApprox", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("verifiedRainfallAccumulation", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("calibratedZrRainRate", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("parcelBuoyancyEnergy", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("moistureFluxConvergence", "Termodinâmica, chuva e advecção", "backend/src/blaise-rj-advanced-physics.mjs"),
        BlaiseScientificMethod("significantWaveSpectrum", "Oceano e ondas", "backend/src/blaise-marine-kernels.mjs"),
        BlaiseScientificMethod("linearWaveDispersion", "Oceano e ondas", "backend/src/blaise-marine-kernels.mjs"),
        BlaiseScientificMethod("conditionalMarineTravelTime", "Oceano e ondas", "backend/src/blaise-marine-kernels.mjs"),
        BlaiseScientificMethod("liftingCondensationLevel", "Perfis e instabilidade", "backend/src/blaise-scientific-advanced.mjs"),
        BlaiseScientificMethod("environmentalLapseRate", "Perfis e instabilidade", "backend/src/blaise-scientific-advanced.mjs"),
        BlaiseScientificMethod("hypsometricThickness", "Perfis e instabilidade", "backend/src/blaise-scientific-advanced.mjs"),
        BlaiseScientificMethod("suppliedParcelCapeCin", "Perfis e instabilidade", "backend/src/blaise-scientific-advanced.mjs"),
        BlaiseScientificMethod("shallowWaterLongWaveSpeed", "Ondas longas e cenário condicional", "backend/src/blaise-tsunami-science.mjs"),
        BlaiseScientificMethod("tsunamiConditionalPathSensitivity", "Ondas longas e cenário condicional", "backend/src/blaise-tsunami-science.mjs"),
    )
    init {
        require(methods.size == 37)
        require(methods.map { it.id }.distinct().size == methods.size)
    }
}
