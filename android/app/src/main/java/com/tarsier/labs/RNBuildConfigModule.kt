package com.tarsier.labs

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class RNBuildConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "RNBuildConfig"

    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "FLAVOR" to BuildConfig.FLAVOR,
            "DEBUG" to BuildConfig.DEBUG,
            "VERSION_NAME" to BuildConfig.VERSION_NAME,
            "VERSION_CODE" to BuildConfig.VERSION_CODE
        )
    }
}
