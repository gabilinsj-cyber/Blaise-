pluginManagement {
    repositories {
        val proxy = System.getenv("BLAISE_MAVEN_PROXY")
        if (proxy != null) {
            maven { url = uri("$proxy/all"); isAllowInsecureProtocol = true }
        } else { google(); mavenCentral(); gradlePluginPortal() }
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        val proxy = System.getenv("BLAISE_MAVEN_PROXY")
        if (proxy != null) {
            maven { url = uri("$proxy/all"); isAllowInsecureProtocol = true }
        } else { google(); mavenCentral() }
    }
}
rootProject.name = "BlaiseV6RJ"
include(":app")
