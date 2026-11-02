import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, PanelRight, Plus, StickyNote } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props { title: string; scope: 'SHARED' | 'PERSONAL'; page: number; pageCount: number; zoom: number;
  onPageChange: (page: number) => void; onZoomChange: (zoom: number) => void; onToggleNotes: () => void;
  notesOpen: boolean; onAddNote: () => void; saving: boolean; savedLabel: string }

export function PdfToolbar({ title, scope, page, pageCount, zoom, onPageChange, onZoomChange, onToggleNotes, notesOpen, onAddNote, saving, savedLabel }: Props) {
  const [value, setValue] = useState(String(page));
  useEffect(() => setValue(String(page)), [page]);
  const navigate = () => {
    const next = Number(value);
    if (Number.isInteger(next) && next > 0 && next <= pageCount) onPageChange(next);
    else setValue(String(page));
  };
  return <div className="pdf-toolbar">
    <div className="reader-document-title"><Link className="btn btn-icon" to={scope === 'PERSONAL' ? '/my-pdfs' : '/library'} aria-label="Back to library"><ArrowLeft size={20} /></Link>
      <div><h1 title={title}>{title}</h1><span>{scope === 'SHARED' ? 'Shared material' : 'My PDFs'} <span aria-hidden="true">·</span> Private annotations</span></div></div>
    <div className="reader-controls">
      <div className="page-controls"><button className="btn btn-icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={18} /></button>
        <form onSubmit={(event) => { event.preventDefault(); navigate(); }}><input aria-label="Page number" type="number" min={1} max={pageCount} value={value} onChange={(event) => setValue(event.target.value)} onBlur={navigate} /><span>/ {pageCount}</span></form>
        <button className="btn btn-icon" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight size={18} /></button></div>
      <span className="toolbar-divider" />
      <div className="zoom-controls"><button className="btn btn-icon" aria-label="Zoom out" disabled={zoom <= .5} onClick={() => onZoomChange(Math.max(.5, zoom - .25))}><Minus size={17} /></button>
        <button className="zoom-value" title="Reset to fit width" onClick={() => onZoomChange(1)}>{Math.round(zoom * 100)}%</button>
        <button className="btn btn-icon" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => onZoomChange(Math.min(2, zoom + .25))}><Plus size={17} /></button></div>
      <span className="toolbar-divider" />
      <button className="btn btn-secondary page-note-button" onClick={onAddNote}><StickyNote size={16} /><span>Add note</span></button>
      <button className={`btn btn-icon ${notesOpen ? 'is-selected' : ''}`} aria-label="Toggle notes sidebar" aria-expanded={notesOpen} onClick={onToggleNotes}><PanelRight size={19} /></button>
    </div>
    <span className={`reader-save-state ${saving ? 'is-saving' : ''}`} role="status">{saving ? 'Saving…' : savedLabel}</span>
  </div>;
}
