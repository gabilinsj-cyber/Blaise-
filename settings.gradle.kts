pluginManagement {
    repositories {
        val proxy = System.getenv("BLAISE_MAVEN_PROXY")?.trim().orEmpty()
        if (proxy.isNotEmpty()) {
            require(proxy.startsWith("https://", ignoreCase = true)) {
                "BLAISE_MAVEN_PROXY must be an absolute HTTPS URL"
            }
            maven { url = uri("${proxy.trimEnd('/')}/all") }
        } else {
            google()
            mavenCentral()
            gradlePluginPortal()
        }
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        val proxy = System.getenv("BLAISE_MAVEN_PROXY")?.trim().orEmpty()
        if (proxy.isNotEmpty()) {
            require(proxy.startsWith("https://", ignoreCase = true)) {
                "BLAISE_MAVEN_PROXY must be an absolute HTTPS URL"
            }
            maven { url = uri("${proxy.trimEnd('/')}/all") }
        } else {
            google()
            mavenCentral()
        }
    }
}

rootProject.name = "BlaiseV6RJ"
include(":app")
