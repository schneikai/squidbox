import { describe, expect, it } from 'vitest';
import { mentionMarkers } from '@squidbox/shared';

const NAMES = ['Sam Ridge', 'Maya'];

describe('mentionMarkers', () => {
  it("makes a marker of a given name that name, with its place; a later one's place counts what was removed", () => {
    expect(mentionMarkers.read('With @[Sam Ridge] and @[Maya].', NAMES)).toEqual({
      text: 'With Sam Ridge and Maya.',
      marks: [
        { location: 5, name: 'Sam Ridge' },
        { location: 19, name: 'Maya' },
      ],
    });
  });

  it('leaves a marker of a name not given as plain text, with no mark', () => {
    expect(mentionMarkers.read('With @[ Nobody Here ] today', NAMES)).toEqual({
      text: 'With Nobody Here today',
      marks: [],
    });
  });

  it('drops only the @[ of a marker with no ] on its line, and gives no mark', () => {
    expect(mentionMarkers.read('With @[Sam Ridge\nand] more', NAMES)).toEqual({
      text: 'With Sam Ridge\nand] more',
      marks: [],
    });
  });

  it('reads a marker with a [ inside as broken: only the @[ goes, later brackets stay', () => {
    expect(mentionMarkers.read('With @[Sam and [later] on', NAMES)).toEqual({
      text: 'With Sam and [later] on',
      marks: [],
    });
  });

  it('matches another case and other inner spaces to the name as given', () => {
    expect(mentionMarkers.read('with @[sam   ridge]', NAMES)).toEqual({
      text: 'with Sam Ridge',
      marks: [{ location: 5, name: 'Sam Ridge' }],
    });
  });

  it('leaves a name two given names share but for case or spaces as plain text', () => {
    expect(mentionMarkers.read('With @[Sam Ridge]', ['Sam Ridge', 'sam  ridge'])).toEqual({
      text: 'With Sam Ridge',
      marks: [],
    });
  });

  it('reads back what it writes', () => {
    const text = 'Sam Ridge and Maya, then Maya again';
    const marks = [
      { location: 0, name: 'Sam Ridge' },
      { location: 14, name: 'Maya' },
      { location: 25, name: 'Maya' },
    ];
    expect(mentionMarkers.read(mentionMarkers.write(text, marks), NAMES)).toEqual({ text, marks });
  });

  it('writes a name holding ] unmarked', () => {
    expect(
      mentionMarkers.write('With Sam] and Maya', [
        { location: 5, name: 'Sam]' },
        { location: 14, name: 'Maya' },
      ]),
    ).toBe('With Sam] and @[Maya]');
  });
});
