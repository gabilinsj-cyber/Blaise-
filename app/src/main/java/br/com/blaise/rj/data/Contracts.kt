package br.com.blaise.rj.data

import br.com.blaise.rj.core.City
import br.com.blaise.rj.core.OfficialAlert

interface WeatherRepository { suspend fun current(city: City): Result<WeatherSnapshot> }
interface AlertRepository { suspend fun official(city: City?): Result<List<OfficialAlert>> }
interface RadarRepository { suspend fun lastThirtyMinutes(city: City): Result<List<RadarFrame>> }
interface RiskRepository { suspend fun risks(city: City): Result<List<RiskEvent>> }
interface MarineRepository { suspend fun conditions(): Result<MarineSnapshot> }
interface TrafficRepository { suspend fun incidents(city: City): Result<List<TrafficIncident>> }
interface NewsRepository { suspend fun latest(): Result<List<NewsItem>> }
interface SubscriptionRepository { suspend fun hasActiveEntitlement(): Boolean }
interface VoiceService { suspend fun speak(text: String): Result<Unit> }
interface Observability { fun metric(name: String, value: Number); fun error(component: String, cause: Throwable) }

data class WeatherSnapshot(val temperatureC: Double, val rainProbability: Int, val source: String)
data class RadarFrame(val timestamp: Long, val source: String, val imageUrl: String)
data class RiskEvent(val title: String, val source: String)
data class MarineSnapshot(val waveHeightM: Double, val windDirection: String, val source: String)
data class TrafficIncident(val title: String, val source: String)
data class NewsItem(val title: String, val source: String, val publishedAt: Long)

