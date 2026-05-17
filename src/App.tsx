import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
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
import ExclusaoOSCanceladas from "./pages/ExclusaoOSCanceladas";
import FluxoAssistencia from "./pages/FluxoAssistencia";
import FilaIA from "./pages/FilaIA";
import Pecas from "./pages/Pecas";
import AparelhosAssistencia from "./pages/AparelhosAssistencia";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import Financeiro from "./pages/Financeiro";
import FaturasLojistas from "./pages/FaturasLojistas";
import Clientes from "./pages/Clientes";
import ClientePerfil from "./pages/ClientePerfil";
import Fornecedores from "./pages/Fornecedores";
import Compras from "./pages/Compras";
import ConsultaCliente from "./pages/ConsultaCliente";
import NotFound from "./pages/NotFound";
import SemAcesso from "./pages/SemAcesso";
import Login from "./pages/Login";
import { AuthGuard } from "@/components/AuthGuard";
import { PerfilGuard } from "@/components/PerfilGuard";

const PERFIS_ADMIN = ["Administrador", "Gerente", "Financeiro", "Atendimento"];
const PERFIS_TECNICO = ["Técnico"];
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalOrdemDetalhe from "./pages/portal/PortalOrdemDetalhe";
import PortalResetPassword from "./pages/portal/PortalResetPassword";
import AceitarConvite from "./pages/AceitarConvite";
import Onboarding from "./pages/Onboarding";
import Assistente from "./pages/Assistente";
import Unsubscribe from "./pages/Unsubscribe";
import DesempenhoTecnicos from "./pages/DesempenhoTecnicos";
import Metas from "./pages/Metas";
import MetaNova from "./pages/MetaNova";
import MetaDetalhe from "./pages/MetaDetalhe";
import MetasHistorico from "./pages/MetasHistorico";
import RH from "./pages/RH";
import RHFuncionario from "./pages/RHFuncionario";
import RHImportPonto from "./pages/RHImportPonto";
import RHFolhaMensal from "./pages/RHFolhaMensal";
import RHGerenciarFuncionarios from "./pages/RHGerenciarFuncionarios";
import NotificacoesPage from "./pages/Notificacoes";
import TVConfigurar from "./pages/TVConfigurar";
import TVAcesso from "./pages/TVAcesso";
import TVDisplay from "./pages/TVDisplay";
import TVEditarLayout from "./pages/TVEditarLayout";


// Lojista B2B (portal interno legacy — em desuso, mantido até confirmar 0 logins)
import LojistaLogin from "./pages/lojista/LojistaLogin";
import LojistaLayout from "./pages/lojista/LojistaLayout";
import LojistaDashboard from "./pages/lojista/LojistaDashboard";
import LojistaAparelhos from "./pages/lojista/LojistaAparelhos";
import LojistaFinanceiro from "./pages/lojista/LojistaFinanceiro";
import LojistaGarantias from "./pages/lojista/LojistaGarantias";
import LojistaHistorico from "./pages/lojista/LojistaHistorico";
import { LojistaGuard } from "@/hooks/useLojistaAuth";

// Portal do Técnico
import { TecnicoGuard, TecnicoLayout } from "@/components/tecnico/TecnicoLayout";
import TecnicoHome from "./pages/tecnico/TecnicoHome";
import TecnicoOrdens from "./pages/tecnico/TecnicoOrdens";
import TecnicoOrdemDetalhe from "./pages/tecnico/TecnicoOrdemDetalhe";
import TecnicoComissoes from "./pages/tecnico/TecnicoComissoes";
import TecnicoMetas from "./pages/tecnico/TecnicoMetas";
import TecnicoTransferencias from "./pages/tecnico/TecnicoTransferencias";
import TecnicoHistorico from "./pages/tecnico/TecnicoHistorico";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,       // 5 min: dados ficam "frescos" por mais tempo
      gcTime: 30 * 60_000,         // 30 min: cache permanece mais tempo após uso
      refetchOnWindowFocus: false, // NÃO refetch ao voltar pra aba (causava "reset" do app)
      refetchOnReconnect: true,    // mantém: refetch quando reconectar internet
      refetchOnMount: false,       // NÃO refetch sempre que componente monta — só se dados stale
      retry: 1,
    },
  },
});

function RedirectLegacyLojista() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const portalUrl = (import.meta.env.VITE_PORTAL_URL as string | undefined) ?? "https://portal.ditt.com.br";
  if (typeof window !== "undefined") {
    window.location.replace(token ? `${portalUrl}/login?legacy=1` : `${portalUrl}/login`);
  }
  return null;
}

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

              {/* Portal Lojista B2B (legacy) */}
              <Route path="/lojista/login" element={<LojistaLogin />} />
              {/* Rotas legacy de convite/senha — redirect pro portal novo */}
              <Route path="/lojista/aceitar-convite" element={<RedirectLegacyLojista />} />
              <Route path="/lojista/recuperar-senha" element={<RedirectLegacyLojista />} />
              <Route path="/lojista/redefinir-senha" element={<RedirectLegacyLojista />} />
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

              {/* Painéis TV (públicos — sem auth) */}
              <Route path="/tv" element={<TVAcesso />} />
              <Route path="/tv/d/:codigo" element={<TVDisplay />} />
              {/* Rota paralela pra validar mudanças (animações + realtime) sem afetar TVs em produção */}
              <Route path="/tv/preview/:codigo" element={<TVDisplay />} />

              {/* Portal do Técnico */}
              <Route path="/tecnico" element={<TecnicoGuard><TecnicoLayout><TecnicoHome /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/ordens" element={<TecnicoGuard><TecnicoLayout><TecnicoOrdens /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/ordens/:id" element={<TecnicoGuard><TecnicoLayout><TecnicoOrdemDetalhe /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/comissoes" element={<TecnicoGuard><TecnicoLayout><TecnicoComissoes /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/os" element={<TecnicoGuard><TecnicoLayout><TecnicoOrdens /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/os/:id" element={<TecnicoGuard><TecnicoLayout><TecnicoOrdemDetalhe /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/metas" element={<TecnicoGuard><TecnicoLayout><TecnicoMetas /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/transferencias" element={<TecnicoGuard><TecnicoLayout><TecnicoTransferencias /></TecnicoLayout></TecnicoGuard>} />
              <Route path="/tecnico/historico" element={<TecnicoGuard><TecnicoLayout><TecnicoHistorico /></TecnicoLayout></TecnicoGuard>} />

              {/* Internal system with sidebar */}
              <Route path="*" element={
                <AuthGuard>
                  <AppLayout>
                  <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute permissao="dashboard"><Dashboard /></ProtectedRoute>} />
                    <Route path="/assistencia" element={<ProtectedRoute permissao="assistencia.ver"><Assistencia /></ProtectedRoute>} />
                    <Route path="/assistencia/exclusao-canceladas" element={<ProtectedRoute permissao="assistencia.excluir"><ExclusaoOSCanceladas /></ProtectedRoute>} />
                    <Route path="/assistencia/fluxo" element={<ProtectedRoute permissao="assistencia.ver"><FluxoAssistencia /></ProtectedRoute>} />
                    <Route path="/assistencia/fila-ia" element={<ProtectedRoute permissao="fila_ia"><FilaIA /></ProtectedRoute>} />
                    <Route path="/aparelhos" element={<ProtectedRoute permissao="assistencia.ver"><AparelhosAssistencia /></ProtectedRoute>} />
                    <Route path="/pecas" element={<ProtectedRoute permissao="pecas.ver"><Pecas /></ProtectedRoute>} />
                    <Route path="/financeiro" element={<ProtectedRoute permissao="financeiro.ver"><Financeiro /></ProtectedRoute>} />
                    <Route path="/financeiro/faturas-lojistas" element={<ProtectedRoute permissao="financeiro.ver"><FaturasLojistas /></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute permissao="clientes.ver"><Clientes /></ProtectedRoute>} />
                    <Route path="/clientes/:id" element={<ProtectedRoute permissao="clientes.ver"><ClientePerfil /></ProtectedRoute>} />
                    <Route path="/fornecedores" element={<ProtectedRoute permissao="pecas.ver"><Fornecedores /></ProtectedRoute>} />
                    <Route path="/compras" element={<ProtectedRoute permissao="pecas.ver"><Compras /></ProtectedRoute>} />
                    <Route path="/relatorios" element={<ProtectedRoute permissao="relatorios"><Relatorios /></ProtectedRoute>} />
                    <Route path="/tecnicos/desempenho" element={<ProtectedRoute permissao="relatorios"><DesempenhoTecnicos /></ProtectedRoute>} />
                    <Route path="/metas" element={<ProtectedRoute permissao="relatorios"><Metas /></ProtectedRoute>} />
                    <Route path="/metas/nova" element={<ProtectedRoute permissao="relatorios"><MetaNova /></ProtectedRoute>} />
                    <Route path="/metas/historico" element={<ProtectedRoute permissao="relatorios"><MetasHistorico /></ProtectedRoute>} />
                    <Route path="/metas/:id" element={<ProtectedRoute permissao="relatorios"><MetaDetalhe /></ProtectedRoute>} />
                    <Route path="/rh" element={<RH />} />
                   <Route path="/rh/gerenciar" element={<RHGerenciarFuncionarios />} />
                   <Route path="/rh/importar-ponto" element={<RHImportPonto />} />
                   <Route path="/rh/folha-mensal" element={<RHFolhaMensal />} />
                    <Route path="/rh/:id" element={<RHFuncionario />} />
                    <Route path="/configuracoes" element={<ProtectedRoute permissao="configuracoes"><Configuracoes /></ProtectedRoute>} />
                    <Route path="/configuracoes/:aba" element={<ProtectedRoute permissao="configuracoes"><Configuracoes /></ProtectedRoute>} />
                    <Route path="/tv/configurar" element={<ProtectedRoute permissao="configuracoes"><TVConfigurar /></ProtectedRoute>} />
                    <Route path="/tv/editar/:painelId" element={<ProtectedRoute permissao="configuracoes"><TVEditarLayout /></ProtectedRoute>} />
                    <Route path="/assistente" element={<Assistente />} />
                    <Route path="/notificacoes" element={<NotificacoesPage />} />
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
