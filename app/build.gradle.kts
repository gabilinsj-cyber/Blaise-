plugins { alias(libs.plugins.android.application); alias(libs.plugins.kotlin.android); alias(libs.plugins.kotlin.compose) }

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
    packaging.resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    testOptions.unitTests.isIncludeAndroidResources = true
}
dependencies {
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
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
