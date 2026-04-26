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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/check" component={CheckStatus} />
        <Route path="/reengagement" component={Reengagement} />
        <Route path="/team" component={Team} />
        <Route path="/numbers" component={Numbers} />
        <Route path="/tags" component={TagsPage} />
        <Route component={NotFound} />
      </Switch>
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
