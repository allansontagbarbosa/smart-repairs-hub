import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Assistencia from "./pages/Assistencia";
import FluxoAssistencia from "./pages/FluxoAssistencia";

import Pecas from "./pages/Pecas";
import AparelhosAssistencia from "./pages/AparelhosAssistencia";
import Configuracoes from "./pages/Configuracoes";
import Financeiro from "./pages/Financeiro";
import Clientes from "./pages/Clientes";
import ConsultaCliente from "./pages/ConsultaCliente";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { AuthGuard } from "@/components/AuthGuard";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalOrdemDetalhe from "./pages/portal/PortalOrdemDetalhe";
import PortalResetPassword from "./pages/portal/PortalResetPassword";

const queryClient = new QueryClient();

function PortalGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public client lookup — no auth */}
            <Route path="/consulta" element={<ConsultaCliente />} />

            {/* Portal do Cliente */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/reset-password" element={<PortalResetPassword />} />
            <Route path="/portal" element={<PortalGuard><PortalDashboard /></PortalGuard>} />
            <Route path="/portal/ordem/:id" element={<PortalGuard><PortalOrdemDetalhe /></PortalGuard>} />

            {/* Login interno */}
            <Route path="/login" element={<Login />} />

            {/* Internal system with sidebar */}
            <Route path="*" element={
              <AuthGuard>
                <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/assistencia" element={<Assistencia />} />
                  <Route path="/assistencia/fluxo" element={<FluxoAssistencia />} />
                  
                  <Route path="/aparelhos" element={<AparelhosAssistencia />} />
                  <Route path="/pecas" element={<Pecas />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
              </AuthGuard>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
