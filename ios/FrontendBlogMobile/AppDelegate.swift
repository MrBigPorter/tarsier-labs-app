import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AVFoundation
import CodePush

/// URLs to ignore for deep linking (handled by other means, e.g. OAuth)
private let ignoredPaths = Set([
    "/oauth/callback",
])

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // ── Configure AVAudioSession for video/audio playback ────────────
    // This is REQUIRED for iOS AVPlayer (used by react-native-video) to
    // properly initialize the audio/video rendering pipeline.
    // Without this, CoreMediaErrorDomain -12642 can occur on HLS playback.
    do {
      try AVAudioSession.sharedInstance().setCategory(
        .playback,
        mode: .moviePlayback,
        options: [.allowAirPlay, .allowBluetooth]
      )
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      print("[AppDelegate] Failed to configure AVAudioSession: \(error)")
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "FrontendBlogMobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // MARK: - Universal Links

  /// Handle Universal Link (applinks:tarsier.app) — open article in app
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let incomingURL = userActivity.webpageURL
    else {
      return false
    }

    // Ignore OAuth callback URLs — those are handled by ASAuthSession
    if ignoredPaths.contains(incomingURL.path) {
      return false
    }

    // Pass the URL to React Native's linking system
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    CodePush.bundleURL()
#endif
  }
}
