import SwiftUI
import WebKit

/// The web app in a WKWebView. Only the Life OS site loads inside; every
/// other link opens in Safari, and Google sign-in goes through the system's
/// sign-in sheet (Google doesn't allow it inside web views).
struct WebView: UIViewRepresentable {
  let shell: Shell

  func makeCoordinator() -> Coordinator { Coordinator(shell: shell) }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.limitsNavigationsToAppBoundDomains = true
    configuration.websiteDataStore = .default()
    configuration.allowsInlineMediaPlayback = true
    // Lets the site recognise the iPhone app, as "LifeOSAndroid" does on Android.
    configuration.applicationNameForUserAgent = "LifeOSiOS"

    let bridge = NativeBridge()
    context.coordinator.bridge = bridge
    configuration.userContentController.add(bridge, name: NativeBridge.channel)
    configuration.userContentController.addUserScript(
      WKUserScript(source: NativeBridge.shim, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    )

    let view = WKWebView(frame: .zero, configuration: configuration)
    view.navigationDelegate = context.coordinator
    view.uiDelegate = context.coordinator
    view.allowsBackForwardNavigationGestures = true
    view.isOpaque = false
    view.backgroundColor = .clear
    view.scrollView.contentInsetAdjustmentBehavior = .never
    bridge.webView = view
    return view
  }

  func updateUIView(_ view: WKWebView, context: Context) {
    guard let url = shell.pending else { return }
    shell.pending = nil
    view.load(URLRequest(url: url))
  }

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    let shell: Shell
    var bridge: NativeBridge?
    private let signIn = SignIn()

    init(shell: Shell) { self.shell = shell }

    func webView(
      _ webView: WKWebView,
      decidePolicyFor action: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
      guard let url = action.request.url else { return .cancel }
      if url.host() == Shell.site.host() { return .allow }

      // Supabase's Google sign-in: run it in the system sheet, then hand the
      // session back to the site's /auth page, as the Android app does.
      if url.host()?.hasSuffix(".supabase.co") == true, url.path().contains("/auth/v1/authorize") {
        if let callback = await signIn.start(url) { shell.open(authCallback(callback)) }
        return .cancel
      }
      if url.scheme == "lifeos" {
        shell.open(url)
        return .cancel
      }
      // Anything else (links out, mail, phone) belongs in the system apps.
      await UIApplication.shared.open(url)
      return .cancel
    }

    /// lifeos://auth-callback?code=…#access_token=… → the site's /auth page.
    private func authCallback(_ callback: URL) -> URL {
      var components = URLComponents(url: Shell.site.appending(path: "auth"), resolvingAgainstBaseURL: false)!
      let incoming = URLComponents(url: callback, resolvingAgainstBaseURL: false)
      components.queryItems = (incoming?.queryItems ?? []) + [URLQueryItem(name: "return", value: UUID().uuidString)]
      components.fragment = incoming?.fragment
      return components.url ?? Shell.site
    }

    /// `window.open` / target=_blank: keep site pages here, send the rest out.
    func webView(
      _ webView: WKWebView,
      createWebViewWith configuration: WKWebViewConfiguration,
      for action: WKNavigationAction,
      windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
      if let url = action.request.url {
        if url.host() == Shell.site.host() { webView.load(action.request) } else { UIApplication.shared.open(url) }
      }
      return nil
    }
  }
}
