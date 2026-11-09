import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, FileText, FolderOpen, Grid2X2, List, LockKeyhole, Search, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api';
import type { DocumentScope, StudyDocument } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { UploadDialog } from '../uploads/UploadDialog';
import { DocumentDialog } from '../personal-library/DocumentDialog';
import { DocumentCard } from './DocumentCard';
import './library.css';

const PAGE_SIZE = 8;

export function LibraryPage({ scope }: { scope: DocumentScope }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const personal = scope === 'PERSONAL';
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [action, setAction] = useState<{ type: 'rename' | 'delete'; document: StudyDocument } | null>(null);
  const [notice, setNotice] = useState('');
  const query = useQuery({ queryKey: ['documents', user?.id, scope], queryFn: () => api.listDocuments({ scope }) });
  const docs = query.data ?? [];
  const subjects = [...new Set(docs.map(document => document.subject))].sort();
  const filtered = docs
    .filter(document => (subject === 'all' || document.subject === subject) && `${document.title} ${document.subject} ${document.description}`.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'progress' ? b.lastPage / b.pageCount - a.lastPage / a.pageCount : b.updatedAt.localeCompare(a.updatedAt));
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, maxPage);
  const visible = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const continuing = docs.find(document => document.lastPage > 0 && document.lastPage < document.pageCount);
  const actionMutation = useMutation({
    mutationFn: async ({ selected, title }: { selected: NonNullable<typeof action>; title: string }) => selected.type === 'rename' ? api.renameDocument(selected.document.id, title) : api.deleteDocument(selected.document.id),
    onSuccess: async (_, { selected }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
        queryClient.invalidateQueries({ queryKey: ['document'] }),
        queryClient.invalidateQueries({ queryKey: ['all-annotations'] }),
      ]);
      if (selected.type === 'delete') {
        queryClient.removeQueries({ queryKey: ['document-content', user?.id, selected.document.id] });
        queryClient.removeQueries({ queryKey: ['annotations', user?.id, selected.document.id] });
      }
      setNotice(selected.type === 'rename' ? 'Document renamed.' : 'Document and its annotations deleted.');
      setAction(null);
    },
  });

  function openAction(type: 'rename' | 'delete', document: StudyDocument) { actionMutation.reset(); setAction({ type, document }); }

  return <div className="library-page">
    <header className="page-heading library-heading"><div><div className="eyebrow">YOUR STUDY SPACE</div><h1>{personal ? 'My PDFs' : 'Shared library'}</h1><p>{personal ? 'A little space for everything you’re learning.' : 'Good resources. Deeper understanding. Start here.'}</p></div>{personal && <button className="btn btn-primary" onClick={() => setUploadOpen(true)}><Upload size={17} /> Upload PDF</button>}</header>
    <nav className="library-scope-nav" aria-label="Library collections"><Link to="/library" aria-current={!personal ? 'page' : undefined}><BookOpen size={16} /> Shared materials</Link><Link to="/my-pdfs" aria-current={personal ? 'page' : undefined}><FolderOpen size={16} /> My PDFs</Link></nav>
    {notice && <div className="library-notice" role="status"><Check size={16} /> {notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {!personal && <section className="library-welcome"><div><span className="eyebrow">LEARN AT YOUR OWN PACE</span><h2>Your next lightbulb moment<br />starts with a page.</h2><p>Explore curated materials, highlight what matters,<br className="desktop-break" /> and make every idea your own.</p><a href="#library-materials" className="welcome-link">Explore the library <ArrowRight size={16} /></a></div><div className="book-illustration" aria-hidden="true"><div className="illustration-orbit" /><div className="illustration-book book-back"><span>DISCOVER</span></div><div className="illustration-book book-front"><BookOpen size={45} strokeWidth={1.2} /><span>A LITTLE<br />MORE CURIOUS.</span><i /></div><div className="illustration-star">✳</div></div></section>}
    {personal && <div className="personal-privacy"><LockKeyhole size={17} /><div><strong>Just for you.</strong> Your uploads, highlights, and notes are private to your demo account.</div></div>}
    {continuing && <section className="continue-reading"><div className="continue-icon"><BookOpen size={23} /></div><div><span>Pick up where you left off</span><h2>{continuing.title}</h2><p>Page {continuing.lastPage} of {continuing.pageCount} · {continuing.annotationCount} annotations</p></div><Link className="btn btn-secondary" to={`/reader/${continuing.id}`}>Continue reading <ArrowRight size={16} /></Link></section>}
    <section id="library-materials" className="library-materials" aria-label={personal ? 'Personal documents' : 'Shared materials'}>
      <div className="materials-title"><h2>{personal ? 'Your documents' : 'All materials'} <span>{docs.length}</span></h2><div className="view-toggle" aria-label="Document view"><button className={view === 'grid' ? 'active' : ''} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></button></div></div>
      <div className="library-filters"><label className="library-search"><Search size={18} /><input aria-label="Search documents" placeholder="Search by title, subject, or keyword…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><select className="field" aria-label="Filter by subject" value={subject} onChange={event => { setSubject(event.target.value); setPage(1); }}><option value="all">All subjects</option>{subjects.map(value => <option key={value}>{value}</option>)}</select><select className="field" aria-label="Sort documents" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently updated</option><option value="title">Title: A to Z</option><option value="progress">Reading progress</option></select></div>
      {query.isPending ? <div className="document-grid" aria-label="Loading documents">{[1, 2, 3, 4].map(key => <div className="document-skeleton" key={key}><div /><i /><i /><i /></div>)}</div> : query.isError ? <div className="empty-state"><FolderOpen size={36} /><h3>We couldn’t load your library</h3><p>{query.error.message}</p><button className="btn btn-primary" onClick={() => void query.refetch()}>Try again</button></div> : visible.length === 0 ? <div className="empty-state library-empty"><FileText size={38} /><h3>{docs.length ? 'No matching materials' : personal ? 'Make room for your next big idea' : 'Your library is on its way'}</h3><p>{docs.length ? 'Try another title or subject.' : personal ? 'Upload your first PDF and start making it your own.' : 'Published study materials will appear here.'}</p>{docs.length ? <button className="btn btn-secondary" onClick={() => { setSearch(''); setSubject('all'); }}>Clear filters</button> : personal && <button className="btn btn-primary" onClick={() => setUploadOpen(true)}><Upload size={16} /> Upload PDF</button>}</div> : <div className={`document-grid ${view === 'list' ? 'document-list' : ''}`}>{visible.map(document => <DocumentCard key={document.id} document={document} onRename={personal ? document => openAction('rename', document) : undefined} onDelete={personal ? document => openAction('delete', document) : undefined} />)}</div>}
      {filtered.length > 0 && <div className="library-pagination"><span>Showing {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, filtered.length)} of {filtered.length} materials</span>{maxPage > 1 && <div><button className="btn btn-icon" aria-label="Previous page" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}><ChevronLeft size={17} /></button><span>{activePage} / {maxPage}</span><button className="btn btn-icon" aria-label="Next page" disabled={activePage === maxPage} onClick={() => setPage(activePage + 1)}><ChevronRight size={17} /></button></div>}</div>}
    </section>
    {uploadOpen && <UploadDialog scope="PERSONAL" onClose={() => setUploadOpen(false)} onUploaded={() => { setNotice('Your PDF is ready to read.'); setUploadOpen(false); }} />}
    {action && <DocumentDialog type={action.type} document={action.document} pending={actionMutation.isPending} error={actionMutation.error?.message} onClose={() => setAction(null)} onSubmit={title => actionMutation.mutate({ selected: action, title })} />}
  </div>;
}
