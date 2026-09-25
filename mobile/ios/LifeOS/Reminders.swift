import Foundation
import UserNotifications

/// Local notifications from the web app's reminder list (prayers, tasks,
/// your own reminders). Each call replaces what was scheduled before, like
/// the Android app. iOS keeps at most 64 pending, so the soonest 60 are used.
enum Reminders {
  private static let prefix = "lifeos-"

  struct Item: Decodable {
    let id: String
    /// Epoch milliseconds.
    let at: Double
    let title: String
    let body: String
    let path: String
  }

  static func replaceAll(json: String) async {
    let center = UNUserNotificationCenter.current()
    guard let data = json.data(using: .utf8),
          let items = try? JSONDecoder().decode([Item].self, from: data)
    else { return }

    let pending = await center.pendingNotificationRequests()
    center.removePendingNotificationRequests(
      withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
    )

    let now = Date()
    let upcoming = items
      .map { (item: $0, date: Date(timeIntervalSince1970: $0.at / 1000)) }
      .filter { $0.date > now }
      .sorted { $0.date < $1.date }
      .prefix(60)

    for (item, date) in upcoming {
      let content = UNMutableNotificationContent()
      content.title = item.title
      content.body = item.body
      content.sound = .default
      content.userInfo = ["path": item.path]
      let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
      let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
      try? await center.add(UNNotificationRequest(identifier: prefix + item.id, content: content, trigger: trigger))
    }
  }
}
