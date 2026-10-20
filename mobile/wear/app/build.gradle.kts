plugins {
    id("com.android.application")
}

android {
    namespace = "app.lifeos.wear"
    compileSdk = 35

    defaultConfig {
        // The same id as the phone app, so the two count as one app.
        applicationId = "app.lifeos"
        minSdk = 30
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            // Smaller download for the watch; signed with the same key as the phone app.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    lint {
        abortOnError = false
    }
}

dependencies {
    // Prayer times: the Java build of the same library the phone app uses.
    implementation("com.batoulapps.adhan:adhan:1.2.1")
    // Tiles and watch-face complications.
    implementation("androidx.wear.tiles:tiles:1.4.1")
    implementation("androidx.wear.protolayout:protolayout:1.2.1")
    implementation("androidx.wear.protolayout:protolayout-material:1.2.1")
    implementation("androidx.wear.watchface:watchface-complications-data-source:1.2.1")
    implementation("androidx.concurrent:concurrent-futures:1.2.0")

    testImplementation("junit:junit:4.13.2")
}
