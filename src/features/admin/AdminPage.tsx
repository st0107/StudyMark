import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  EyeOff,
  FileText,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { api } from "../../shared/api";
import type { StudyDocument } from "../../shared/types";
import { useAuth } from "../auth/AuthProvider";
import { UploadDialog } from "../uploads/UploadDialog";
import { formatFileSize } from "../shared-library/format";
import "../shared-library/library.css";

function UnpublishDialog({
  document,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  document: StudyDocument;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="study-dialog"
      aria-labelledby="unpublish-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="unpublish-title">Unpublish this material?</h2>
        <button
          className="btn btn-icon"
          aria-label="Close dialog"
          disabled={pending}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <p>
        <strong>{document.title}</strong> will become unavailable in the shared
        library. Students’ annotations will be preserved and restored if you
        publish it again.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={onClose}
        >
          Keep published
        </button>
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Updating…" : "Unpublish"}
        </button>
      </div>
    </dialog>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [unpublishing, setUnpublishing] = useState<StudyDocument | null>(null);
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-documents", user?.id],
    queryFn: () => api.listAdminDocuments(),
    enabled: user?.role === "ADMIN",
  });
  const publish = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "DRAFT" | "PUBLISHED";
    }) => api.setPublication(id, status),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["document"] }),
      ]);
      setNotice(
        variables.status === "PUBLISHED"
          ? "Material published to the shared library."
          : "Material unpublished. Private annotations have been preserved.",
      );
      setUnpublishing(null);
    },
  });
  if (user?.role !== "ADMIN")
    return (
      <div className="empty-state">
        <ShieldCheck size={36} />
        <h1>Administrator access required</h1>
        <p>
          Sign in with the administrator demo account to manage shared
          materials.
        </p>
      </div>
    );
  const documents = query.data ?? [];
  const filtered = documents.filter(
    (document) =>
      (filter === "ALL" || document.status === filter) &&
      `${document.title} ${document.subject}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="library-page admin-page">
      <header className="page-heading library-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Manage materials</h1>
          <p>Build a shared library worth coming back to.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
          <Upload size={17} /> Add material
        </button>
      </header>
      <div className="personal-privacy">
        <ShieldCheck size={18} />
        <div>
          Manage shared source documents here. Students’ personal PDFs and
          annotations remain private.
        </div>
      </div>
      <div className="admin-stats">
        <div>
          <FileText size={22} />
          <span>
            <strong>{documents.length}</strong> Total materials
          </span>
        </div>
        <div>
          <Eye size={22} />
          <span>
            <strong>
              {
                documents.filter((document) => document.status === "PUBLISHED")
                  .length
              }
            </strong>{" "}
            Published
          </span>
        </div>
        <div>
          <EyeOff size={22} />
          <span>
            <strong>
              {
                documents.filter((document) => document.status === "DRAFT")
                  .length
              }
            </strong>{" "}
            Drafts
          </span>
        </div>
      </div>
      {notice && (
        <div className="library-notice" role="status">
          <Check size={16} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {publish.isError && !unpublishing && (
        <p className="alert" role="alert">
          {publish.error.message} Try the action again.
        </p>
      )}
      <div className="library-filters">
        <label className="library-search">
          <Search size={18} />
          <input
            aria-label="Search shared materials"
            placeholder="Search materials…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          className="field"
          aria-label="Publication status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>
      {query.isPending ? (
        <p role="status">Loading shared materials…</p>
      ) : query.isError ? (
        <div className="empty-state">
          <h3>Couldn’t load materials</h3>
          <p>{query.error.message}</p>
          <button
            className="btn btn-secondary"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Added</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((document) => (
                <tr key={document.id}>
                  <td>
                    <div className="admin-document">
                      <span className="admin-file-icon">
                        <FileText size={22} />
                      </span>
                      <div>
                        <strong>{document.title}</strong>
                        <span>
                          {document.pageCount} pages ·{" "}
                          {formatFileSize(document.sizeBytes)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{document.subject}</td>
                  <td>
                    <span
                      className={`publication-badge status-${document.status.toLowerCase()}`}
                    >
                      <i />
                      {document.status === "PUBLISHED"
                        ? "Published"
                        : document.status === "DRAFT"
                          ? "Draft"
                          : "Archived"}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(document.createdAt))}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      disabled={publish.isPending}
                      onClick={() => {
                        publish.reset();
                        if (document.status === "PUBLISHED")
                          setUnpublishing(document);
                        else
                          publish.mutate({
                            id: document.id,
                            status: "PUBLISHED",
                          });
                      }}
                    >
                      {document.status === "PUBLISHED" ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                      {document.status === "PUBLISHED"
                        ? "Unpublish"
                        : "Publish"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              <FileText size={32} />
              <h3>No materials found</h3>
              <p>
                {documents.length
                  ? "Try a different search or status."
                  : "Add a PDF to create your first shared draft."}
              </p>
            </div>
          )}
        </div>
      )}
      {uploadOpen && (
        <UploadDialog
          scope="SHARED"
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            setNotice(
              "Your material was saved as a draft. Publish it when it’s ready.",
            );
          }}
        />
      )}
      {unpublishing && (
        <UnpublishDialog
          document={unpublishing}
          pending={publish.isPending}
          error={publish.error?.message}
          onClose={() => setUnpublishing(null)}
          onConfirm={() =>
            publish.mutate({ id: unpublishing.id, status: "DRAFT" })
          }
        />
      )}
    </div>
  );
}
