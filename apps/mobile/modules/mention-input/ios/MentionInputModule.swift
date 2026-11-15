import ExpoModulesCore
import UIKit

// SPIKE: a multiline text field that holds mentions as chips inside its text (MentionInputView).
public final class MentionInputModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MentionInput")

    View(MentionInputView.self) {
      Events("onChangeContent", "onMentionQuery", "onContentHeight", "onMentionPress")

      Prop("placeholder") { (view, placeholder: String?) in
        view.setPlaceholder(placeholder ?? "")
      }

      Prop("fontSize") { (view, fontSize: Double?) in
        view.setFontSize(CGFloat(fontSize ?? 17))
      }

      Prop("lineHeight") { (view, lineHeight: Double?) in
        view.setLineHeight(CGFloat(lineHeight ?? 0))
      }

      Prop("textColor") { (view, color: UIColor?) in
        view.setTextColor(color ?? UIColor.label)
      }

      Prop("placeholderColor") { (view, color: UIColor?) in
        view.setPlaceholderColor(color ?? UIColor.placeholderText)
      }

      Prop("chipColor") { (view, color: UIColor?) in
        view.setChipColor(color ?? UIColor.secondarySystemFill)
      }

      Prop("chipStyle") { (view, style: [String: Double]?) in
        view.setChipStyle(style ?? [:])
      }

      // Puts the contact's chip where the @… being typed is (else at the cursor).
      AsyncFunction("insertMention") { (view: MentionInputView, id: String, label: String, avatarUri: String?) in
        view.insertMention(id: id, label: label, avatarUri: avatarUri)
      }

      AsyncFunction("focus") { (view: MentionInputView) in
        view.focusInput()
      }
    }
  }
}
