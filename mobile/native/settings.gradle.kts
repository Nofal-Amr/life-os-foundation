// The native Life OS phone app (Kotlin + Jetpack Compose). It installs beside
// the web-view app in ../android until it covers enough to replace it.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "life-os-native"
include(":app")
