import {
  BookOpen,
  ExternalLink,
  Highlighter,
  MessageSquarePlus,
  Search,
  X,
} from "lucide-react";
import type { HighlightColor } from "../../../shared/types";
import type { PdfSelection } from "../pdfAnchorAdapter";

// eslint-disable-next-line react-refresh/only-export-components
export const highlightColors: { value: HighlightColor; label: string }[] = [
  { value: "#FFE066", label: "Yellow" },
  { value: "#A7E8BD", label: "Green" },
  { value: "#A8D8FF", label: "Blue" },
  { value: "#D9C2FF", label: "Purple" },
  { value: "#FFB5CA", label: "Pink" },
];

export function SelectionToolbar({
  selection,
  onHighlight,
  onNote,
  onClose,
  pending,
  error,
}: {
  selection: PdfSelection;
  onHighlight: (color: HighlightColor) => void;
  onNote: () => void;
  onClose: () => void;
  pending: boolean;
  error: string;
}) {
  const text = selection.text.trim();
  const searchUrl = `https://www.google.com/search?${new URLSearchParams({ q: text })}`;
  const meaningQuery = /\s/u.test(text)
    ? `explain in simple terms: ${text}`
    : `meaning of ${text}`;
  const meaningUrl = `https://www.google.com/search?${new URLSearchParams({ q: meaningQuery })}`;

  return (
    <div
      className="selection-toolbar"
      role="toolbar"
      aria-label="Selected text actions"
      onMouseDown={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="selection-toolbar-heading">
        <span>Selected text</span>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Dismiss selection"
          disabled={pending}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p className="selection-preview">
        {text.slice(0, 200)}
        {text.length > 200 ? "…" : ""}
      </p>
      <div className="selection-toolbar-main">
        <span className="selection-label">
          <Highlighter size={16} /> Highlight
        </span>
        <div
          className="selection-colors"
          role="group"
          aria-label="Highlight color"
        >
          {highlightColors.map((color) => (
            <button
              type="button"
              key={color.value}
              className="selection-color-button"
              aria-label={`Highlight ${color.label.toLowerCase()}`}
              title={`Highlight ${color.label.toLowerCase()}`}
              disabled={pending}
              onClick={() => onHighlight(color.value)}
            >
              <span style={{ background: color.value }} />
            </button>
          ))}
        </div>
      </div>
      {selection.source === "touch" && (
        <p className="selection-adjust-hint">
          Drag the blue handles to adjust your selection.
        </p>
      )}
      <div className="selection-actions">
        <button
          type="button"
          className="selection-action"
          aria-label="Add note to selection"
          disabled={pending}
          onClick={onNote}
        >
          <MessageSquarePlus size={17} />
          <span>Add note</span>
        </button>
        <a
          className="selection-action"
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Search Google (opens in new tab)"
        >
          <Search size={17} />
          <span>Search Google</span>
        </a>
        <a
          className="selection-action"
          href={meaningUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Look up meaning on Google (opens in new tab)"
        >
          <BookOpen size={17} />
          <span>Meaning</span>
        </a>
      </div>
      <p className="selection-lookup-hint">
        <ExternalLink size={11} /> Lookups open in Google in a new tab.
      </p>
      {pending && <span role="status">Saving highlight…</span>}
      {error && (
        <p role="alert" className="selection-error">
          {error} Your selection is kept. Choose a color to retry.
        </p>
      )}
    </div>
  );
}
