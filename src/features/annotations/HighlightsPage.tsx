import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Highlighter, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, errorMessage } from "../../shared/api";
import type {
  Annotation,
  AnnotationWithDocument,
  HighlightColor,
  StudyDocument,
} from "../../shared/types";
import { useAuth } from "../auth/AuthProvider";
import { AnnotationCard } from "./AnnotationCard";
import { highlightColors } from "../pdf-reader/SelectionToolbar";
import "../pdf-reader/reader.css";

export default function HighlightsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("all");
  const [kind, setKind] = useState("all");
  const query = useQuery({
    queryKey: ["all-annotations", user?.id],
    queryFn: api.getAllAnnotations,
  });
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { document: StudyDocument; annotations: AnnotationWithDocument[] }
    >();
    for (const item of query.data ?? []) {
      if (color !== "all" && item.color !== color) continue;
      if (kind === "notes" && !item.noteText) continue;
      if (kind === "highlights" && item.type !== "HIGHLIGHT") continue;
      if (
        !`${item.selectedText ?? ""} ${item.noteText} ${item.document.title}`
          .toLowerCase()
          .includes(search.toLowerCase().trim())
      )
        continue;
      if (!map.has(item.documentId))
        map.set(item.documentId, { document: item.document, annotations: [] });
      map.get(item.documentId)?.annotations.push(item);
    }
    return [...map.values()];
  }, [query.data, search, color, kind]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["all-annotations"] }),
      client.invalidateQueries({ queryKey: ["annotations"] }),
      client.invalidateQueries({ queryKey: ["documents"] }),
    ]);
  };
  const refreshConflictingAnnotation = async (error: unknown) => {
    if (error instanceof ApiError && error.code === "VERSION_CONFLICT") {
      // AnnotationCard keeps its editor mounted, retaining the draft while the
      // refreshed annotation supplies the current rowVersion for a retry.
      await refresh();
    }
  };
  const update = useMutation({
    mutationFn: ({
      annotation,
      noteText,
      color,
    }: {
      annotation: Annotation;
      noteText: string;
      color: HighlightColor;
    }) =>
      api.updateAnnotation(annotation.id, {
        rowVersion: annotation.rowVersion,
        noteText,
        ...(annotation.type === "HIGHLIGHT" ? { color } : {}),
      }),
    onSuccess: refresh,
    onError: refreshConflictingAnnotation,
  });
  const remove = useMutation({
    mutationFn: (annotation: Annotation) => api.deleteAnnotation(annotation.id),
    onSuccess: refresh,
  });
  const exportNotes = () => {
    const text = [
      "# My StudyMark notes",
      ...groups.map(
        (group) =>
          `\n## ${group.document.title}\n\n${group.annotations
            .map(
              (item) =>
                `### Page ${item.pageNumber}\n${item.selectedText ? `\n> ${item.selectedText.replaceAll("\n", "\n> ")}\n` : ""}\n${item.noteText}\n`,
            )
            .join("\n")}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "studymark-notes.md";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="highlights-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">CONNECT THE DOTS</div>
          <h1>My highlights</h1>
          <p>The ideas that stayed with you. All in one place.</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={exportNotes}
          disabled={!groups.length}
        >
          <Download size={16} /> Export notes
        </button>
      </header>
      <section className="highlights-summary">
        <div className="highlights-summary-icon">
          <Highlighter size={25} />
        </div>
        <div>
          <strong>{query.data?.length ?? 0} saved insights</strong>
          <p>Your personal collection of highlights and notes.</p>
        </div>
        <span>Private to you</span>
      </section>
      <div className="highlights-filters">
        <label className="highlights-search">
          <Search size={18} />
          <input
            aria-label="Search highlights"
            placeholder="Search your highlights and notes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          className="field"
          aria-label="Annotation type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">All annotations</option>
          <option value="highlights">Highlights</option>
          <option value="notes">With notes</option>
        </select>
        <select
          className="field"
          aria-label="Highlight color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        >
          <option value="all">All colors</option>
          {highlightColors.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {query.isPending ? (
        <div className="notes-status" role="status">
          Loading your saved insights…
        </div>
      ) : query.isError ? (
        <div className="empty-state" role="alert">
          <h2>Couldn’t load your highlights</h2>
          <p>{errorMessage(query.error)}</p>
          <button
            className="btn btn-primary"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </div>
      ) : !groups.length ? (
        <div className="empty-state">
          <Highlighter size={36} />
          <h2>
            {query.data?.length
              ? "No matching insights"
              : "Your next idea starts with a highlight"}
          </h2>
          <p>
            {query.data?.length
              ? "Try a different search or color."
              : "Open a PDF, select a passage, and save the things you want to remember."}
          </p>
          <Link className="btn btn-primary" to="/library">
            Explore the library
          </Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.document.id} className="highlight-group">
            <header>
              <div className="highlight-group-icon">
                <BookOpen size={19} />
              </div>
              <div>
                <h2>
                  <Link to={`/reader/${group.document.id}`}>
                    {group.document.title}
                  </Link>
                </h2>
                <p>
                  {group.document.subject} · {group.annotations.length}{" "}
                  annotations
                </p>
              </div>
              <Link
                to={`/reader/${group.document.id}`}
                className="btn btn-secondary"
              >
                Open PDF
              </Link>
            </header>
            <div className="highlight-cards">
              {group.annotations.map((annotation) => (
                <AnnotationCard
                  key={annotation.id}
                  annotation={annotation}
                  onNavigate={() =>
                    navigate(
                      `/reader/${annotation.documentId}?page=${annotation.pageNumber}&annotation=${annotation.id}`,
                    )
                  }
                  onUpdate={async (noteText, color) => {
                    await update.mutateAsync({ annotation, noteText, color });
                  }}
                  onDelete={async () => {
                    await remove.mutateAsync(annotation);
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
