import AuthenticationServices
import React
import UIKit

/// React Native native module wrapping ASWebAuthenticationSession.
/// Provides an in-app browser overlay for OAuth flows without leaving the app.
/// Uses iOS system framework AuthenticationServices (iOS 12+), no third-party dependencies.
@objc(ASAuthSession)
class ASAuthSession: RCTEventEmitter, ASWebAuthenticationPresentationContextProviding {

  private var session: ASWebAuthenticationSession?
  private var resolveBlock: RCTPromiseResolveBlock?
  private var rejectBlock: RCTPromiseRejectBlock?

  /// Start an authentication session.
  /// - Parameters:
  ///   - url: The authorization URL to open (e.g. backend OAuth initiation URL)
  ///   - callbackUrlScheme: The custom URL scheme for the callback (e.g. "tarsier")
  ///   - prefersEphemeralSession: Whether to use an ephemeral session (no shared cookies)
  ///   - resolve: Promise resolve block
  ///   - reject: Promise reject block
  @objc
  func startAuth(
    _ url: String,
    callbackUrlScheme: String,
    prefersEphemeralSession: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let authURL = URL(string: url) else {
      reject("INVALID_URL", "Invalid authorization URL", nil)
      return
    }

    self.resolveBlock = resolve
    self.rejectBlock = reject

    session = ASWebAuthenticationSession(
      url: authURL,
      callbackURLScheme: callbackUrlScheme,
      completionHandler: { [weak self] callbackURL, error in
        guard let self = self else { return }

        if let error = error as? ASWebAuthenticationSessionError {
          switch error.code {
          case .canceledLogin:
            self.rejectBlock?("CANCELLED", "User cancelled login", nil)
          default:
            self.rejectBlock?("AUTH_ERROR", error.localizedDescription, error)
          }
          return
        }

        if let callbackURL = callbackURL {
          self.resolveBlock?(callbackURL.absoluteString)
        } else {
          self.rejectBlock?("NO_CALLBACK", "No callback URL received", nil)
        }
      }
    )

    session?.prefersEphemeralWebBrowserSession = prefersEphemeralSession

    // REQUIRED on iOS 13+: provide a presentation context so iOS knows which
    // window to present the authentication UI from. Without this, the session
    // fails immediately with error code 2 (presentationContextNotProvided).
    session?.presentationContextProvider = self

    // Ensure the session runs on the main thread
    DispatchQueue.main.async { [weak self] in
      self?.session?.start()
    }
  }

  /// ASWebAuthenticationPresentationContextProviding — returns the key window
  /// to present the authentication UI from.
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    // Find the active window scene's key window
    if let windowScene = UIApplication.shared.connectedScenes
      .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
      let window = windowScene.windows.first(where: { $0.isKeyWindow })
    {
      return window
    }
    // Fallback (should never happen on iOS 13+)
    return UIWindow()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return []
  }
}
