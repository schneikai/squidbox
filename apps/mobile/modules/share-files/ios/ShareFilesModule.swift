import ExpoModulesCore
import UIKit

// Opens the iOS share sheet for several local files at once (expo-sharing shares one).
public final class ShareFilesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShareFiles")

    // Resolves when the sheet is dismissed, whatever was picked.
    AsyncFunction("shareAsync") { (urls: [URL], promise: Promise) in
      for url in urls {
        guard url.isFileURL, FileManager.default.isReadableFile(atPath: url.path) else {
          throw UnreadableFileException(url.lastPathComponent)
        }
      }
      guard let viewController = appContext?.utilities?.currentViewController() else {
        throw MissingCurrentViewControllerException()
      }

      let activityController = UIActivityViewController(activityItems: urls, applicationActivities: nil)
      // Settles once, at the first call, as expo-sharing resolves on every call (iOS calls it on
      // dismissal, whatever was picked); a later call is ignored.
      var isSettled = false
      activityController.completionWithItemsHandler = { _, _, _, error in
        guard !isSettled else {
          return
        }
        isSettled = true
        if let error {
          promise.reject(error)
        } else {
          promise.resolve(nil)
        }
      }

      // Popovers are a regular-width behavior, not an iPad one.
      if viewController.traitCollection.horizontalSizeClass == .regular {
        let frame = viewController.view.frame
        SceneGeometry.anchorPopover(
          of: activityController,
          to: viewController.view,
          rect: CGRect(x: frame.midX, y: frame.maxY, width: 0, height: 0)
        )
        activityController.modalPresentationStyle = .pageSheet
      }
      viewController.present(activityController, animated: true)
    }
    .runOnQueue(.main)
  }
}

internal final class UnreadableFileException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "\(param) can't be read" }
}

internal final class MissingCurrentViewControllerException: Exception, @unchecked Sendable {
  override var reason: String { "No view controller to present the share sheet from" }
}
