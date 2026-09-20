package br.com.blaise.rj.storage

import android.content.Context
import android.os.Process
import java.io.File
import java.nio.file.Files
import java.util.concurrent.atomic.AtomicBoolean

object StorageBudgetPolicy {
    const val MAX_CACHE_AGE_MILLIS: Long = 24L * 60L * 60L * 1000L
    const val HIGH_WATER_BYTES: Long = 32L * 1024L * 1024L
    const val TARGET_BYTES: Long = 16L * 1024L * 1024L
}

data class StoragePruneResult(
    val bytesBefore: Long,
    val bytesAfter: Long,
    val filesDeleted: Int,
)

object StoragePruner {
    fun prune(
        roots: List<File>,
        nowMillis: Long,
        maxAgeMillis: Long = StorageBudgetPolicy.MAX_CACHE_AGE_MILLIS,
        highWaterBytes: Long = StorageBudgetPolicy.HIGH_WATER_BYTES,
        targetBytes: Long = StorageBudgetPolicy.TARGET_BYTES,
    ): StoragePruneResult {
        require(maxAgeMillis >= 0L)
        require(highWaterBytes >= 0L)
        require(targetBytes in 0L..highWaterBytes)

        val uniqueRoots = roots
            .filter { it.exists() && it.isDirectory }
            .distinctBy { runCatching { it.canonicalPath }.getOrDefault(it.absolutePath) }

        val initialFiles = uniqueRoots.flatMap(::collectFiles)
        val bytesBefore = initialFiles.sumOf(::safeLength)
        var deleted = 0

        initialFiles
            .filter { file ->
                val modified = file.lastModified()
                modified > 0L && nowMillis >= modified && nowMillis - modified > maxAgeMillis
            }
            .sortedBy { it.lastModified() }
            .forEach { file ->
                if (file.delete()) deleted += 1
            }

        var remaining = uniqueRoots.flatMap(::collectFiles).sortedBy { it.lastModified() }
        var bytesAfter = remaining.sumOf(::safeLength)

        if (bytesAfter > highWaterBytes) {
            for (file in remaining) {
                if (bytesAfter <= targetBytes) break
                val bytes = safeLength(file)
                if (file.delete()) {
                    deleted += 1
                    bytesAfter = (bytesAfter - bytes).coerceAtLeast(0L)
                }
            }
        }

        uniqueRoots.forEach(::removeEmptyDirectories)

        // Recalculate from disk so partial delete failures cannot under-report usage.
        remaining = uniqueRoots.flatMap(::collectFiles)
        bytesAfter = remaining.sumOf(::safeLength)

        return StoragePruneResult(
            bytesBefore = bytesBefore,
            bytesAfter = bytesAfter,
            filesDeleted = deleted,
        )
    }

    private fun collectFiles(root: File): List<File> {
        val output = mutableListOf<File>()

        fun visit(node: File) {
            if (!node.exists()) return
            if (runCatching { Files.isSymbolicLink(node.toPath()) }.getOrDefault(false)) return
            if (node.isFile) {
                output += node
                return
            }
            if (!node.isDirectory) return
            node.listFiles()?.forEach(::visit)
        }

        root.listFiles()?.forEach(::visit)
        return output
    }

    private fun removeEmptyDirectories(root: File) {
        fun visit(directory: File) {
            if (runCatching { Files.isSymbolicLink(directory.toPath()) }.getOrDefault(false)) return
            directory.listFiles()?.filter { it.isDirectory }?.forEach(::visit)
            if (directory != root && directory.listFiles()?.isEmpty() == true) {
                directory.delete()
            }
        }
        visit(root)
    }

    private fun safeLength(file: File): Long = runCatching { file.length().coerceAtLeast(0L) }.getOrDefault(0L)
}

object StorageMaintenance {
    private val scheduled = AtomicBoolean(false)

    fun schedule(context: Context) {
        if (!scheduled.compareAndSet(false, true)) return
        val appContext = context.applicationContext

        Thread {
            Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
            runCatching {
                StoragePruner.prune(
                    roots = listOfNotNull(appContext.cacheDir, appContext.externalCacheDir),
                    nowMillis = System.currentTimeMillis(),
                )
            }
        }.apply {
            name = "blaise-cache-trim"
            start()
        }
    }
}
