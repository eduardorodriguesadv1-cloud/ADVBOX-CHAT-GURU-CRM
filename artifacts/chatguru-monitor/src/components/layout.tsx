import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquareText, Search, SendHorizonal, Users, Smartphone, Tag, Moon, Sun, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useBrowserNotifications } from "@/hooks/use-notifications";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { requestPermission } = useBrowserNotifications();

  const navSections = [
    {
      label: "Principal",
      items: [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Conversas", href: "/conversations", icon: MessageSquareText },
        { name: "Reengajamento", href: "/reengagement", icon: SendHorizonal },
      ],
    },
    {
      label: "Configuração",
      items: [
        { name: "Equipe", href: "/team", icon: Users },
        { name: "Números", href: "/numbers", icon: Smartphone },
        { name: "Tags", href: "/tags", icon: Tag },
        { name: "Consultar Número", href: "/check", icon: Search },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Sidebar */}
      <div className="w-64 border-r bg-sidebar flex-shrink-0 hidden md:flex md:flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground flex-1 min-w-0">
            <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground flex-shrink-0 text-sm font-bold">
              CG
            </div>
            <span className="truncate">Monitor</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {navSections.map(section => (
            <div key={section.label}>
              <div className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-2">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer sidebar: dark mode + notification */}
        <div className="px-4 py-3 border-t border-sidebar-border flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="flex items-center justify-center w-9 h-9 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={requestPermission}
            title="Ativar notificações"
            className="flex items-center justify-center w-9 h-9 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
          <span className="text-xs text-sidebar-foreground/30 ml-auto">v1.0</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0 md:hidden">
          <div className="font-bold text-base text-foreground flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              CG
            </div>
            Monitor
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
