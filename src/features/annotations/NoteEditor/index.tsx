import { useId, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import type { HighlightColor } from '../../../shared/types';
import { highlightColors } from '../../pdf-reader/SelectionToolbar';
import { errorMessage } from '../../../shared/api/errors';

export function NoteEditor({ initialText = '', initialColor = '#FFE066', selectedText, requireText = true, onSave, onCancel }: {
  initialText?: string; initialColor?: HighlightColor; selectedText?: string | null; requireText?: boolean;
  onSave: (noteText: string, color: HighlightColor) => Promise<void>; onCancel: () => void;
}) {
  const inputId = useId();
  const [note, setNote] = useState(initialText);
  const [color, setColor] = useState<HighlightColor>(initialColor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return <form className="note-editor" onSubmit={async (event) => {
    event.preventDefault();
    if (requireText && !note.trim()) { setError('Write a note before saving.'); return; }
    setPending(true); setError('');
    try { await onSave(note.trim(), color); } catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); }
  }}>
    {selectedText && <blockquote>{selectedText}</blockquote>}
    {selectedText && <div className="note-colors" role="group" aria-label="Highlight color">{highlightColors.map((item) => <button type="button" key={item.value}
      className={`color-button ${color === item.value ? 'is-active' : ''}`} style={{ background: item.value }}
      aria-label={`${item.label} highlight`} aria-pressed={color === item.value} onClick={() => setColor(item.value)}>{color === item.value && <Check size={12} />}</button>)}</div>}
    <label htmlFor={inputId}>Your note</label><textarea id={inputId} rows={5} maxLength={5000} value={note} autoFocus
      placeholder="What would you like to remember?" disabled={pending} onChange={(event) => setNote(event.target.value)} />
    <small>{note.length.toLocaleString()} / 5,000 characters{!requireText && ' · Leave blank to remove the note'}</small>
    {error && <p role="alert" className="alert alert-error">{error} Your draft is kept; try saving again.</p>}
    <div className="note-editor-actions"><button className="btn btn-secondary" type="button" disabled={pending} onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" disabled={pending} type="submit">{pending ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}{pending ? 'Saving…' : error ? 'Retry save' : 'Save note'}</button></div>
  </form>;
}
