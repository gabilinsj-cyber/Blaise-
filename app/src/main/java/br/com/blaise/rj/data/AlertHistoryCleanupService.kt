package br.com.blaise.rj.data

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import java.time.Instant
import java.util.concurrent.TimeUnit

/** Only expired alert history is disposable; settings and credentials are untouched. */
class AlertHistoryCleanupService : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        prune(this, Instant.now())
        return false
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        const val JOB_ID = 62024

        fun prune(context: Context, now: Instant) {
            // Reads purge records whose 12-hour historical retention has elapsed.
            OfficialWarningHistory(context).read(now)
            OfficialMarineWarningHistory(context).read(now)
        }

        fun schedule(context: Context) {
            prune(context, Instant.now())
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            if (scheduler.getPendingJob(JOB_ID) != null) return
            scheduler.schedule(JobInfo.Builder(JOB_ID,
                ComponentName(context, AlertHistoryCleanupService::class.java))
                .setPeriodic(TimeUnit.HOURS.toMillis(24))
                .setPersisted(true)
                .build())
        }
    }
}
