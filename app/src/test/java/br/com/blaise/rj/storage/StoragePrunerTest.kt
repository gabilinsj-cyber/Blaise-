package br.com.blaise.rj.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class StoragePrunerTest {
    @Test
    fun removesExpiredCacheButKeepsFreshCache() {
        val root = Files.createTempDirectory("blaise-cache-age").toFile()
        try {
            val now = 2_000_000L
            val old = write(root, "old.bin", 8, now - 1_001L)
            val fresh = write(root, "fresh.bin", 8, now - 100L)

            val result = StoragePruner.prune(
                roots = listOf(root),
                nowMillis = now,
                maxAgeMillis = 1_000L,
                highWaterBytes = 1_000L,
                targetBytes = 500L,
            )

            assertFalse(old.exists())
            assertTrue(fresh.exists())
            assertEquals(1, result.filesDeleted)
            assertEquals(8L, result.bytesAfter)
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun trimsOldestFilesUntilTargetWhenBudgetIsExceeded() {
        val root = Files.createTempDirectory("blaise-cache-budget").toFile()
        try {
            val now = 5_000_000L
            val oldest = write(root, "a.bin", 10, now - 300L)
            val middle = write(root, "b.bin", 10, now - 200L)
            val newest = write(root, "c.bin", 10, now - 100L)

            val result = StoragePruner.prune(
                roots = listOf(root),
                nowMillis = now,
                maxAgeMillis = 10_000L,
                highWaterBytes = 20L,
                targetBytes = 10L,
            )

            assertFalse(oldest.exists())
            assertFalse(middle.exists())
            assertTrue(newest.exists())
            assertEquals(10L, result.bytesAfter)
            assertEquals(2, result.filesDeleted)
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun neverTouchesPersistentFilesOutsideCacheRoots() {
        val parent = Files.createTempDirectory("blaise-cache-scope").toFile()
        val cache = File(parent, "cache").apply { mkdirs() }
        val persistent = File(parent, "files").apply { mkdirs() }
        try {
            val now = 9_000_000L
            write(cache, "ephemeral.bin", 5, now - 5_000L)
            val keep = write(persistent, "city-selection.bin", 5, now - 5_000L)

            StoragePruner.prune(
                roots = listOf(cache),
                nowMillis = now,
                maxAgeMillis = 1_000L,
                highWaterBytes = 100L,
                targetBytes = 50L,
            )

            assertTrue(keep.exists())
        } finally {
            parent.deleteRecursively()
        }
    }

    private fun write(root: File, name: String, bytes: Int, modifiedAt: Long): File =
        File(root, name).apply {
            parentFile?.mkdirs()
            writeBytes(ByteArray(bytes) { 1 })
            assertTrue(setLastModified(modifiedAt))
        }
}
