import { useState } from 'react';

import Field from '@/components/Field';
import TextInput from '@/components/TextInput';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import { scale } from '@/styles/designTokens';
import { setModelNote } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import noteText from '@/utils/noteText';

const NOTE_MAX_LENGTH = 1000;

/**
 * A model's note on its page (`note` as stored, read once): what the admin tried with it, saved as
 * you type. The list shows it under the model, and it stays when the model is removed.
 */
export default function ModelNoteField({ kind, modelId, note, style }) {
  const [text, setText] = useState(note ?? '');
  const { flush } = useSaveAsYouType(noteText(text), (next) => setModelNote(getDb(), kind, modelId, next));

  return (
    <Field label="Note" style={style}>
      <TextInput
        variant="field"
        multiline
        value={text}
        onChangeText={setText}
        onBlur={() => flush()}
        placeholder="e.g. Good at short posts, ignores the tone"
        maxLength={NOTE_MAX_LENGTH}
        minHeight={scale(88)}
      />
    </Field>
  );
}
