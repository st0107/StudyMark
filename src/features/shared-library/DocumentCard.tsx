import {
  ArrowUpRight,
  BookOpen,
  FileText,
  Highlighter,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { StudyDocument } from "../../shared/types";
import { formatFileSize } from "./format";

export function DocumentCard({
  document,
  onRename,
  onDelete,
}: {
  document: StudyDocument;
  onRename?: (document: StudyDocument) => void;
  onDelete?: (document: StudyDocument) => void;
}) {
  const progress = Math.min(
    100,
    Math.round((document.lastPage / document.pageCount) * 100),
  );
  const theme = document.subject.toLowerCase().includes("java")
    ? "amber"
    : document.subject.toLowerCase().includes("data")
      ? "blue"
      : "green";
  return (
    <article className="document-card">
      <div className={`document-cover cover-${theme}`}>
        <div className="document-cover-top">
          <span className="pdf-label">
            <FileText size={12} /> PDF DOCUMENT
          </span>
          <span>{document.pageCount} pages</span>
        </div>
        <div className="document-cover-symbol" aria-hidden="true">
          <BookOpen size={35} strokeWidth={1.3} />
        </div>
        <p>{document.subject}</p>
        <div className="document-cover-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="document-card-content">
        <div className="document-card-top">
          <span className={`subject-label subject-${theme}`}>
            {document.subject}
          </span>
          {onRename && onDelete && (
            <details className="document-actions">
              <summary aria-label={`Actions for ${document.title}`}>
                <MoreHorizontal size={19} />
              </summary>
              <div className="document-actions-menu">
                <button onClick={() => onRename(document)}>
                  <Pencil size={14} /> Rename
                </button>
                <button
                  className="danger-text"
                  onClick={() => onDelete(document)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </details>
          )}
        </div>
        <Link className="document-title" to={`/reader/${document.id}`}>
          {document.title}
        </Link>
        <p className="document-description">
          {document.description ||
            "Your study material, ready for a little more understanding."}
        </p>
        <div className="document-meta">
          <span>{formatFileSize(document.sizeBytes)}</span>
          <span>
            <Highlighter size={13} /> {document.annotationCount} annotations
          </span>
        </div>
        {document.lastPage > 0 ? (
          <div className="document-progress">
            <div>
              <span>Reading progress</span>
              <span>{progress}%</span>
            </div>
            <progress
              max={100}
              value={progress}
              aria-label={`${document.title} reading progress`}
            />
          </div>
        ) : (
          <div className="document-progress document-not-started">
            Ready when you are
          </div>
        )}
        <Link className="document-open" to={`/reader/${document.id}`}>
          {document.lastPage > 0 ? "Continue reading" : "Start reading"}{" "}
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
