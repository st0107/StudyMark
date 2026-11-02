import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, LockKeyhole, UploadCloud, X } from 'lucide-react';
import { api } from '../../shared/api';
import type { DocumentScope } from '../../shared/types';
import { formatFileSize } from '../shared-library/format';
import { inspectPdfUpload } from './validateUpload';

export function UploadDialog({ scope, onClose, onUploaded }: { scope: DocumentScope; onClose: () => void; onUploaded: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('General');
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState('');
  const queryClient = useQueryClient();
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a PDF to upload.');
      setStage('Checking your PDF…');
      const pageCount = await inspectPdfUpload(file);
      setStage('Saving your document…');
      return api.uploadDocument({ file, title: title.trim(), subject: subject.trim() || 'General', pageCount, scope });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
      onUploaded();
    },
  });
  function selectFile(selected: File | undefined) {
    if (!selected || upload.isPending) return;
    upload.reset(); setFile(selected); setTitle(selected.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').slice(0, 160));
  }
  function submit(event: FormEvent) { event.preventDefault(); upload.mutate(); }
  return <dialog ref={dialogRef} className="study-dialog upload-dialog" aria-labelledby="upload-title" onCancel={event => { if (upload.isPending) event.preventDefault(); else onClose(); }}>
    <form onSubmit={submit}><div className="dialog-heading"><div><h2 id="upload-title">{scope === 'SHARED' ? 'Add shared material' : 'Upload a PDF'}</h2><p>{scope === 'SHARED' ? 'New materials are saved as drafts for review.' : 'Bring your study materials together.'}</p></div><button className="btn btn-icon" aria-label="Close upload dialog" type="button" disabled={upload.isPending} onClick={onClose}><X size={19} /></button></div>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="visually-hidden" tabIndex={-1} onChange={event => selectFile(event.target.files?.[0])} aria-label="Choose PDF file" />
      <button type="button" className={`upload-dropzone ${dragging ? 'is-dragging' : ''}`} disabled={upload.isPending} onClick={() => inputRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}>
        {file ? <FileText size={34} strokeWidth={1.4} /> : <UploadCloud size={34} strokeWidth={1.4} />}<strong>{file ? file.name : 'Drop your PDF here, or browse'}</strong><span>{file ? `${formatFileSize(file.size)} · Click to choose another file` : 'PDF files up to 25 MB · Maximum 200 pages'}</span>
      </button>
      <label className="form-label">Document title<input className="field" placeholder="Give your PDF a helpful title" required maxLength={160} value={title} disabled={upload.isPending} onChange={event => setTitle(event.target.value)} /></label>
      <label className="form-label">Subject<input className="field" placeholder="e.g. Computer Science" maxLength={80} value={subject} disabled={upload.isPending} onChange={event => setSubject(event.target.value)} /></label>
      <p className="upload-hint"><LockKeyhole size={14} />{scope === 'SHARED' ? 'Only published materials are visible in the shared library.' : 'Only your demo account can see this PDF and its annotations.'}</p>
      {upload.isError && <p className="alert" role="alert">{upload.error.message} Your selected file is still here; you can retry.</p>}
      {upload.isPending && <p className="upload-status" role="status">{stage}</p>}
      <div className="dialog-footer"><button className="btn btn-secondary" type="button" disabled={upload.isPending} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={upload.isPending || !file || !title.trim()}>{upload.isPending ? 'Please wait…' : upload.isError ? 'Retry upload' : scope === 'SHARED' ? 'Save as draft' : 'Upload PDF'}</button></div>
    </form>
  </dialog>;
}
