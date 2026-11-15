import { describe, expect, it } from 'vitest';
import { mentionMarkers } from '@squidbox/shared';

const NAMES = new Map(['Sam Ridge', 'Maya'].map((name) => [mentionMarkers.key(name), name]));

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

  it('takes an @ written before a marker or inside it as part of it', () => {
    const chip = { text: 'With Sam Ridge', marks: [{ location: 5, name: 'Sam Ridge' }] };
    expect(mentionMarkers.read('With @@[Sam Ridge]', NAMES)).toEqual(chip);
    expect(mentionMarkers.read('With @[@Sam Ridge]', NAMES)).toEqual(chip);
  });

  it('leaves an @[ inside a word as written, also when stripping', () => {
    expect(mentionMarkers.read('frames@[3] and a@@[Maya]', NAMES)).toEqual({
      text: 'frames@[3] and a@@[Maya]',
      marks: [],
    });
    expect(mentionMarkers.strip('frames@[3]')).toBe('frames@[3]');
  });

  it('marks a name, and leaves one holding ] as it is', () => {
    expect([mentionMarkers.mark('Maya'), mentionMarkers.mark('Sam]')]).toEqual(['@[Maya]', 'Sam]']);
  });
});
