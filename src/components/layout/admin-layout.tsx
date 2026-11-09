"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Layers,
  Tags,
  Settings,
  CreditCard,
  ClipboardList,
  MessageSquare,
  MonitorDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { LogoSplit } from "@/components/ui/logo";
import { useAdminSession } from "@/components/layout/admin-session-provider";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/plans", label: "Plans", icon: Package },
  { href: "/application-packages", label: "Application Packages", icon: Layers },
  { href: "/catalog", label: "Catalog", icon: Settings },
  { href: "/discounts", label: "Discounts", icon: Tags },
  { href: "/billing", label: "Billing Ops", icon: CreditCard },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/tickets", label: "Tickets", icon: MessageSquare },
  { href: "/downloads", label: "App Downloads", icon: MonitorDown },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openTickets, setOpenTickets] = useState(0);
  const session = useAdminSession();
  const user = session?.user;

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    const load = async () => {
      try {
        const { getAccessToken } = await import("@/lib/auth");
        const { admin } = await import("@/lib/api");
        const token = getAccessToken() || undefined;
        const s = await admin.getTicketsSummary(token);
        if (!cancelled) setOpenTickets(s.open || 0);
      } catch {
        // silently ignore — badge is non-critical
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const { logout } = await import("@/lib/api");
      const { getRefreshToken, getAccessToken, clearTokens } = await import("@/lib/auth");
      await logout(getRefreshToken() || "", getAccessToken() || "");
      clearTokens();
    } catch (err) {
      console.error(err);
      // force clear anyway
      const { clearTokens } = await import("@/lib/auth");
      clearTokens();
    }
    router.push("/login");
  };

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <Link href="/" onClick={() => setIsSidebarOpen(false)}>
            <LogoSplit className="h-8 w-auto" />
          </Link>
          <button 
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col justify-between h-[calc(100%-4rem)] p-4">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                  {item.label}
                  {item.href === "/tickets" && openTickets > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-white text-[10px] font-bold px-1">
                      {openTickets > 99 ? "99+" : openTickets}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-border mt-auto">
            {user && (
              <div className="mb-4 px-3 flex flex-col gap-1 overflow-hidden">
                <span className="text-sm font-medium truncate" title={user.email}>
                  {user.email}
                </span>
                <div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                    user.role === 'superadmin' ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-16 flex items-center px-4 border-b border-border bg-card lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 mr-4 text-muted-foreground hover:text-foreground rounded-md"
          >
            <Menu className="w-5 h-5" />
          </button>
          <LogoSplit className="h-7 w-auto" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
