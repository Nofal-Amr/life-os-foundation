import AuthenticationServices
import UIKit

/// Google (and other providers) through the system's sign-in sheet. It
/// finishes at lifeos://auth-callback, the same address the Android app uses,
/// and hands that URL back so the site's /auth page can complete the session.
final class SignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
  private var session: ASWebAuthenticationSession?

  /// The callback URL, or nil if the person closed the sheet.
  func start(_ url: URL) async -> URL? {
    // Ask Supabase to come back to the app rather than the website.
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    var items = (components?.queryItems ?? []).filter { $0.name != "redirect_to" }
    items.append(URLQueryItem(name: "redirect_to", value: "lifeos://auth-callback"))
    components?.queryItems = items
    let authorize = components?.url ?? url

    return await withCheckedContinuation { continuation in
      // The scheme-string form works back to iOS 17.0 (the newer
      // `callback:` form needs 17.4).
      let session = ASWebAuthenticationSession(
        url: authorize,
        callbackURLScheme: "lifeos"
      ) { callback, _ in
        continuation.resume(returning: callback)
      }
      session.presentationContextProvider = self
      session.prefersEphemeralWebBrowserSession = false
      self.session = session
      if !session.start() {
        self.session = nil
        continuation.resume(returning: nil)
      }
    }
  }

  nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    MainActor.assumeIsolated {
      UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
  }
}
