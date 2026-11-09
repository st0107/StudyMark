import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FileWarning, Highlighter, LoaderCircle } from 'lucide-react';
import { api, ApiError, errorMessage, isMockApi } from '../../shared/api';
import type { Annotation, CreateAnnotationInput, HighlightColor, StudyDocument } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { NotesSidebar } from '../annotations/NotesSidebar';
import { PdfToolbar } from './PdfToolbar';
import { PdfViewport } from './PdfViewport';
import { SelectionToolbar } from './SelectionToolbar';
import type { PdfSelection } from './pdfAnchorAdapter';
import './reader.css';

type Draft = { pageNumber: number; selection?: PdfSelection };

export default function PdfReaderPage() {
  const { documentId = '' } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [notesOpen, setNotesOpen] = useState(() => window.innerWidth >= 1100);
  const [selection, setSelection] = useState<PdfSelection | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [progressRetry, setProgressRetry] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const details = useQuery({ queryKey: ['document', user?.id, documentId], queryFn: () => api.getDocument(documentId) });
  const content = useQuery({ queryKey: ['document-content', user?.id, documentId], queryFn: () => api.getDocumentContent(documentId), enabled: Boolean(details.data), staleTime: Infinity });
  const annotations = useQuery({ queryKey: ['annotations', user?.id, documentId], queryFn: () => api.listAnnotations(documentId), enabled: Boolean(details.data) });
  const maxPages = pageCount || details.data?.pageCount || 1;
  const requestedPage = Number(params.get('page')) || details.data?.lastPage || 1;
  const page = Math.min(maxPages, Math.max(1, Math.floor(requestedPage)));
  const activeId = params.get('annotation') ?? undefined;
  const documentReady = Boolean(details.data && content.data);
  const updatePageCount = useCallback((count: number) => setPageCount(count), []);

  const refreshAnnotations = useCallback(async () => {
    setSaveStatus('saved');
    await Promise.all([
      client.invalidateQueries({ queryKey: ['annotations', user?.id, documentId] }),
      client.invalidateQueries({ queryKey: ['all-annotations'] }),
      client.invalidateQueries({ queryKey: ['documents'] }),
    ]);
  }, [client, documentId, user?.id]);
  const onSaveError = (error: unknown) => {
    setSaveStatus('failed');
    if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
      // Refresh the version while keeping the editor's draft so the user can retry.
      void client.invalidateQueries({ queryKey: ['annotations', user?.id, documentId] });
    }
  };
  const create = useMutation({ mutationFn: (input: CreateAnnotationInput) => api.createAnnotation(documentId, input), onSuccess: refreshAnnotations, onError: onSaveError });
  const update = useMutation({ mutationFn: ({ annotation, noteText, color }: { annotation: Annotation; noteText: string; color: HighlightColor }) =>
    api.updateAnnotation(annotation.id, { rowVersion: annotation.rowVersion, noteText, ...(annotation.type === 'HIGHLIGHT' ? { color } : {}) }), onSuccess: refreshAnnotations, onError: onSaveError });
  const remove = useMutation({ mutationFn: (annotation: Annotation) => api.deleteAnnotation(annotation.id), onSuccess: refreshAnnotations, onError: onSaveError });

  useEffect(() => {
    if (!documentReady) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.saveProgress(documentId, page).then(() => {
        // Keep a still-cached document in sync even if the reader closed while saving.
        // Returning undefined prevents an old request recreating a cleared account cache.
        client.setQueryData<StudyDocument>(['document', user?.id, documentId], (current) => current ? { ...current, lastPage: page } : undefined);
        void client.invalidateQueries({ queryKey: ['documents'] });
        if (!cancelled) setProgressError('');
      }).catch((error: unknown) => { if (!cancelled) setProgressError(errorMessage(error)); });
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [documentId, page, documentReady, progressRetry, client, user?.id]);

  const navigate = (nextPage: number, annotationId?: string) => {
    setSelection(null); setSelectionError(''); window.getSelection()?.removeAllRanges();
    setParams({ page: String(Math.min(maxPages, Math.max(1, nextPage))), ...(annotationId ? { annotation: annotationId } : {}) }, { replace: true });
  };
  const addPageNote = () => { setNotesOpen(true); setDraft((current) => current ?? { pageNumber: page }); setSelection(null); };
  const saveDraft = async (noteText: string, color: HighlightColor) => {
    if (!draft) return;
    await create.mutateAsync(draft.selection ? { type: 'HIGHLIGHT', pageNumber: draft.pageNumber,
      selectedText: draft.selection.text, anchor: draft.selection.anchor, color, noteText } : { type: 'PAGE_NOTE', pageNumber: draft.pageNumber, noteText });
    setDraft(null); setSelection(null); window.getSelection()?.removeAllRanges();
  };
  const saveHighlight = async (color: HighlightColor) => {
    if (!selection) return;
    setSelectionError('');
    try {
      await create.mutateAsync({ type: 'HIGHLIGHT', pageNumber: selection.anchor.pageNumber,
        selectedText: selection.text, anchor: selection.anchor, color });
      setSelection(null); window.getSelection()?.removeAllRanges();
    } catch (error) { setSelectionError(errorMessage(error)); }
  };

  if (details.isError || content.isError) return <div className="empty-state reader-unavailable" role="alert"><FileWarning size={38} />
    <h1>This document is unavailable</h1><p>{errorMessage(details.error ?? content.error)}</p>
    <div><button className="btn btn-secondary" onClick={() => { void details.refetch(); void content.refetch(); }}>Try again</button><Link className="btn btn-primary" to="/library">Back to library</Link></div></div>;
  if (!details.data || !content.data) return <div className="reader-initial-loading" role="status"><LoaderCircle className="spin" size={26} /><p>Opening your study material…</p></div>;
  return <section className="reader-page">
    <PdfToolbar title={details.data.title} scope={details.data.scope} page={page} pageCount={maxPages} zoom={zoom}
      onPageChange={navigate} onZoomChange={(value) => { setZoom(value); setSelection(null); }}
      onToggleNotes={() => setNotesOpen((open) => !open)} notesOpen={notesOpen} onAddNote={addPageNote}
      saving={create.isPending || update.isPending || remove.isPending} savedLabel={saveStatus === 'failed' ? 'Save failed · retry in your note' : draft ? 'Unsaved note' : saveStatus === 'saved' ? (isMockApi ? 'Last change saved locally' : 'Last change saved') : 'Ready to annotate'} />
    <div className="reader-study-tip"><Highlighter size={14} /><span>Select a passage to highlight it or add a private note.</span><span className="reader-tip-right">A little more understanding, one page at a time.</span></div>
    {progressError && <div className="reader-progress-error" role="alert">Reading position wasn’t saved. {progressError} <button onClick={() => setProgressRetry((value) => value + 1)}>Retry</button></div>}
    <div className={`reader-workspace ${notesOpen ? 'with-notes' : ''}`}>
      <div className="reader-document"><PdfViewport blob={content.data} pageNumber={page} zoom={zoom} contentVersion={details.data.contentVersion}
        annotations={annotations.data ?? []} activeId={activeId} onPageCount={updatePageCount}
        onSelection={(next) => { setSelection(next); setSelectionError(''); }} />
        {selection && <SelectionToolbar selection={selection} onHighlight={(color) => void saveHighlight(color)}
          onNote={() => { setDraft((current) => current ?? { pageNumber: selection.anchor.pageNumber, selection }); setNotesOpen(true); setSelection(null); }}
          onClose={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }} pending={create.isPending} error={selectionError} />}
      </div>
      <NotesSidebar hidden={!notesOpen} annotations={annotations.data ?? []} page={draft?.pageNumber ?? page} activeId={activeId} draft={draft} loading={annotations.isPending}
        error={annotations.isError ? errorMessage(annotations.error) : ''} onRetry={() => void annotations.refetch()} onClose={() => setNotesOpen(false)}
        onAddNote={addPageNote} onCancelDraft={() => setDraft(null)} onSaveDraft={saveDraft}
        onNavigate={(annotation) => navigate(annotation.pageNumber, annotation.id)}
        onUpdate={async (annotation, noteText, color) => { await update.mutateAsync({ annotation, noteText, color }); }}
        onDelete={async (annotation) => { await remove.mutateAsync(annotation); }} />
    </div>
  </section>;
}
