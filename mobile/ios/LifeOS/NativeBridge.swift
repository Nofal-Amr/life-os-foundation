import UIKit
import UserNotifications
import WebKit

/// The iPhone side of `window.LifeOSNative`, the same bridge the Android app
/// offers, so the web app needs no iPhone-specific code. JavaScript posts
/// messages; the few answers it needs synchronously (can it notify?) are kept
/// in `window.__lifeOSiOS` and refreshed from here.
final class NativeBridge: NSObject, WKScriptMessageHandler {
  static let channel = "lifeos"

  weak var webView: WKWebView?

  /// Injected before the page's own scripts run.
  static let shim = """
    (() => {
      const post = (method, args) =>
        window.webkit?.messageHandlers?.\(channel)?.postMessage({ method, args: args ?? {} });
      const state = (window.__lifeOSiOS = window.__lifeOSiOS || { canNotify: false });
      window.LifeOSNative = {
        canNotify: () => state.canNotify,
        requestNotifications: () => post("requestNotifications"),
        scheduleReminders: (json) => post("scheduleReminders", { json }),
        saveFile: (name, base64, mime) => {
          post("saveFile", { name, base64, mime });
          return "the share sheet";
        },
        showTimer: () => {},
        systemAccent: () => "",
      };
      post("hello");
    })();
    """

  func userContentController(
    _ controller: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    // Only the Life OS site's own page may use the bridge.
    guard message.frameInfo.isMainFrame,
          message.frameInfo.securityOrigin.host == Shell.site.host(),
          let body = message.body as? [String: Any],
          let method = body["method"] as? String
    else { return }
    let args = body["args"] as? [String: Any] ?? [:]

    switch method {
    case "hello":
      Task { await publishNotificationState() }
    case "requestNotifications":
      Task {
        _ = try? await UNUserNotificationCenter.current()
          .requestAuthorization(options: [.alert, .sound, .badge])
        await publishNotificationState()
      }
    case "scheduleReminders":
      if let json = args["json"] as? String { Task { await Reminders.replaceAll(json: json) } }
    case "saveFile":
      if let name = args["name"] as? String,
         let base64 = args["base64"] as? String,
         let data = Data(base64Encoded: base64) {
        share(name: name, data: data)
      }
    default:
      break
    }
  }

  private func publishNotificationState() async {
    let settings = await UNUserNotificationCenter.current().notificationSettings()
    let allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
    _ = try? await webView?.evaluateJavaScript("window.__lifeOSiOS.canNotify = \(allowed)")
  }

  /// Exports go through the share sheet, where "Save to Files" is one tap.
  private func share(name: String, data: Data) {
    let safe = name.replacingOccurrences(of: "[^A-Za-z0-9._ -]", with: "_", options: .regularExpression)
    guard data.count <= 20 * 1024 * 1024, !safe.isEmpty else { return }
    let url = FileManager.default.temporaryDirectory.appending(path: safe)
    do {
      try data.write(to: url, options: .atomic)
    } catch {
      return
    }
    guard let presenter = webView?.window?.rootViewController else { return }
    let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
    sheet.popoverPresentationController?.sourceView = webView
    presenter.present(sheet, animated: true)
  }
}
