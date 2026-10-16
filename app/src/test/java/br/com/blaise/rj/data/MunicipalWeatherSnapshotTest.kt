package br.com.blaise.rj.data
import br.com.blaise.rj.ScientificDashboardPolicy
import java.time.Instant
import org.junit.Assert.*
import org.junit.Test
class MunicipalWeatherSnapshotTest {
 private val now = Instant.parse("2026-10-14T15:00:00Z")
 private fun snapshot(ibge: Int, temperature: Double = 30.0) = MunicipalWeatherSnapshot.fromSeries(ibge,
  InmetHourlySeries("A652", "ESTACAO TESTE (A652)", "https://apitempo.inmet.gov.br/estacao/2026-10-13/2026-10-14/A652",
   -22.9, -43.1, listOf(InmetHourlyPoint(now.minusSeconds(3600), 28.0, 1.5, 10.0, 70.0),
    InmetHourlyPoint(now.minusSeconds(60), temperature, 0.0, 12.0, 75.0, 15.0)), ibge), now)
 @Test fun `cards map chart share exact temperature timestamp and thermal inputs`() {
  val s = snapshot(3304557)
  val observation = s.currentReport(now).currentObservation(now)!!
  val series = s.currentSeries(now)!!
  val map = series.currentPoint(InmetMetric.TEMPERATURE, now)!!
  val chart = s.historySeries()!!.historyPoints(InmetMetric.TEMPERATURE, now.minusSeconds(7200), now, now).last()
  assertEquals(observation.observedAt, map.first.observedAt)
  assertEquals(observation.temperatureC!!, map.second, 0.0)
  assertEquals(map, chart)
  assertEquals(ScientificDashboardPolicy.thermalCelsius(observation.temperatureC, observation.humidityPercent, observation.windKmh)!!,
   series.currentPoint(InmetMetric.THERMAL_SENSATION, now)!!.second, 0.0)
  assertEquals(0.0, series.currentPoint(InmetMetric.HOURLY_RAINFALL, now)!!.second, 0.0)
 }
 @Test fun `cities never share data and late results after changing city are rejected`() {
  val store = MunicipalWeatherSnapshotStore()
  val ticket = store.begin(setOf(3304557, 3303302))
  assertTrue(store.publish(ticket, mapOf(3304557 to snapshot(3304557, 30.0), 3303302 to snapshot(3303302, 24.0)), now))
  assertEquals(30.0, store.snapshot()[3304557]!!.report.observation!!.temperatureC!!, 0.0)
  assertEquals(24.0, store.snapshot()[3303302]!!.report.observation!!.temperatureC!!, 0.0)
  val next = store.begin(setOf(3303302))
  assertFalse(store.publish(ticket, mapOf(3304557 to snapshot(3304557)), now))
  assertTrue(store.snapshot().isEmpty())
  assertFalse(store.publish(next, mapOf(3303302 to snapshot(3304557)), now))
 }
 @Test fun `cross city series and changed values are blocked`() {
  val s = snapshot(3304557)
  assertFalse(s.copy(series = s.series!!.copy(municipalityIbge = 3303302)).coherent())
  val bad = s.copy(report = s.report.copy(observation = s.report.observation!!.copy(temperatureC = 31.0)))
  assertFalse(bad.coherent()); assertNull(bad.currentReport(now).currentObservation(now)); assertNull(bad.historySeries())
 }
 @Test fun `expired current data disappears while dated history is retained`() {
  val s = snapshot(3304557); val later = now.plusSeconds(301)
  assertNull(s.currentReport(later).currentObservation(later)); assertNull(s.currentSeries(later))
  assertEquals(2, s.historySeries()!!.historyPoints(InmetMetric.TEMPERATURE, now.minusSeconds(7200), later, later).size)
 }
 @Test fun `missing current metric never backfills an older reading`() {
  val s = snapshot(3304557).series!!
  val missing = s.copy(points = s.points.dropLast(1) + s.points.last().copy(temperatureC = null))
  assertNull(missing.currentPoint(InmetMetric.TEMPERATURE, now)); assertNull(missing.currentPoint(InmetMetric.THERMAL_SENSATION, now))
 }
 @Test fun `hourly audit preserves city and failure reason`() {
  val store = MunicipalWeatherSnapshotStore(); val ticket = store.begin(setOf(3304557))
  assertTrue(store.publish(ticket, mapOf(3304557 to snapshot(3304557)), now))
  assertTrue(store.auditHourly(now)); assertFalse(store.auditHourly(now.plusSeconds(3599))); assertTrue(store.auditHourly(now.plusSeconds(3600)))
  assertEquals("HOURLY_CHECK_UNAVAILABLE_OR_INCONSISTENT", store.audits().last().reason)
  assertEquals(3304557, store.audits().last().municipalityIbge)
  store.publish(ticket, mapOf(3304557 to MunicipalWeatherSnapshot(CityWeatherResult(3304557, null), null, now, "HTTP_204")), now)
  assertEquals("SOURCE_FAILURE:HTTP_204", store.audits().last().reason)
 }
 @Test fun `missing INMET observations are visible without reviving expired data`() {
  val stale = snapshot(3304557).copy(failureCode = "SOURCE_NO_OBSERVATIONS")
  val later = now.plusSeconds(600)
  val report = stale.currentReport(later)
  assertNull(report.currentObservation(later))
  assertTrue(report.unavailableReason!!.contains("INMET não forneceu observações"))
  assertNull(stale.currentSeries(later))
  assertNotNull(stale.historySeries())
 }
 @Test fun `failed fallback does not hide a valid station observation`() {
  val valid = snapshot(3304557).copy(failureCode = "SOURCE_NO_OBSERVATIONS")
  assertNotNull(valid.currentReport(now).currentObservation(now))
  assertEquals(valid.report, valid.currentReport(now))
 }
}
