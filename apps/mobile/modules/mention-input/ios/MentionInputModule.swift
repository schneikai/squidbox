import ExpoModulesCore
import UIKit

// A chip setContent puts in the text: its contact, its label, its place (one U+FFFC) and avatar.
struct MentionRecord: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var location: Int = 0
  @Field var avatarUri: String? = nil
}

// A multiline text field that holds mentions as chips inside its text (MentionInputView).
public final class MentionInputModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MentionInput")

    View(MentionInputView.self) {
      Events("onChangeContent", "onSelectionChange", "onFocusChange", "onContentHeight", "onMentionPress")

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

      // The chips of these contacts get the warning fill: no handle on the channel the text is for.
      Prop("missingHandleIds") { (view, ids: [String]?) in
        view.setMissingHandleIds(Set(ids ?? []))
      }

      Prop("warningChipColor") { (view, color: UIColor?) in
        view.setWarningChipColor(color ?? UIColor.systemYellow.withAlphaComponent(0.25))
      }

      Prop("chipStyle") { (view, style: [String: Double]?) in
        view.setChipStyle(style ?? [:])
      }

      // Replaces the text and its chips; reports the height, never the content.
      AsyncFunction("setContent") { (view: MentionInputView, text: String, mentions: [MentionRecord]) in
        view.setContent(text: text, mentions: mentions)
      }

      // Puts the contact's chip in place of the text from start to end (the @… being typed).
      AsyncFunction("insertMention") {
        (view: MentionInputView, id: String, label: String, avatarUri: String?, start: Int, end: Int) in
        view.insertMention(id: id, label: label, avatarUri: avatarUri, start: start, end: end)
      }

      AsyncFunction("focus") { (view: MentionInputView) in
        view.focusInput()
      }
    }
  }
}
