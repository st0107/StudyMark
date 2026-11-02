import { Highlighter, MessageSquarePlus, X } from 'lucide-react';
import type { HighlightColor } from '../../../shared/types';
import type { PdfSelection } from '../pdfAnchorAdapter';

// eslint-disable-next-line react-refresh/only-export-components
export const highlightColors: { value: HighlightColor; label: string }[] = [
  { value: '#FFE066', label: 'Yellow' }, { value: '#A7E8BD', label: 'Green' },
  { value: '#A8D8FF', label: 'Blue' }, { value: '#D9C2FF', label: 'Purple' }, { value: '#FFB5CA', label: 'Pink' },
];

export function SelectionToolbar({ selection, onHighlight, onNote, onClose, pending, error }: {
  selection: PdfSelection; onHighlight: (color: HighlightColor) => void; onNote: () => void; onClose: () => void;
  pending: boolean; error: string;
}) {
  return <div className="selection-toolbar" role="toolbar" aria-label="Selected text actions" onPointerDown={(event) => event.preventDefault()}>
    <div className="selection-toolbar-main"><Highlighter size={17} /><span className="selection-label">Highlight</span>
      {highlightColors.map((color) => <button key={color.value} className="color-button" style={{ background: color.value }}
        aria-label={`Highlight ${color.label.toLowerCase()}`} disabled={pending} onClick={() => onHighlight(color.value)} />)}
      <span className="toolbar-divider" /><button className="btn btn-icon" aria-label="Add note to selection" disabled={pending} onClick={onNote}><MessageSquarePlus size={18} /></button>
      <button className="btn btn-icon" aria-label="Dismiss selection" disabled={pending} onClick={onClose}><X size={16} /></button></div>
    <p className="selection-preview">{selection.text.slice(0, 110)}{selection.text.length > 110 ? '…' : ''}</p>
    {pending && <span role="status">Saving highlight…</span>}{error && <p role="alert" className="selection-error">{error} Your selection is kept. Choose a color to retry.</p>}
  </div>;
}
