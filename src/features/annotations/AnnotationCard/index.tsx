import { useState } from 'react';
import { ArrowUpRight, Pencil, StickyNote, Trash2 } from 'lucide-react';
import type { Annotation, HighlightColor } from '../../../shared/types';
import { errorMessage } from '../../../shared/api/errors';
import { NoteEditor } from '../NoteEditor';

export function AnnotationCard({ annotation, active, onNavigate, onUpdate, onDelete }: {
  annotation: Annotation; active?: boolean; onNavigate: () => void;
  onUpdate: (noteText: string, color: HighlightColor) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return <article className={`annotation-card ${active ? 'is-active' : ''}`} style={{ '--annotation-color': annotation.color ?? '#d9e1ed' } as React.CSSProperties}>
    <div className="annotation-card-top"><button className="annotation-page" onClick={onNavigate}>Page {annotation.pageNumber}<ArrowUpRight size={12} /></button>
      <span className="annotation-type">{annotation.type === 'PAGE_NOTE' ? <><StickyNote size={12} /> Page note</> : 'Highlight'}</span></div>
    {editing ? <NoteEditor initialText={annotation.noteText} initialColor={annotation.color ?? '#FFE066'} selectedText={annotation.selectedText}
      requireText={annotation.type === 'PAGE_NOTE'} onCancel={() => setEditing(false)} onSave={async (note, color) => { await onUpdate(note, color); setEditing(false); }} /> : <>
      {annotation.selectedText && <button className="annotation-quote" onClick={onNavigate}>{annotation.selectedText}</button>}
      {annotation.noteText && <p className="annotation-note">{annotation.noteText}</p>}
      <div className="annotation-card-footer"><time dateTime={annotation.updatedAt}>{new Date(annotation.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
        <div><button className="btn btn-icon" aria-label="Edit annotation" onClick={() => setEditing(true)}><Pencil size={14} /></button>
          <button className="btn btn-icon" aria-label="Delete annotation" onClick={() => setConfirming(true)}><Trash2 size={14} /></button></div></div>
      {confirming && <div className="annotation-confirm"><p>Delete this {annotation.type === 'HIGHLIGHT' ? 'highlight and its note' : 'page note'}?</p>
        <button className="btn btn-secondary" disabled={pending} onClick={() => setConfirming(false)}>Keep it</button>
        <button className="btn btn-danger" disabled={pending} onClick={async () => {
          setPending(true); setError(''); try { await onDelete(); } catch (reason) { setError(errorMessage(reason)); } finally { setPending(false); }
        }}>{pending ? 'Deleting…' : 'Delete'}</button></div>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}
    </>}
  </article>;
}
