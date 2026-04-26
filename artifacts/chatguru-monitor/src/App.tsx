import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { Conversations } from "@/pages/conversations";
import { CheckStatus } from "@/pages/check-status";
import { Reengagement } from "@/pages/reengagement";
import { Team } from "@/pages/team";
import { Numbers } from "@/pages/numbers";
import { TagsPage } from "@/pages/tags-page";
import { Alerts } from "@/pages/alerts";
import { Summaries } from "@/pages/summaries";
import NotFound from "@/pages/not-found";
import React, { useState, useEffect, useCallback } from "react";
import { SearchModal } from "@/components/search-modal";
import { LeadModal } from "@/components/lead-modal";

const queryClient = new QueryClient();

function Router() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<number | null>(null);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelectLead = (id: number) => {
    setSelectedLead(id);
  };

  return (
    <Layout onSearch={openSearch}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/check" component={CheckStatus} />
        <Route path="/reengagement" component={Reengagement} />
        <Route path="/team" component={Team} />
        <Route path="/numbers" component={Numbers} />
        <Route path="/tags" component={TagsPage} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/summaries" component={Summaries} />
        <Route component={NotFound} />
      </Switch>
      <SearchModal open={searchOpen} onClose={closeSearch} onSelect={handleSelectLead} />
      <LeadModal leadId={selectedLead} onClose={() => setSelectedLead(null)} />
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
