plugins { alias(libs.plugins.android.application); alias(libs.plugins.kotlin.android); alias(libs.plugins.kotlin.compose) }

val prepareDoraVoice by tasks.registering(Exec::class) {
    workingDir(rootProject.projectDir)
    commandLine("python3", "scripts/prepare-dora-voice.py")
    inputs.file(rootProject.file("scripts/prepare-dora-voice.py"))
    outputs.dir(layout.buildDirectory.dir("generated/dora"))
}
val doraRuntime = files(layout.buildDirectory.file("generated/dora/sherpa-onnx-1.13.8.aar")).builtBy(prepareDoraVoice)

fun buildConfigString(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

val releaseKeystorePath = System.getenv("BLAISE_KEYSTORE_PATH")
val releaseStorePassword = System.getenv("BLAISE_STORE_PASSWORD")
val releaseKeyAlias = System.getenv("BLAISE_KEY_ALIAS")
val releaseKeyPassword = System.getenv("BLAISE_KEY_PASSWORD")
val releaseSigningReady = listOf(
    releaseKeystorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }

val monthlyProductId = System.getenv("BLAISE_MONTHLY_PRODUCT_ID").orEmpty().trim()
val annualProductId = System.getenv("BLAISE_ANNUAL_PRODUCT_ID").orEmpty().trim()
val entitlementVerifyUrl = System.getenv("BLAISE_ENTITLEMENT_VERIFY_URL").orEmpty().trim()
val firebaseApplicationId = System.getenv("BLAISE_FIREBASE_APPLICATION_ID").orEmpty().trim()
val firebaseApiKey = System.getenv("BLAISE_FIREBASE_API_KEY").orEmpty().trim()
val firebaseProjectId = System.getenv("BLAISE_FIREBASE_PROJECT_ID").orEmpty().trim()
val firebaseSenderId = System.getenv("BLAISE_FIREBASE_SENDER_ID").orEmpty().trim()
val subscriberAuthFlag = System.getenv("BLAISE_SUBSCRIBER_AUTH_ENABLED").orEmpty().trim().ifEmpty { "false" }
require(subscriberAuthFlag in setOf("true", "false")) { "invalid_subscriber_auth_enabled" }
if (subscriberAuthFlag == "true") {
    require(listOf(firebaseApplicationId, firebaseApiKey, firebaseProjectId, firebaseSenderId).all { it.isNotBlank() }) {
        "subscriber_firebase_config_missing"
    }
}
val storeChannel = System.getenv("BLAISE_STORE_CHANNEL").orEmpty().trim().uppercase().ifEmpty { "GOOGLE_PLAY" }
require(storeChannel in setOf("GOOGLE_PLAY", "SAMSUNG_GALAXY_STORE", "AMAZON_APPSTORE")) {
    "BLAISE_STORE_CHANNEL must be GOOGLE_PLAY, SAMSUNG_GALAXY_STORE or AMAZON_APPSTORE"
}

android {
    namespace = "br.com.blaise.rj"
    compileSdk = 35
    buildToolsVersion = "35.0.0"
    defaultConfig {
        applicationId = "br.com.blaise.rj"
        minSdk = 26
        targetSdk = 35
        versionCode = 6000001
        versionName = "6.0.0-rc.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "BLAISE_MONTHLY_PRODUCT_ID", buildConfigString(monthlyProductId))
        buildConfigField("String", "BLAISE_ANNUAL_PRODUCT_ID", buildConfigString(annualProductId))
        buildConfigField("String", "BLAISE_ENTITLEMENT_VERIFY_URL", buildConfigString(entitlementVerifyUrl))
        buildConfigField("String", "BLAISE_FIREBASE_APPLICATION_ID", buildConfigString(firebaseApplicationId))
        buildConfigField("String", "BLAISE_FIREBASE_API_KEY", buildConfigString(firebaseApiKey))
        buildConfigField("String", "BLAISE_FIREBASE_PROJECT_ID", buildConfigString(firebaseProjectId))
        buildConfigField("String", "BLAISE_FIREBASE_SENDER_ID", buildConfigString(firebaseSenderId))
        buildConfigField("String", "BLAISE_STORE_CHANNEL", buildConfigString(storeChannel))
        buildConfigField("Boolean", "BLAISE_SUBSCRIBER_AUTH_ENABLED", subscriberAuthFlag)
    }
    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
        release {
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/dora/assets"))
    androidResources.noCompress += listOf("onnx", "bin")
    packaging.resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    testOptions.unitTests.isIncludeAndroidResources = true
}
tasks.named("preBuild") { dependsOn(prepareDoraVoice) }
dependencies {
    implementation(doraRuntime)
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.play.billing)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.auth)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
