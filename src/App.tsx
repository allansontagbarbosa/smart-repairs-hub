import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Cadastro from "./pages/Cadastro";
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
import AceitarConvite from "./pages/AceitarConvite";
import Onboarding from "./pages/Onboarding";
import Unsubscribe from "./pages/Unsubscribe";

// Lojista B2B
import LojistaLogin from "./pages/lojista/LojistaLogin";
import LojistaRecuperarSenha from "./pages/lojista/LojistaRecuperarSenha";
import LojistaRedefinirSenha from "./pages/lojista/LojistaRedefinirSenha";
import AceitarConviteLojista from "./pages/lojista/AceitarConviteLojista";
import LojistaLayout from "./pages/lojista/LojistaLayout";
import LojistaDashboard from "./pages/lojista/LojistaDashboard";
import LojistaAparelhos from "./pages/lojista/LojistaAparelhos";
import LojistaFinanceiro from "./pages/lojista/LojistaFinanceiro";
import LojistaGarantias from "./pages/lojista/LojistaGarantias";
import LojistaHistorico from "./pages/lojista/LojistaHistorico";
import { LojistaGuard } from "@/hooks/useLojistaAuth";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <EmpresaProvider>
          <BrowserRouter>
            <Routes>
              {/* Landing page pública */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/cadastro" element={<Cadastro />} />

              {/* Public client lookup — no auth */}
              <Route path="/consulta" element={<ConsultaCliente />} />

              {/* Portal do Cliente — public routes */}
              <Route path="/portal/login" element={<PortalLogin />} />
              <Route path="/portal/reset-password" element={<PortalResetPassword />} />
              <Route path="/portal" element={<PortalDashboard />} />
              <Route path="/portal/ordem/:id" element={<PortalOrdemDetalhe />} />

              {/* Portal Lojista B2B */}
              <Route path="/lojista/login" element={<LojistaLogin />} />
              <Route path="/lojista/recuperar-senha" element={<LojistaRecuperarSenha />} />
              <Route path="/lojista/redefinir-senha" element={<LojistaRedefinirSenha />} />
              <Route path="/lojista/aceitar-convite" element={<AceitarConviteLojista />} />
              <Route path="/lojista" element={<LojistaGuard><LojistaLayout><LojistaDashboard /></LojistaLayout></LojistaGuard>} />
              <Route path="/lojista/dashboard" element={<Navigate to="/lojista" replace />} />
              <Route path="/lojista/aparelhos" element={<LojistaGuard><LojistaLayout><LojistaAparelhos /></LojistaLayout></LojistaGuard>} />
              <Route path="/lojista/financeiro" element={<LojistaGuard><LojistaLayout><LojistaFinanceiro /></LojistaLayout></LojistaGuard>} />
              <Route path="/lojista/garantias" element={<LojistaGuard><LojistaLayout><LojistaGarantias /></LojistaLayout></LojistaGuard>} />
              <Route path="/lojista/historico" element={<LojistaGuard><LojistaLayout><LojistaHistorico /></LojistaLayout></LojistaGuard>} />

              {/* Login e onboarding */}
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/aceitar-convite" element={<AceitarConvite />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />

              {/* Internal system with sidebar */}
              <Route path="*" element={
                <AuthGuard>
                  <AppLayout>
                  <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute permissao="dashboard"><Dashboard /></ProtectedRoute>} />
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
                    <Route path="/configuracoes/:aba" element={<ProtectedRoute permissao="configuracoes"><Configuracoes /></ProtectedRoute>} />
                    <Route path="/sem-acesso" element={<SemAcesso />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
                </AuthGuard>
              } />
            </Routes>
          </BrowserRouter>
        </EmpresaProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
