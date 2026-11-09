import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, ChevronRight, Highlighter, Library, LogOut, Menu, Settings, ShieldCheck, Sprout, X } from 'lucide-react';
import { Logo } from '../../shared/ui/Logo';
import { useAuth } from '../../features/auth/AuthProvider';
import { isMockApi } from '../../shared/api';

export function AppShell() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const menu = menuRef.current;
    sidebarRef.current?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const viewport = window.matchMedia('(min-width: 801px)');
    const closeOnDesktop = () => { if (viewport.matches) setMobileOpen(false); };
    viewport.addEventListener('change', closeOnDesktop);
    return () => { viewport.removeEventListener('change', closeOnDesktop); menu?.focus(); };
  }, [mobileOpen]);
  const location = useLocation();
  const name = location.pathname.startsWith('/my-pdfs') ? 'My PDFs' : location.pathname.startsWith('/highlights') ? 'My highlights' : location.pathname.startsWith('/admin') ? 'Manage materials' : location.pathname.startsWith('/settings') ? 'Settings' : 'Shared library';
  const initials = user?.displayName.split(' ').map(v => v[0]).slice(0, 2).join('').toUpperCase();
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" tabIndex={-1} />}
    <aside id="workspace-navigation" ref={sidebarRef} className={`app-sidebar ${mobileOpen ? 'is-open' : ''}`} onKeyDown={event => {
      if (!mobileOpen) return;
      if (event.key === 'Escape') { setMobileOpen(false); return; }
      if (event.key !== 'Tab') return;
      const controls = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}><div className="sidebar-brand"><Logo /><button className="btn-icon mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="sidebar-section-label">YOUR STUDY SPACE</div><nav aria-label="Main navigation" onClick={() => setMobileOpen(false)}>
        <NavLink to="/library"><Library size={19} /><span>Shared library</span></NavLink><NavLink to="/my-pdfs"><BookOpen size={19} /><span>My PDFs</span></NavLink><NavLink to="/highlights"><Highlighter size={19} /><span>My highlights</span></NavLink>
        {user?.role === 'ADMIN' && <NavLink to="/admin"><ShieldCheck size={19} /><span>Manage materials</span></NavLink>}
      </nav><div className="sidebar-spacer" /><div className="study-tip"><span className="tip-icon"><Sprout size={22} /></span><h3>Small steps. Big ideas.</h3><p>A few focused pages today can make all the difference.</p><span className="tip-caption">KEEP YOUR CURIOSITY CLOSE</span></div>
      <nav className="secondary-nav" aria-label="Account navigation" onClick={() => setMobileOpen(false)}><NavLink to="/settings"><Settings size={18} /><span>Settings</span></NavLink></nav>
      <div className="sidebar-profile"><span className="avatar">{initials}</span><div><strong>{user?.displayName}</strong><span>{user?.role === 'ADMIN' ? 'Administrator' : 'Student account'}</span></div><button className="btn-icon" aria-label="Sign out" title="Sign out" onClick={async () => { try { await logout(); } catch { setError('Could not sign out. Please retry.'); } }}><LogOut size={17} /></button></div>{error && <p role="alert" className="alert alert-error">{error}</p>}
    </aside><div className="app-main" inert={mobileOpen}><header className="app-header"><div className="breadcrumb"><button ref={menuRef} className="btn-icon menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={mobileOpen}><Menu size={21} /></button><span className="breadcrumb-root">Workspace</span><ChevronRight size={13} /><strong>{name}</strong></div><div className="header-right">{isMockApi && <span className="demo-badge"><span />LOCAL DEMO</span>}<span className="header-divider" /><span className="avatar avatar-small">{initials}</span></div></header><main id="main-content" className="main-content"><Outlet /></main></div>
  </div>;
}
