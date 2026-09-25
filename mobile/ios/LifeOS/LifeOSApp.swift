import SwiftUI
import UserNotifications

/// The Life OS iPhone app: the live web app in a native shell, with the
/// phone-only pieces (notifications, sign-in, saving files) done natively.
@main
struct LifeOSApp: App {
  @UIApplicationDelegateAdaptor private var delegate: AppDelegate
  @State private var shell = Shell()

  var body: some Scene {
    WindowGroup {
      WebView(shell: shell)
        .ignoresSafeArea(.container, edges: .bottom)
        .background(Color("LaunchBackground"))
        .onOpenURL { url in shell.open(url) }
    }
  }
}

/// Where tapped notifications and `lifeos://open/<path>` links send the web view.
@Observable
final class Shell {
  static let site = URL(string: "https://lifeos0.vercel.app")!

  /// The page the web view should show next; the view clears it once loaded.
  var pending: URL? = Shell.site.appending(path: "dashboard")

  func open(_ url: URL) {
    if url.scheme == "lifeos", url.host() == "open" {
      pending = Shell.site.appending(path: String(url.path().drop(while: { $0 == "/" })))
    } else if url.scheme == "https", url.host() == Shell.site.host() {
      pending = url
    }
  }

  /// A path inside the app, e.g. "/spirit" from a prayer reminder.
  func open(path: String) {
    pending = Shell.site.appending(path: String(path.drop(while: { $0 == "/" })))
  }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    return true
  }

  /// Show reminders even while the app is open.
  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .sound, .list]
  }

  /// Tapping a reminder opens the page it points at.
  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    let path = response.notification.request.content.userInfo["path"] as? String ?? "/dashboard"
    await MainActor.run {
      if let url = URL(string: "lifeos://open\(path)") {
        UIApplication.shared.open(url)
      }
    }
  }
}
