// The Life OS watch app (Wear OS 3+, e.g. Galaxy Watch 4 and newer).
// Separate from the phone app, which builds without Gradle (see ../android).
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
rootProject.name = "life-os-wear"
include(":app")
