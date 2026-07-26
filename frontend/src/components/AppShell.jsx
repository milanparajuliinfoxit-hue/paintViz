import { NavLink, Outlet } from 'react-router-dom';
import { Palette, FolderKanban } from 'lucide-react';

const navItems = [
  { to: '/catalog', label: 'Color Catalog', icon: Palette },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

export default function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--pv-bg)]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--pv-border)] bg-[var(--pv-surface)]">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--pv-accent)] text-white font-bold text-sm">
            PV
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Paint Visualizer</span>
        </div>
        <nav className="flex flex-col gap-1 px-3 mt-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--pv-accent)]/10 text-[var(--pv-accent)]'
                    : 'text-[var(--pv-text-muted)] hover:bg-zinc-100 hover:text-[var(--pv-text)]'
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-[var(--pv-text-muted)]">
          Core visualization build · v1.0
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
