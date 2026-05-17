# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ── ExoPlayer (react-native-video) ──────────────────────────────────────────
# Required when minifyEnabled = true to prevent ExoPlayer classes from being
# stripped, which would break HLS/DASH/MP4 playback at runtime.
-keep class com.google.android.exoplayer2.** { *; }
-keep interface com.google.android.exoplayer2.** { *; }
-keep class androidx.media3.** { *; }
-keep interface androidx.media3.** { *; }
-dontwarn com.google.android.exoplayer2.**
-dontwarn androidx.media3.**

# ── React Native Video ───────────────────────────────────────────────────────
-keep class com.brentvatne.react.** { *; }
-keep class com.brentvatne.exoplayer.** { *; }

