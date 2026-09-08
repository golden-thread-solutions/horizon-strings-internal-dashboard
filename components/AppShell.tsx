import Link from "next/link";
import {
  Banknote,
  CheckSquare,
  Gauge,
  ListMusic,
  Music,
  Settings,
  Users,
  Zap
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/actions", label: "Action", icon: Zap },
  { href: "/clients", label: "Clients & events", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/musicians", label: "Musicians", icon: Music },
  { href: "/repertoire", label: "Repertoire", icon: ListMusic },
  { href: "/finance", label: "Finance", icon: Banknote },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HS</div>
          <div>
            <strong>Horizon Strings</strong>
            <span>Operations v0.5</span>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.href} className="nav-link">
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
