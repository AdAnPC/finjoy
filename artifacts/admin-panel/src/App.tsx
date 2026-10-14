import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import NewClient from '@/pages/NewClient';
import Loans from '@/pages/Loans';
import LoanDetail from '@/pages/LoanDetail';
import Payments from '@/pages/Payments';
import ApkDistribution from '@/pages/ApkDistribution';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/new" component={NewClient} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/loans" component={Loans} />
        <Route path="/loans/:id" component={LoanDetail} />
        <Route path="/payments" component={Payments} />
        <Route path="/apk" component={ApkDistribution} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
