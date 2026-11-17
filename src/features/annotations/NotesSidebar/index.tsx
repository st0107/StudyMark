import { useState } from "react";
import { Highlighter, LockKeyhole, Plus, X } from "lucide-react";
import type { Annotation, HighlightColor } from "../../../shared/types";
import type { PdfSelection } from "../../pdf-reader/pdfAnchorAdapter";
import { AnnotationCard } from "../AnnotationCard";
import { NoteEditor } from "../NoteEditor";

export function NotesSidebar({
  annotations,
  page,
  activeId,
  draft,
  loading,
  error,
  hidden = false,
  onRetry,
  onClose,
  onAddNote,
  onCancelDraft,
  onSaveDraft,
  onNavigate,
  onUpdate,
  onDelete,
}: {
  annotations: Annotation[];
  page: number;
  activeId?: string;
  draft: { selection?: PdfSelection } | null;
  loading: boolean;
  error: string;
  hidden?: boolean;
  onRetry: () => void;
  onClose: () => void;
  onAddNote: () => void;
  onCancelDraft: () => void;
  onSaveDraft: (text: string, color: HighlightColor) => Promise<void>;
  onNavigate: (annotation: Annotation) => void;
  onUpdate: (
    annotation: Annotation,
    note: string,
    color: HighlightColor,
  ) => Promise<void>;
  onDelete: (annotation: Annotation) => Promise<void>;
}) {
  const [filter, setFilter] = useState<"all" | "notes" | "highlights">("all");
  const filtered = annotations.filter(
    (item) =>
      filter === "all" ||
      (filter === "notes" ? Boolean(item.noteText) : item.type === "HIGHLIGHT"),
  );
  return (
    <aside
      className="notes-sidebar"
      aria-label="My highlights and notes"
      hidden={hidden}
    >
      <div className="notes-sidebar-header">
        <div>
          <h2>
            My notes <span>{annotations.length}</span>
          </h2>
          <p>Your thoughts, all in one place.</p>
        </div>
        <button
          className="btn btn-icon"
          onClick={onClose}
          aria-label="Close notes sidebar"
        >
          <X size={18} />
        </button>
      </div>
      <div className="notes-private">
        <LockKeyhole size={12} /> Only visible to you
      </div>
      <div className="notes-tabs" role="group" aria-label="Filter annotations">
        {(["all", "highlights", "notes"] as const).map((item) => (
          <button
            key={item}
            aria-pressed={filter === item}
            className={filter === item ? "is-active" : ""}
            onClick={() => setFilter(item)}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      <div className="notes-content">
        {draft && (
          <section className="new-note">
            <h3>
              {draft.selection ? "Note on selection" : `Note on page ${page}`}
            </h3>
            <NoteEditor
              key={draft.selection?.text ?? `page-${page}`}
              selectedText={draft.selection?.text}
              onSave={onSaveDraft}
              onCancel={onCancelDraft}
            />
          </section>
        )}
        {loading && (
          <p role="status" className="notes-status">
            Loading your annotations…
          </p>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && !filtered.length && !draft && (
          <div className="notes-empty">
            <span>
              <Highlighter size={23} />
            </span>
            <h3>A little insight goes a long way</h3>
            <p>
              Select text in the PDF to highlight it, or add a note to this
              page.
            </p>
          </div>
        )}
        {filtered.map((annotation) => (
          <AnnotationCard
            key={annotation.id}
            annotation={annotation}
            active={activeId === annotation.id}
            onNavigate={() => onNavigate(annotation)}
            onUpdate={(note, color) => onUpdate(annotation, note, color)}
            onDelete={() => onDelete(annotation)}
          />
        ))}
      </div>
      <div className="notes-sidebar-bottom">
        <button className="btn btn-secondary" onClick={onAddNote}>
          <Plus size={17} /> Add page note
        </button>
        <p>Highlight what matters. Make it yours.</p>
      </div>
    </aside>
  );
}
