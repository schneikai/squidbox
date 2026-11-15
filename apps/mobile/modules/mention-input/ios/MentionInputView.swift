import ExpoModulesCore
import UIKit

// A mention in the text: one character that draws as a chip and carries its contact.
final class MentionAttachment: NSTextAttachment {
  var mentionId: String = ""
  var mentionLabel: String = ""
  var avatar: UIImage?
}

// A UITextView whose mentions are chips inside the text. A chip is an attachment, so it is one
// character: the cursor steps over it and backspace deletes it whole. The view reports its text with
// the mentions' places and the selection (onChangeContent), the selection alone (onSelectionChange),
// focus (onFocusChange), the height its text needs (onContentHeight; the JS side sets it) and a tap
// on a chip (onMentionPress). Which @… is being typed is the JS side's to decide (mentionAt).
public final class MentionInputView: ExpoView, UITextViewDelegate, UIGestureRecognizerDelegate {
  let onChangeContent = EventDispatcher()
  let onSelectionChange = EventDispatcher()
  let onFocusChange = EventDispatcher()
  let onContentHeight = EventDispatcher()
  let onMentionPress = EventDispatcher()

  private let textView = UITextView()
  private let placeholderLabel = UILabel()
  private var font = UIFont.systemFont(ofSize: 17)
  private var fontSize: CGFloat = 17
  // The line's height as the app sets it (0: the font's own), before the text size setting.
  private var lineHeight: CGFloat = 0
  private var textColor = UIColor.label
  private var chipColor = UIColor.secondarySystemFill
  // The chip's measures, set by the app so its look changes without a build: height (0: the
  // font's line), avatarInset (around the avatar), labelGap (avatar to label), trailing (after the label),
  // offsetY (up from centered), labelSize (0: the text's), radius (under 0: a pill).
  private var chipStyle: [String: Double] = [:]
  private var reportedHeight: CGFloat = -1
  // Set while the user's edit is being applied: its selection goes out with the text (onChangeContent).
  private var isChangingText = false

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    textView.delegate = self
    textView.backgroundColor = UIColor.clear
    textView.isScrollEnabled = false
    textView.textContainerInset = UIEdgeInsets.zero
    textView.textContainer.lineFragmentPadding = 0
    textView.font = font
    textView.textColor = textColor
    addSubview(textView)

    placeholderLabel.font = font
    placeholderLabel.textColor = UIColor.placeholderText
    placeholderLabel.isUserInteractionEnabled = false
    addSubview(placeholderLabel)

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    tap.cancelsTouchesInView = false
    // Beside the text view's own taps (focus, placing the cursor), never in their place.
    tap.delegate = self
    textView.addGestureRecognizer(tap)

    applyTypingAttributes()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    placeholderLabel.frame = CGRect(x: 0, y: 0, width: bounds.width, height: ceil(lineBox()))
    reportHeight()
  }

  // MARK: - Props

  func setPlaceholder(_ placeholder: String) {
    placeholderLabel.text = placeholder
  }

  func setFontSize(_ size: CGFloat) {
    fontSize = size
    applyFont()
  }

  func setLineHeight(_ height: CGFloat) {
    lineHeight = height
    applyFont()
  }

  // The size grows with the phone's text size setting, by the factors React Native's own texts
  // use, so the field matches the inputs around it.
  private func applyFont() {
    font = UIFont.systemFont(ofSize: fontSize * textSizeFactor())
    textView.font = font
    placeholderLabel.font = font
    applyTypingAttributes()
    redrawChips()
    setNeedsLayout()
  }

  func setChipStyle(_ style: [String: Double]) {
    chipStyle = style
    redrawChips()
  }

  private func chipValue(_ key: String, _ fallback: CGFloat) -> CGFloat {
    if let value = chipStyle[key] {
      return CGFloat(value)
    }
    return fallback
  }

  private func draw(_ attachment: MentionAttachment) {
    let image = chipImage(label: attachment.mentionLabel, avatar: attachment.avatar)
    attachment.image = image
    // Its middle on the middle of the capitals, so it sits centered on the text beside it.
    attachment.bounds = CGRect(x: 0, y: chipOffset(image.size.height), width: image.size.width, height: image.size.height)
  }

  // Every chip again, after its look changed.
  private func redrawChips() {
    let storage = textView.textStorage
    let whole = NSRange(location: 0, length: storage.length)
    guard whole.length > 0 else {
      return
    }
    var ranges: [NSRange] = []
    storage.enumerateAttribute(NSAttributedString.Key.attachment, in: whole, options: []) { value, range, _ in
      if let attachment = value as? MentionAttachment {
        self.draw(attachment)
        ranges.append(range)
      }
    }
    // Tells the text its chips changed, so it lays them out and draws them again.
    storage.beginEditing()
    for range in ranges {
      storage.edited(NSTextStorage.EditActions.editedAttributes, range: range, changeInLength: 0)
    }
    storage.endEditing()
    reportHeight()
  }

  private func textSizeFactor() -> CGFloat {
    switch UIApplication.shared.preferredContentSizeCategory {
    case UIContentSizeCategory.extraSmall: return 0.823
    case UIContentSizeCategory.small: return 0.882
    case UIContentSizeCategory.medium: return 0.941
    case UIContentSizeCategory.extraLarge: return 1.118
    case UIContentSizeCategory.extraExtraLarge: return 1.235
    case UIContentSizeCategory.extraExtraExtraLarge: return 1.353
    case UIContentSizeCategory.accessibilityMedium: return 1.786
    case UIContentSizeCategory.accessibilityLarge: return 2.143
    case UIContentSizeCategory.accessibilityExtraLarge: return 2.643
    case UIContentSizeCategory.accessibilityExtraExtraLarge: return 3.143
    case UIContentSizeCategory.accessibilityExtraExtraExtraLarge: return 3.571
    default: return 1
    }
  }

  // A line's height: the app's line height with the text size setting, never under the font's own.
  private func lineBox() -> CGFloat {
    return max(lineHeight * textSizeFactor(), font.lineHeight)
  }

  func setTextColor(_ color: UIColor) {
    textColor = color
    textView.textColor = color
    applyTypingAttributes()
    redrawChips()
  }

  func setPlaceholderColor(_ color: UIColor) {
    placeholderLabel.textColor = color
  }

  func setChipColor(_ color: UIColor) {
    chipColor = color
    redrawChips()
  }

  // MARK: - Functions

  func focusInput() {
    textView.becomeFirstResponder()
  }

  // The text and its chips, as the app holds them: each chip one U+FFFC at its location. The cursor
  // goes to the end. Not reported back: the app knows what it set.
  func setContent(text: String, mentions: [MentionRecord]) {
    let attributes = typingAttributes()
    let content = NSMutableAttributedString(string: text, attributes: attributes)
    let characters = content.string as NSString
    for mention in mentions {
      guard mention.location >= 0, mention.location < characters.length,
        characters.character(at: mention.location) == 0xFFFC
      else {
        continue
      }
      let attachment = makeAttachment(id: mention.id, label: mention.label, avatarUri: mention.avatarUri)
      content.addAttribute(
        NSAttributedString.Key.attachment,
        value: attachment,
        range: NSRange(location: mention.location, length: 1)
      )
    }
    textView.textStorage.setAttributedString(content)
    textView.selectedRange = NSRange(location: content.length, length: 0)
    applyTypingAttributes()
    placeholderLabel.isHidden = content.length > 0
    reportHeight()
  }

  func insertMention(id: String, label: String, avatarUri: String?, start: Int, end: Int) {
    let storage = textView.textStorage
    guard start >= 0, start <= end, end <= storage.length else {
      return
    }
    let range = NSRange(location: start, length: end - start)
    let attachment = makeAttachment(id: id, label: label, avatarUri: avatarUri)

    let attributes = typingAttributes()
    let inserted = NSMutableAttributedString(attachment: attachment)
    inserted.addAttributes(attributes, range: NSRange(location: 0, length: inserted.length))
    inserted.append(NSAttributedString(string: " ", attributes: attributes))

    storage.replaceCharacters(in: range, with: inserted)
    textView.selectedRange = NSRange(location: range.location + inserted.length, length: 0)
    applyTypingAttributes()
    contentChanged()
  }

  // MARK: - UITextViewDelegate

  public func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
    isChangingText = true
    // An edit UIKit then drops reports no change: clear it after this turn either way.
    DispatchQueue.main.async { [weak self] in self?.isChangingText = false }
    return true
  }

  public func textViewDidChange(_ textView: UITextView) {
    isChangingText = false
    contentChanged()
  }

  public func textViewDidChangeSelection(_ textView: UITextView) {
    // Not while dictation, autocorrect or an input method is composing, nor for an edit's own move.
    guard textView.markedTextRange == nil, !isChangingText else {
      return
    }
    onSelectionChange(selection())
  }

  public func textViewDidBeginEditing(_ textView: UITextView) {
    onFocusChange(["isFocused": true])
  }

  public func textViewDidEndEditing(_ textView: UITextView) {
    onFocusChange(["isFocused": false])
  }

  // MARK: - UIGestureRecognizerDelegate

  public func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    return true
  }

  // MARK: - Private

  private func makeAttachment(id: String, label: String, avatarUri: String?) -> MentionAttachment {
    let attachment = MentionAttachment()
    attachment.mentionId = id
    attachment.mentionLabel = label
    attachment.avatar = loadAvatar(avatarUri)
    draw(attachment)
    return attachment
  }

  private func selection() -> [String: Any] {
    let range = textView.selectedRange
    return ["start": range.location, "end": range.location + range.length]
  }

  private func typingAttributes() -> [NSAttributedString.Key: Any] {
    let box = lineBox()
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = box
    paragraph.maximumLineHeight = box
    return [
      NSAttributedString.Key.font: font,
      NSAttributedString.Key.foregroundColor: textColor,
      NSAttributedString.Key.paragraphStyle: paragraph,
      // A taller line puts its text at the bottom: lift it to the middle, as React Native does.
      NSAttributedString.Key.baselineOffset: (box - font.lineHeight) / 2
    ]
  }

  // How far under the baseline the chip starts.
  private func chipOffset(_ height: CGFloat) -> CGFloat {
    return (font.capHeight - height) / 2 + chipValue("offsetY", 0)
  }

  // Text typed after a chip must not take the attachment's attributes.
  private func applyTypingAttributes() {
    textView.typingAttributes = typingAttributes()
  }

  private func contentChanged() {
    placeholderLabel.isHidden = textView.textStorage.length > 0
    // Not while dictation, autocorrect or an input method is composing.
    if textView.markedTextRange == nil {
      applyTypingAttributes()
    }
    reportContent()
    reportHeight()
  }

  private func reportContent() {
    let storage = textView.textStorage
    var mentions: [[String: Any]] = []
    storage.enumerateAttribute(
      NSAttributedString.Key.attachment,
      in: NSRange(location: 0, length: storage.length),
      options: []
    ) { value, range, _ in
      if let mention = value as? MentionAttachment {
        mentions.append(["id": mention.mentionId, "label": mention.mentionLabel, "location": range.location])
      }
    }
    var content = selection()
    content["text"] = storage.string
    content["mentions"] = mentions
    onChangeContent(content)
  }

  private func reportHeight() {
    guard bounds.width > 0 else {
      return
    }
    let fitting = textView.sizeThatFits(CGSize(width: bounds.width, height: CGFloat.greatestFiniteMagnitude))
    let height = ceil(fitting.height)
    if abs(height - reportedHeight) > 0.5 {
      reportedHeight = height
      onContentHeight(["height": Double(height)])
    }
  }

  private func loadAvatar(_ uri: String?) -> UIImage? {
    guard let uri = uri else {
      return nil
    }
    if let url = URL(string: uri), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    return UIImage(contentsOfFile: uri)
  }

  // The chip as a picture: a pill as tall as a line, the round avatar (a plain disc without a
  // photo), then the label.
  private func chipImage(label: String, avatar: UIImage?) -> UIImage {
    let setHeight = chipValue("height", 0)
    let height = setHeight > 0 ? setHeight : ceil(font.lineHeight)
    let inset = chipValue("avatarInset", 2)
    let avatarSize = max(height - inset * 2, 0)
    let gap = chipValue("labelGap", 5)
    let trailing = chipValue("trailing", 9)
    let setLabelSize = chipValue("labelSize", 0)
    let labelFont = setLabelSize > 0 ? UIFont.systemFont(ofSize: setLabelSize * textSizeFactor()) : font
    let setRadius = chipValue("radius", -1)
    let radius = setRadius >= 0 ? setRadius : height / 2
    let labelAttributes: [NSAttributedString.Key: Any] = [
      NSAttributedString.Key.font: labelFont,
      NSAttributedString.Key.foregroundColor: textColor
    ]
    let labelSize = (label as NSString).size(withAttributes: labelAttributes)
    let width = ceil(inset + avatarSize + gap + labelSize.width + trailing)
    let size = CGSize(width: width, height: height)
    let fill = chipColor

    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { context in
      fill.setFill()
      UIBezierPath(roundedRect: CGRect(origin: CGPoint.zero, size: size), cornerRadius: radius).fill()

      let avatarRect = CGRect(x: inset, y: inset, width: avatarSize, height: avatarSize)
      context.cgContext.saveGState()
      UIBezierPath(ovalIn: avatarRect).addClip()
      if let avatar = avatar, avatar.size.width > 0, avatar.size.height > 0 {
        // Fills the disc, cropped around its middle.
        let scale = max(avatarSize / avatar.size.width, avatarSize / avatar.size.height)
        let drawn = CGSize(width: avatar.size.width * scale, height: avatar.size.height * scale)
        avatar.draw(in: CGRect(
          x: avatarRect.midX - drawn.width / 2,
          y: avatarRect.midY - drawn.height / 2,
          width: drawn.width,
          height: drawn.height
        ))
      } else {
        UIColor.systemGray3.setFill()
        UIRectFill(avatarRect)
      }
      context.cgContext.restoreGState()

      (label as NSString).draw(
        // On the baseline of the text beside the chip.
        at: CGPoint(x: avatarRect.maxX + gap, y: height + chipOffset(height) - labelFont.ascender),
        withAttributes: labelAttributes
      )
    }
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    let point = gesture.location(in: textView)
    guard let position = textView.closestPosition(to: point) else {
      return
    }
    let offset = textView.offset(from: textView.beginningOfDocument, to: position)
    let storage = textView.textStorage
    // The chip is the character before or after the nearest cursor place.
    for index in [offset, offset - 1] {
      guard index >= 0 && index < storage.length else {
        continue
      }
      guard
        let mention = storage.attribute(NSAttributedString.Key.attachment, at: index, effectiveRange: nil)
          as? MentionAttachment,
        let start = textView.position(from: textView.beginningOfDocument, offset: index),
        let end = textView.position(from: start, offset: 1),
        let range = textView.textRange(from: start, to: end)
      else {
        continue
      }
      if textView.firstRect(for: range).insetBy(dx: -4, dy: -4).contains(point) {
        onMentionPress(["id": mention.mentionId])
        return
      }
    }
  }
}
