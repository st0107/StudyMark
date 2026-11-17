import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { StudyDocument } from "../../shared/types";

export function DocumentDialog({
  type,
  document,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  type: "rename" | "delete";
  document: StudyDocument;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (title: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(document.title);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (type === "delete" || title.trim()) onSubmit(title.trim());
  }
  return (
    <dialog
      ref={ref}
      className="study-dialog"
      aria-labelledby="document-dialog-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <h2 id="document-dialog-title">
            {type === "rename" ? "Rename document" : "Delete this PDF?"}
          </h2>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Close dialog"
            disabled={pending}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {type === "rename" ? (
          <label className="form-label">
            Document title
            <input
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={160}
              autoFocus
            />
          </label>
        ) : (
          <div className="delete-description">
            <AlertTriangle size={26} />
            <p>
              <strong>{document.title}</strong> and all of your annotations on
              it will be permanently removed from this demo browser. This cannot
              be undone.
            </p>
          </div>
        )}
        {error && (
          <p className="alert" role="alert">
            {error} Your changes haven’t been saved. Try again.
          </p>
        )}
        <div className="dialog-footer">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`btn ${type === "delete" ? "btn-danger" : "btn-primary"}`}
            disabled={pending || (type === "rename" && !title.trim())}
          >
            {pending
              ? "Saving…"
              : type === "rename"
                ? "Save name"
                : "Delete PDF"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
