import ExpoModulesCore
import UIKit

// A mention in the text: one character that draws as a chip and carries its contact.
final class MentionAttachment: NSTextAttachment {
  var mentionId: String = ""
  var mentionLabel: String = ""
}

// SPIKE: a UITextView whose mentions are chips inside the text. A chip is an attachment, so it is
// one character: the cursor steps over it and backspace deletes it whole. The view reports its text
// with the mentions' places (onChangeContent), the @… being typed (onMentionQuery), the height its
// text needs (onContentHeight; the JS side sets it) and a tap on a chip (onMentionPress).
public final class MentionInputView: ExpoView, UITextViewDelegate {
  let onChangeContent = EventDispatcher()
  let onMentionQuery = EventDispatcher()
  let onContentHeight = EventDispatcher()
  let onMentionPress = EventDispatcher()

  private let textView = UITextView()
  private let placeholderLabel = UILabel()
  private var font = UIFont.systemFont(ofSize: 17)
  private var textColor = UIColor.label
  private var chipColor = UIColor.secondarySystemFill
  private var reportedHeight: CGFloat = -1
  // The "@…" before the cursor, when one is being typed.
  private var queryRange: NSRange?
  private var reportedQuery: String?

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
    textView.addGestureRecognizer(tap)

    applyTypingAttributes()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    placeholderLabel.frame = CGRect(x: 0, y: 0, width: bounds.width, height: ceil(font.lineHeight))
    reportHeight()
  }

  // MARK: - Props

  func setPlaceholder(_ placeholder: String) {
    placeholderLabel.text = placeholder
  }

  func setFontSize(_ size: CGFloat) {
    font = UIFont.systemFont(ofSize: size)
    textView.font = font
    placeholderLabel.font = font
    applyTypingAttributes()
    setNeedsLayout()
  }

  func setTextColor(_ color: UIColor) {
    textColor = color
    textView.textColor = color
    applyTypingAttributes()
  }

  func setPlaceholderColor(_ color: UIColor) {
    placeholderLabel.textColor = color
  }

  func setChipColor(_ color: UIColor) {
    chipColor = color
  }

  // MARK: - Functions

  func focusInput() {
    textView.becomeFirstResponder()
  }

  func insertMention(id: String, label: String, avatarUri: String?) {
    let range = queryRange ?? textView.selectedRange
    let storage = textView.textStorage
    guard range.location + range.length <= storage.length else {
      return
    }

    let attachment = MentionAttachment()
    attachment.mentionId = id
    attachment.mentionLabel = label
    let image = chipImage(label: label, avatar: loadAvatar(avatarUri))
    attachment.image = image
    // On the line: from the descender up, as tall as the line, so the cursor keeps its height.
    attachment.bounds = CGRect(x: 0, y: font.descender, width: image.size.width, height: image.size.height)

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

  public func textViewDidChange(_ textView: UITextView) {
    contentChanged()
  }

  public func textViewDidChangeSelection(_ textView: UITextView) {
    updateQuery()
  }

  // MARK: - Private

  private func typingAttributes() -> [NSAttributedString.Key: Any] {
    return [NSAttributedString.Key.font: font, NSAttributedString.Key.foregroundColor: textColor]
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
    updateQuery()
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
    onChangeContent(["text": storage.string, "mentions": mentions])
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

  // The "@…" that ends at the cursor: an @ at the text's start or after a space, a line break or a
  // chip, with up to 40 characters and no line break or chip after it.
  private func updateQuery() {
    var found: NSRange?
    var query: String?
    let selection = textView.selectedRange
    if textView.markedTextRange == nil && selection.length == 0 {
      let text = textView.textStorage.string as NSString
      let cursor = min(selection.location, text.length)
      var index = cursor - 1
      while index >= 0 && cursor - index <= 41 {
        let character = text.character(at: index)
        if character == 0xFFFC || character == 0x0A {
          break
        }
        if character == 0x40 {
          let isStart = index == 0 || isBoundary(text.character(at: index - 1))
          if isStart {
            found = NSRange(location: index, length: cursor - index)
            query = text.substring(with: NSRange(location: index + 1, length: cursor - index - 1))
          }
          break
        }
        index -= 1
      }
    }
    queryRange = found
    if query != reportedQuery {
      reportedQuery = query
      onMentionQuery(["isActive": query != nil, "query": query ?? ""])
    }
  }

  private func isBoundary(_ character: unichar) -> Bool {
    return character == 0x20 || character == 0x0A || character == 0xFFFC || character == 0xA0
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
    let height = ceil(font.lineHeight)
    let inset: CGFloat = 2
    let avatarSize = height - inset * 2
    let gap: CGFloat = 5
    let trailing: CGFloat = 9
    let labelAttributes: [NSAttributedString.Key: Any] = [
      NSAttributedString.Key.font: UIFont.systemFont(ofSize: font.pointSize - 1),
      NSAttributedString.Key.foregroundColor: textColor
    ]
    let labelSize = (label as NSString).size(withAttributes: labelAttributes)
    let width = ceil(inset + avatarSize + gap + labelSize.width + trailing)
    let size = CGSize(width: width, height: height)
    let fill = chipColor

    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { context in
      fill.setFill()
      UIBezierPath(roundedRect: CGRect(origin: CGPoint.zero, size: size), cornerRadius: height / 2).fill()

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
        at: CGPoint(x: avatarRect.maxX + gap, y: (height - labelSize.height) / 2),
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
