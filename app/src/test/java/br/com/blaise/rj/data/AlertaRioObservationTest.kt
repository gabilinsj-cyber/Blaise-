package br.com.blaise.rj.data
import org.junit.Test
import org.junit.Assert.*
import java.time.Instant
class AlertaRioObservationTest {
 private fun html(temp:String="25,0", humidity:String="94,4", date:String="06/10/2026 - 17:00:00") = "<h3>Dados Meteorológicos</h3><table><tr><th>P. de Orvalho</th><th>Umi. do Ar</th></tr><tr>"+listOf("32","São Cristóvão",date,temp,humidity,"1009,8","24,0","15,2","332,1").joinToString(""){"<td>$it</td>"}+"</tr></table>"
 private val now=Instant.parse("2026-10-06T20:10:00Z")
 @Test fun officialCapturedHtmlPreservesCoverageAndSourceMissingFields() {
  val html=javaClass.getResource("/alerta-rio-meteorology-20261006.html")!!.readText()
  val rows=AlertaRioObservationParser.parse(html,Instant.parse("2026-10-06T20:03:00Z"))
  assertEquals(8,rows.size)
  val station=rows.first{it.station=="São Cristóvão"}
  assertEquals(25.0,station.temperatureC!!,0.001)
  assertNull(rows.first{it.station=="Irajá"}.temperatureC)
 }
 @Test fun parsesLocalTimeUnitsAndMissingFields() { val o=AlertaRioObservationParser.parse(html(),now).single();assertEquals(25.0,o.temperatureC!!,0.001);assertEquals(15.2,o.windKmh!!,0.001);assertEquals(Instant.parse("2026-10-06T20:00:00Z"),o.observedAt);assertNull(AlertaRioObservationParser.parse(html("-"),now).single().temperatureC) }
 @Test fun staleAndFutureAreNotCurrent() {assertTrue(AlertaRioObservationParser.parse(html(date="06/10/2026 - 15:00:00"),now).isEmpty());assertTrue(AlertaRioObservationParser.parse(html(date="06/10/2026 - 18:00:00"),now).isEmpty())}
 @Test(expected=IllegalArgumentException::class) fun rejectsImpossibleHumidity(){AlertaRioObservationParser.parse(html(humidity="101"),now)}
 @Test(expected=java.time.format.DateTimeParseException::class) fun rejectsCalendarOverflow(){AlertaRioObservationParser.parse(html(date="31/02/2026 - 17:00:00"),now)}
}
