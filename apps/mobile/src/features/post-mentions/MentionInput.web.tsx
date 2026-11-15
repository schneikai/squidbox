// The mention field in a browser, a stand-in for the native iOS view (MentionInput.tsx) with the same
// props and ref: a contentEditable div whose chips are non-editable spans. Its DOM is the app's to
// draw (React renders the div, never its children): text nodes, chips and line breaks, read back by
// walking them, each chip one MENTION_CHIP. Enter and paste put plain text in, so the browser adds
// no blocks of its own.
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

// Type-only, so Babel erases it and Metro never follows it into the native view on web.
import type { MentionInputProps } from './MentionInput';
import { MENTION_CHIP, type FieldContent, type FieldMention } from './fieldContent';
import { mentionChipBox } from './mentionChipStyle';

import { colors, textStyles } from '@/styles/designTokens';

const CHIP = 'mentionId';
const BOX = mentionChipBox(textStyles.reading.fontSize);

export default function MentionInput({
  ref,
  placeholder,
  minHeight,
  onChangeContent,
  onSelectionChange,
  onFocusChange,
  onMentionPress,
}: MentionInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // The last selection reported, so moving the cursor reports once per change.
  const reportedRef = useRef('');
  const [isEmpty, setIsEmpty] = useState(true);
  // The latest onChangeContent, so the handle and `changed` stay the same across renders.
  const onChangeRef = useRef(onChangeContent);
  useLayoutEffect(() => {
    onChangeRef.current = onChangeContent;
  });

  const changed = useCallback((root: HTMLDivElement) => {
    // A browser that put in a block or styled text of its own is drawn again as plain text and chips.
    if (!isClean(root)) {
      const at = selectionIn(root);
      draw(root, read(root));
      if (at) placeCaret(root, at.end);
    }
    const content = read(root);
    setIsEmpty(content.text.length === 0);
    const selection = selectionIn(root) ?? { start: 0, end: 0 };
    reportedRef.current = `${selection.start}:${selection.end}`;
    onChangeRef.current(content, selection);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setContent: async (content) => {
        const root = rootRef.current;
        if (!root) return;
        draw(root, content);
        setIsEmpty(content.text.length === 0);
      },
      insertMention: async (id, label, avatarUri, start, end) => {
        const root = rootRef.current;
        if (!root) return;
        const { text, mentions } = read(root);
        if (start < 0 || start > end || end > text.length) return;
        const shift = 2 - (end - start); // the chip and its space, in place of start…end
        const next: FieldContent = {
          text: `${text.slice(0, start)}${MENTION_CHIP} ${text.slice(end)}`,
          mentions: [
            ...mentions.map((mention) =>
              mention.location >= end ? { ...mention, location: mention.location + shift } : mention,
            ),
            { id, label, location: start, avatarUri },
          ].sort((a, b) => a.location - b.location),
        };
        draw(root, next);
        placeCaret(root, start + 2);
        changed(root);
      },
      focus: async () => rootRef.current?.focus(),
    }),
    [changed],
  );

  // Selection changes are the document's, not the field's.
  useEffect(() => {
    function onDocumentSelection() {
      const root = rootRef.current;
      const selection = root && selectionIn(root);
      if (!root || !selection) return;
      const key = `${selection.start}:${selection.end}`;
      if (key === reportedRef.current) return;
      reportedRef.current = key;
      onSelectionChange(selection);
    }
    document.addEventListener('selectionchange', onDocumentSelection);
    return () => document.removeEventListener('selectionchange', onDocumentSelection);
  }, [onSelectionChange]);

  function insertText(text: string) {
    const root = rootRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    root.normalize();
    changed(root);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    insertText('\n');
  }

  return (
    <div style={WRAP_STYLE}>
      {isEmpty && (
        <span aria-hidden style={PLACEHOLDER_STYLE}>
          {placeholder}
        </span>
      )}
      <div
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label={placeholder}
        data-testid="mention-input"
        onInput={(event) => changed(event.currentTarget)}
        onKeyDown={handleKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          insertText(event.clipboardData.getData('text/plain'));
        }}
        onDrop={(event) => event.preventDefault()}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onClick={(event) => {
          const chip = (event.target as HTMLElement).closest<HTMLElement>(`[data-mention-id]`);
          if (chip?.dataset[CHIP]) onMentionPress?.(chip.dataset[CHIP]);
        }}
        style={{ ...FIELD_STYLE, minHeight }}
      />
    </div>
  );
}

// The field's content, read off its DOM: a chip is one MENTION_CHIP, a line break a '\n' (the last
// one the browser's, to show an empty last line).
function read(root: HTMLElement): FieldContent {
  let text = '';
  const mentions: FieldMention[] = [];
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent ?? '').replaceAll(MENTION_CHIP, '');
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const id = node.dataset[CHIP];
    if (id) {
      mentions.push({
        id,
        label: node.dataset.label ?? '',
        location: text.length,
        avatarUri: node.dataset.avatar ?? null,
      });
      text += MENTION_CHIP;
      return;
    }
    if (node.tagName === 'BR') {
      if (node !== root.lastChild) text += '\n';
      return;
    }
    // A block the browser added starts a line.
    if (node !== root && node.tagName === 'DIV' && text.length > 0 && !text.endsWith('\n')) text += '\n';
    node.childNodes.forEach(visit);
  }
  visit(root);
  return { text, mentions };
}

// Whether the DOM is only what `draw` makes: text, chips and line breaks.
function isClean(root: HTMLElement): boolean {
  return [...root.childNodes].every(
    (node) =>
      node.nodeType === Node.TEXT_NODE ||
      (node instanceof HTMLElement && (node.tagName === 'BR' || !!node.dataset[CHIP])),
  );
}

function draw(root: HTMLElement, { text, mentions }: FieldContent) {
  const byLocation = new Map(mentions.map((mention) => [mention.location, mention]));
  const nodes: Node[] = [];
  let run = '';
  for (let i = 0; i < text.length; i++) {
    const mention = text[i] === MENTION_CHIP ? byLocation.get(i) : undefined;
    if (!mention) {
      if (text[i] !== MENTION_CHIP) run += text[i];
      continue;
    }
    if (run) nodes.push(document.createTextNode(run));
    run = '';
    nodes.push(chipNode(mention));
  }
  if (run) nodes.push(document.createTextNode(run));
  // A last line break shows its empty line only with something after it.
  if (text.endsWith('\n')) nodes.push(document.createElement('br'));
  root.replaceChildren(...nodes);
}

// A chip as MentionChip draws it: the round avatar (a grey disc without a photo) and the label, on a
// muted pill.
function chipNode({ id, label, avatarUri }: FieldMention): HTMLElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset[CHIP] = id;
  chip.dataset.label = label;
  if (avatarUri) chip.dataset.avatar = avatarUri;
  chip.setAttribute('role', 'button');
  chip.setAttribute('aria-label', label);
  Object.assign(chip.style, CHIP_STYLE);
  const avatar = document.createElement(avatarUri ? 'img' : 'span');
  if (avatarUri) avatar.setAttribute('src', avatarUri);
  avatar.setAttribute('aria-hidden', 'true');
  Object.assign(avatar.style, AVATAR_STYLE);
  const name = document.createElement('span');
  name.textContent = label;
  name.setAttribute('aria-hidden', 'true');
  chip.append(avatar, name);
  return chip;
}

// How much of the field's text `child` holds: a chip is one character, a line break one (none at the end).
function lengthOf(root: HTMLElement, child: Node): number {
  if (child.nodeType === Node.TEXT_NODE) return (child.textContent ?? '').length;
  if (!(child instanceof HTMLElement)) return 0;
  if (child.dataset[CHIP]) return 1;
  if (child.tagName === 'BR') return child === root.lastChild ? 0 : 1;
  return [...child.childNodes].reduce((sum, inner) => sum + lengthOf(root, inner), 0);
}

// Where (`node`, `offset`) is in the field's text.
function positionOf(root: HTMLElement, node: Node, offset: number): number {
  let count = 0;
  let found: number | null = null;
  function visit(current: Node) {
    if (found != null) return;
    if (current === node) {
      const before = [...current.childNodes].slice(0, offset);
      found =
        count +
        (current.nodeType === Node.TEXT_NODE ? offset : before.reduce((sum, child) => sum + lengthOf(root, child), 0));
      return;
    }
    const leaf =
      current.nodeType === Node.TEXT_NODE ||
      (current instanceof HTMLElement && (current.dataset[CHIP] || current.tagName === 'BR'));
    if (current !== root && leaf) {
      // A place inside a chip is after it.
      if (current.contains(node)) found = count + 1;
      else count += lengthOf(root, current);
      return;
    }
    current.childNodes.forEach(visit);
  }
  visit(root);
  return found ?? count;
}

function selectionIn(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return {
    start: positionOf(root, range.startContainer, range.startOffset),
    end: positionOf(root, range.endContainer, range.endOffset),
  };
}

// Puts the cursor at `position` in the field's text.
function placeCaret(root: HTMLElement, position: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let left = position;
  let placed = false;
  for (const [index, child] of [...root.childNodes].entries()) {
    const length = lengthOf(root, child);
    if (child.nodeType === Node.TEXT_NODE && left <= length) {
      range.setStart(child, left);
      placed = true;
      break;
    }
    if (left === 0) {
      range.setStart(root, index);
      placed = true;
      break;
    }
    left -= length;
  }
  if (!placed) range.setStart(root, root.childNodes.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

const WRAP_STYLE: CSSProperties = { position: 'relative', alignSelf: 'stretch' };

// The reading text of a post (textareaTextStyle), wrapping as typed.
const FIELD_STYLE: CSSProperties = {
  outline: 'none',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  color: colors.text.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // the system font react-native-web's Text uses
  fontSize: textStyles.reading.fontSize,
  lineHeight: `${textStyles.reading.lineHeight}px`,
  caretColor: colors.text.primary,
};

// Over the empty field's first line, letting taps through to it.
const PLACEHOLDER_STYLE: CSSProperties = {
  ...FIELD_STYLE,
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  color: colors.text.tertiary,
};

const CHIP_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'inline-flex',
  alignItems: 'center',
  verticalAlign: 'middle',
  boxSizing: 'border-box',
  height: `${BOX.height}px`,
  paddingLeft: `${BOX.inset}px`,
  paddingRight: `${BOX.trailing}px`,
  gap: `${BOX.gap}px`,
  borderRadius: `${BOX.radius}px`,
  backgroundColor: colors.background.muted,
  fontSize: `${BOX.labelSize}px`,
  lineHeight: `${BOX.height}px`,
  cursor: 'pointer',
  userSelect: 'none',
};

const AVATAR_STYLE: Partial<CSSStyleDeclaration> = {
  width: `${BOX.avatar}px`,
  height: `${BOX.avatar}px`,
  borderRadius: '50%',
  objectFit: 'cover',
  backgroundColor: colors.background.placeholder,
  flexShrink: '0',
};
