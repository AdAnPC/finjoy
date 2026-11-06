import { useEffect, useState, FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';
import { ADMIN_KEY_STORAGE } from './main';

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

function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth/status');
        if (!res.ok) {
          if (active) setUnlocked(true);
          return;
        }
        const status = (await res.json()) as {
          required: boolean;
          configured: boolean;
        };
        if (!status.required) {
          if (active) setUnlocked(true);
          return;
        }
        if (active) setConfigured(status.configured);
        const saved = window.localStorage.getItem(ADMIN_KEY_STORAGE);
        if (saved && status.configured) {
          const verifyRes = await fetch('/api/admin/auth/verify', {
            method: 'POST',
            headers: { Authorization: `Bearer ${saved}` },
          });
          if (verifyRes.ok && active) {
            setUnlocked(true);
            return;
          }
        }
      } catch {
        if (active) setUnlocked(true);
      } finally {
        if (active) setChecking(false);
      }
    }
    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    try {
      const res = await fetch('/api/admin/auth/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || 'Clave administrativa inválida');
        return;
      }
      window.localStorage.setItem(ADMIN_KEY_STORAGE, trimmed);
      queryClient.clear();
      setUnlocked(true);
    } catch {
      setError('No se pudo verificar la clave con el servidor');
    }
  };

  if (checking) {
    return null;
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acceso Administrativo FinJoy</CardTitle>
          <CardDescription>
            {configured
              ? 'Ingresa la clave administrativa (ADMIN_API_KEY) para acceder al panel.'
              : 'Configura la variable de entorno ADMIN_API_KEY (mínimo 32 caracteres) en el servidor.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="ADMIN_API_KEY"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={!configured}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={!configured}>
              Entrar al Panel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminAuthGate>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </AdminAuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
