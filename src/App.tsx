import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Assistencia from "./pages/Assistencia";
import FluxoAssistencia from "./pages/FluxoAssistencia";
import FilaIA from "./pages/FilaIA";
import Pecas from "./pages/Pecas";
import AparelhosAssistencia from "./pages/AparelhosAssistencia";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import Financeiro from "./pages/Financeiro";
import Clientes from "./pages/Clientes";
import Fornecedores from "./pages/Fornecedores";
import ConsultaCliente from "./pages/ConsultaCliente";
import NotFound from "./pages/NotFound";
import SemAcesso from "./pages/SemAcesso";
import Login from "./pages/Login";
import { AuthGuard } from "@/components/AuthGuard";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalOrdemDetalhe from "./pages/portal/PortalOrdemDetalhe";
import PortalResetPassword from "./pages/portal/PortalResetPassword";

const queryClient = new QueryClient();

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

            {/* Portal do Cliente — public routes, no auth required */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/reset-password" element={<PortalResetPassword />} />
            <Route path="/portal" element={<PortalDashboard />} />
            <Route path="/portal/ordem/:id" element={<PortalOrdemDetalhe />} />

            {/* Login interno */}
            <Route path="/login" element={<Login />} />

            {/* Internal system with sidebar */}
            <Route path="*" element={
              <AuthGuard>
                <AppLayout>
                <Routes>
                  <Route path="/" element={<ProtectedRoute permissao="dashboard"><Dashboard /></ProtectedRoute>} />
                  <Route path="/assistencia" element={<ProtectedRoute permissao="assistencia.ver"><Assistencia /></ProtectedRoute>} />
                  <Route path="/assistencia/fluxo" element={<ProtectedRoute permissao="assistencia.ver"><FluxoAssistencia /></ProtectedRoute>} />
                  <Route path="/assistencia/fila-ia" element={<ProtectedRoute permissao="fila_ia"><FilaIA /></ProtectedRoute>} />
                  <Route path="/aparelhos" element={<ProtectedRoute permissao="assistencia.ver"><AparelhosAssistencia /></ProtectedRoute>} />
                  <Route path="/pecas" element={<ProtectedRoute permissao="pecas.ver"><Pecas /></ProtectedRoute>} />
                  <Route path="/financeiro" element={<ProtectedRoute permissao="financeiro.ver"><Financeiro /></ProtectedRoute>} />
                  <Route path="/clientes" element={<ProtectedRoute permissao="clientes.ver"><Clientes /></ProtectedRoute>} />
                  <Route path="/fornecedores" element={<ProtectedRoute permissao="pecas.ver"><Fornecedores /></ProtectedRoute>} />
                  <Route path="/relatorios" element={<ProtectedRoute permissao="relatorios"><Relatorios /></ProtectedRoute>} />
                  <Route path="/configuracoes" element={<ProtectedRoute permissao="configuracoes"><Configuracoes /></ProtectedRoute>} />
                  <Route path="/sem-acesso" element={<SemAcesso />} />
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
