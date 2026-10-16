package br.com.blaise.rj.bulletin
import org.junit.Assert.*
import org.junit.Test
import java.time.ZonedDateTime
class BulletinPolicyTest {
    @Test fun replacesPeriodAndConvertsTimezone() {
        assertEquals(12, BulletinPolicy.currentPeriod(ZonedDateTime.parse("2026-10-06T15:01:00Z")).hour)
        assertEquals(5, BulletinPolicy.currentPeriod(ZonedDateTime.parse("2026-10-06T05:00:00-03:00")).dayOfMonth)
    }
    @Test fun modalitiesAndCadence() {
        assertFalse(BulletinPolicy.spoken(4,false)); assertTrue(BulletinPolicy.spoken(4,true)); assertTrue(BulletinPolicy.spoken(5,false))
        assertEquals(300L,BulletinPolicy.refreshSeconds(3)); assertEquals(30L,BulletinPolicy.refreshSeconds(4))
    }
}
