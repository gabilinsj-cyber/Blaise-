import java.net.URI

pluginManagement {
    repositories {
        val proxy = System.getenv("BLAISE_MAVEN_PROXY")?.trim().orEmpty()
        if (proxy.isNotEmpty()) {
            val endpoint = URI("${proxy.trimEnd('/')}/all")
            require(endpoint.scheme.equals("https", ignoreCase = true) && !endpoint.host.isNullOrBlank()) {
                "BLAISE_MAVEN_PROXY must be an absolute HTTPS URL"
            }
            maven { url = uri(endpoint) }
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
            val endpoint = URI("${proxy.trimEnd('/')}/all")
            require(endpoint.scheme.equals("https", ignoreCase = true) && !endpoint.host.isNullOrBlank()) {
                "BLAISE_MAVEN_PROXY must be an absolute HTTPS URL"
            }
            maven { url = uri(endpoint) }
        } else {
            google()
            mavenCentral()
        }
    }
}

rootProject.name = "BlaiseV6RJ"
include(":app")
