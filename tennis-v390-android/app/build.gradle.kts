plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

val signingStoreFile = System.getenv("BLAISE_SIGNING_STORE_FILE")
val signingStorePassword = System.getenv("BLAISE_SIGNING_STORE_PASSWORD")
val signingKeyAlias = System.getenv("BLAISE_SIGNING_KEY_ALIAS")
val signingKeyPassword = System.getenv("BLAISE_SIGNING_KEY_PASSWORD")
val hasExternalReleaseSigning = listOf(
    signingStoreFile,
    signingStorePassword,
    signingKeyAlias,
    signingKeyPassword
).all { !it.isNullOrBlank() }

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
    compileOptions {
        sourceCompatibility=JavaVersion.VERSION_17
        targetCompatibility=JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget="17"
    }
    signingConfigs {
        if (hasExternalReleaseSigning) {
            create("releaseExternal") {
                storeFile=file(signingStoreFile!!)
                storePassword=signingStorePassword
                keyAlias=signingKeyAlias
                keyPassword=signingKeyPassword
                enableV1Signing=true
                enableV2Signing=true
                enableV3Signing=true
                enableV4Signing=true
            }
        }
    }
    buildTypes {
        debug { isMinifyEnabled=false }
        release {
            isMinifyEnabled=true
            isShrinkResources=true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"),"proguard-rules.pro")
            if (hasExternalReleaseSigning) {
                signingConfig=signingConfigs.getByName("releaseExternal")
            }
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
