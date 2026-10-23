plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

// The Supabase address and publishable key the web app uses (../../.env).
// Both are public by design; row-level security protects the data.
val env: Map<String, String> = rootProject.file("../../.env").let { file ->
    if (!file.exists()) emptyMap()
    else file.readLines()
        .mapNotNull { line -> line.split("=", limit = 2).takeIf { it.size == 2 } }
        .associate { (key, value) -> key.trim() to value.trim().removeSurrounding("\"") }
}

android {
    namespace = "app.lifeos.kt"
    compileSdk = 35

    defaultConfig {
        // Its own id, so it installs beside the web-view app (app.lifeos).
        applicationId = "app.lifeos.kt"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2"
        buildConfigField("String", "SUPABASE_URL", "\"${env["VITE_SUPABASE_URL"].orEmpty()}\"")
        buildConfigField("String", "SUPABASE_KEY", "\"${env["VITE_SUPABASE_PUBLISHABLE_KEY"].orEmpty()}\"")
        // Google's Web client ID (the one in Supabase → Auth → Google). Empty: Google sign-in goes through the website.
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${(env["GOOGLE_WEB_CLIENT_ID"] ?: env["VITE_GOOGLE_CLIENT_ID"]).orEmpty()}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        release {
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
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    // Fingerprint (Work clock-in, locked notes).
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.navigation:navigation-compose:2.8.4")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Dependency injection.
    implementation("com.google.dagger:hilt-android:2.52")
    ksp("com.google.dagger:hilt-compiler:2.52")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
    implementation("androidx.hilt:hilt-work:1.2.0")
    ksp("androidx.hilt:hilt-compiler:1.2.0")

    // Sign in with Google through Android's own account picker.
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Supabase's REST and auth endpoints.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Everything is stored on the phone first; Supabase is synced in the background.
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // Prayer times: the same library the web and watch apps use.
    implementation("com.batoulapps.adhan:adhan:1.2.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    // The real org.json; Android's is only a stub in JVM tests.
    testImplementation("org.json:json:20240303")
}
