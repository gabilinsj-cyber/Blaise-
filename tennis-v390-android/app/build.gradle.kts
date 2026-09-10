plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace="com.blaise.opentennis"
    compileSdk=35
    defaultConfig {
        applicationId="com.blaise.opentennis"
        minSdk=26
        targetSdk=35
        versionCode=390
        versionName="3.9.0"
    }
    buildTypes {
        debug { isMinifyEnabled=false }
        release {
            isMinifyEnabled=true
            isShrinkResources=true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"),"proguard-rules.pro")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
