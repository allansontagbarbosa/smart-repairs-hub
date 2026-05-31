import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { WorkspaceModeProvider } from "@/contexts/WorkspaceModeContext";
import { LojistaProvider } from "@/contexts/LojistaContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import OnboardingWizard from "./pages/auth/OnboardingWizard";
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
import RedefinirSenha from "./pages/RedefinirSenha";
import { AuthGuard } from "@/components/AuthGuard";
import { PerfilGuard } from "@/components/PerfilGuard";
import { SocioGuard } from "@/components/SocioGuard";
import PainelSocio from "./pages/PainelSocio";
import PainelSocioContas from "./pages/PainelSocioContas";

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
import Cashback from "./pages/Cashback";
import CashbackCliente from "./pages/CashbackCliente";
import CashbackCustoOperacional from "./pages/CashbackCustoOperacional";
import MeuCashback from "./pages/MeuCashback";
import AdminResetSenhaLojista from "./pages/AdminResetSenhaLojista";

// Módulo Loja
import { ModuloLojaGuard } from "@/components/ModuloLojaGuard";
import LojaDashboard from "@/pages/loja/LojaDashboard";
import LojaPDV from "@/pages/loja/LojaPDV";
import LojaVendas from "@/pages/loja/LojaVendas";
import LojaAparelhos from "@/pages/loja/LojaAparelhos";
import LojaCompras from "@/pages/loja/LojaCompras";
import LojaTradeIn from "@/pages/loja/LojaTradeIn";
import LojaCrediario from "@/pages/loja/LojaCrediario";
import LojaClientes from "@/pages/loja/LojaClientes";
import LojaVendedores from "@/pages/loja/LojaVendedores";
import LojaMetas from "@/pages/loja/LojaMetas";
import LojaTV from "@/pages/loja/LojaTV";
import LojaFinanceiro from "@/pages/loja/LojaFinanceiro";
import LojaRelatorios from "@/pages/loja/LojaRelatorios";
import LojaConfiguracoes from "@/pages/loja/LojaConfiguracoes";
import LojaPainelSocio from "@/pages/loja/LojaPainelSocio";
import ComboDashboard from "@/pages/combo/ComboDashboard";
import ComboPainelSocio from "@/pages/combo/ComboPainelSocio";
import { ModuloComboGuard } from "@/components/ModuloComboGuard";

// Módulo Atacado
import { ModuloAtacadoGuard } from "@/components/ModuloAtacadoGuard";
import AtacadoDashboard from "@/pages/atacado/AtacadoDashboard";
import AtacadoPedidos from "@/pages/atacado/AtacadoPedidos";
import AtacadoPedidoDetalhe from "@/pages/atacado/AtacadoPedidoDetalhe";
import AtacadoNovoPedido from "@/pages/atacado/AtacadoNovoPedido";
import AtacadoClientes from "@/pages/atacado/AtacadoClientes";
import AtacadoAparelhos from "@/pages/atacado/AtacadoAparelhos";
import AtacadoTabelasPreco from "@/pages/atacado/AtacadoTabelasPreco";
import AtacadoVendedores from "@/pages/atacado/AtacadoVendedores";
import AtacadoMetas from "@/pages/atacado/AtacadoMetas";
import AtacadoFinanceiro from "@/pages/atacado/AtacadoFinanceiro";
import AtacadoCobranca from "@/pages/atacado/AtacadoCobranca";
import AtacadoRelatorios from "@/pages/atacado/AtacadoRelatorios";
import AtacadoCatalogoPublico from "@/pages/atacado/AtacadoCatalogoPublico";
import AtacadoConfiguracoes from "@/pages/atacado/AtacadoConfiguracoes";
import CatalogoPublico from "@/pages/publico/CatalogoPublico";



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
        <LojistaProvider>
        <EmpresaProvider>
          <BrowserRouter>
            <WorkspaceModeProvider>
            <Routes>
              {/* Landing page pública */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/cadastro" element={<OnboardingWizard />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route path="/catalogo/:slug" element={<CatalogoPublico />} />

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

              {/* Telão Loja — fullscreen, sem AppLayout */}
              <Route path="/loja/tv" element={<AuthGuard><ModuloLojaGuard><LojaTV /></ModuloLojaGuard></AuthGuard>} />

              {/* Portal do Técnico */}
              <Route path="/tecnico" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoHome /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/ordens" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoOrdens /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/ordens/:id" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoOrdemDetalhe /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/comissoes" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoComissoes /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/os" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoOrdens /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/os/:id" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoOrdemDetalhe /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/metas" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoMetas /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/transferencias" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoTransferencias /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />
              <Route path="/tecnico/historico" element={<PerfilGuard perfis={PERFIS_TECNICO}><TecnicoGuard><TecnicoLayout><TecnicoHistorico /></TecnicoLayout></TecnicoGuard></PerfilGuard>} />

              {/* Internal system with sidebar */}
              {/* Painel do Sócio — acessível a qualquer user que esteja na tabela socios */}
              <Route path="/painel-socio" element={
                <AuthGuard>
                  <SocioGuard>
                    <AppLayout>
                      <PainelSocio />
                    </AppLayout>
                  </SocioGuard>
                </AuthGuard>
              } />
              <Route path="/painel-socio/contas" element={
                <AuthGuard>
                  <SocioGuard>
                    <AppLayout>
                      <PainelSocioContas />
                    </AppLayout>
                  </SocioGuard>
                </AuthGuard>
              } />

              {/* Internal system with sidebar */}
              <Route path="*" element={
                <PerfilGuard perfis={PERFIS_ADMIN}>
                <AuthGuard>
                  <AppLayout>
                  <Routes>
                    <Route path="/dashboard" element={<ProtectedRoute permissao="dashboard"><Dashboard /></ProtectedRoute>} />
                    <Route path="/assistencia" element={<ProtectedRoute permissao="assistencia.ver"><Assistencia /></ProtectedRoute>} />
                    <Route path="/assistencia/exclusao-canceladas" element={<ProtectedRoute permissao="assistencia.excluir"><ExclusaoOSCanceladas /></ProtectedRoute>} />
                    <Route path="/assistencia/fluxo" element={<ProtectedRoute permissao="assistencia.ver"><FluxoAssistencia /></ProtectedRoute>} />
                    <Route path="/assistencia/fila-ia" element={<ProtectedRoute permissao="fila_ia"><FilaIA /></ProtectedRoute>} />
                    <Route path="/aparelhos" element={<ProtectedRoute permissao="aparelhos.ver"><AparelhosAssistencia /></ProtectedRoute>} />
                    <Route path="/pecas" element={<ProtectedRoute permissao="pecas.ver"><Pecas /></ProtectedRoute>} />
                    <Route path="/financeiro" element={<ProtectedRoute permissao="financeiro.ver"><Financeiro /></ProtectedRoute>} />
                    <Route path="/financeiro/faturas-lojistas" element={<ProtectedRoute permissao="faturas_b2b.ver"><FaturasLojistas /></ProtectedRoute>} />
                    <Route path="/cashback" element={<ProtectedRoute permissao="financeiro.ver"><Cashback /></ProtectedRoute>} />
                    <Route path="/cashback/cliente/:id" element={<ProtectedRoute permissao="financeiro.ver"><CashbackCliente /></ProtectedRoute>} />
                    <Route path="/configuracoes/cashback/custo-operacional" element={<ProtectedRoute permissao="financeiro.ver"><CashbackCustoOperacional /></ProtectedRoute>} />
                    <Route path="/meu-cashback" element={<MeuCashback />} />
                    <Route path="/clientes" element={<ProtectedRoute permissao="clientes.ver"><Clientes /></ProtectedRoute>} />
                    <Route path="/clientes/:id" element={<ProtectedRoute permissao="clientes.ver"><ClientePerfil /></ProtectedRoute>} />
                    <Route path="/fornecedores" element={<ProtectedRoute permissao="fornecedores.ver"><Fornecedores /></ProtectedRoute>} />
                    <Route path="/compras" element={<ProtectedRoute permissao="compras.ver"><Compras /></ProtectedRoute>} />
                    <Route path="/relatorios" element={<ProtectedRoute permissao="relatorios"><Relatorios /></ProtectedRoute>} />
                    <Route path="/tecnicos/desempenho" element={<ProtectedRoute permissao="desempenho_tecnicos"><DesempenhoTecnicos /></ProtectedRoute>} />
                    <Route path="/metas" element={<ProtectedRoute permissao="metas.ver"><Metas /></ProtectedRoute>} />
                    <Route path="/metas/nova" element={<ProtectedRoute permissao="metas.criar"><MetaNova /></ProtectedRoute>} />
                    <Route path="/metas/historico" element={<ProtectedRoute permissao="metas.ver"><MetasHistorico /></ProtectedRoute>} />
                    <Route path="/metas/:id" element={<ProtectedRoute permissao="metas.ver"><MetaDetalhe /></ProtectedRoute>} />
                    <Route path="/rh" element={<ProtectedRoute permissao="rh.ver"><RH /></ProtectedRoute>} />
                    <Route path="/rh/gerenciar" element={<ProtectedRoute permissao="rh.editar"><RHGerenciarFuncionarios /></ProtectedRoute>} />
                    <Route path="/rh/importar-ponto" element={<ProtectedRoute permissao="rh.editar"><RHImportPonto /></ProtectedRoute>} />
                    <Route path="/rh/folha-mensal" element={<ProtectedRoute permissao="rh.ver"><RHFolhaMensal /></ProtectedRoute>} />
                    <Route path="/rh/:id" element={<ProtectedRoute permissao="rh.ver"><RHFuncionario /></ProtectedRoute>} />
                    <Route path="/configuracoes" element={<ProtectedRoute permissao="configuracoes"><Configuracoes /></ProtectedRoute>} />
                    <Route path="/configuracoes/:aba" element={<ProtectedRoute permissao="configuracoes"><Configuracoes /></ProtectedRoute>} />
                    <Route path="/tv/configurar" element={<ProtectedRoute permissao="paineis_tv"><TVConfigurar /></ProtectedRoute>} />
                    <Route path="/tv/editar/:painelId" element={<ProtectedRoute permissao="paineis_tv"><TVEditarLayout /></ProtectedRoute>} />
                    <Route path="/assistente" element={<Assistente />} />
                    <Route path="/notificacoes" element={<NotificacoesPage />} />
                    <Route path="/admin/lojistas/resetar-senha" element={<ProtectedRoute permissao="configuracoes"><AdminResetSenhaLojista /></ProtectedRoute>} />
                    <Route path="/sem-acesso" element={<SemAcesso />} />

                    {/* Módulo Loja — protegido por ModuloLojaGuard */}
                    <Route path="/loja/dashboard" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_dashboard"><LojaDashboard /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/pdv" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_pdv"><LojaPDV /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/vendas" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_vendas"><LojaVendas /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/aparelhos" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_aparelhos"><LojaAparelhos /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/compras" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_compras"><LojaCompras /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/trade-in" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_trade_in"><LojaTradeIn /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/crediario" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_crediario"><LojaCrediario /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/clientes" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_clientes"><LojaClientes /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/vendedores" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_vendedores"><LojaVendedores /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/metas" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_metas"><LojaMetas /></ProtectedRoute></ModuloLojaGuard>} />
                    {/* /loja/tv é rota fullscreen — declarada fora do AppLayout */}
                    <Route path="/loja/financeiro" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_financeiro"><LojaFinanceiro /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/relatorios" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_relatorios"><LojaRelatorios /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/configuracoes" element={<ModuloLojaGuard><ProtectedRoute permissao="loja_configuracoes"><LojaConfiguracoes /></ProtectedRoute></ModuloLojaGuard>} />
                    <Route path="/loja/painel-socio" element={<ModuloLojaGuard><LojaPainelSocio /></ModuloLojaGuard>} />
                    <Route path="/combo/dashboard" element={<ModuloComboGuard><ComboDashboard /></ModuloComboGuard>} />
                    <Route path="/combo/painel-socio" element={<ModuloComboGuard><ComboPainelSocio /></ModuloComboGuard>} />

                    {/* Módulo Atacado */}
                    <Route path="/atacado/dashboard" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_dashboard.ver"><AtacadoDashboard /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/pedidos" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_pedidos.ver"><AtacadoPedidos /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/pedidos/:id" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_pedidos.ver"><AtacadoPedidoDetalhe /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/novo-pedido" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_pedidos.editar"><AtacadoNovoPedido /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/clientes" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_clientes.ver"><AtacadoClientes /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/aparelhos" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_aparelhos.ver"><AtacadoAparelhos /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/tabelas-preco" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_tabelas_preco.ver"><AtacadoTabelasPreco /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/vendedores" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_vendedores.ver"><AtacadoVendedores /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/metas" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_metas.ver"><AtacadoMetas /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/financeiro" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_financeiro.ver"><AtacadoFinanceiro /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/cobranca" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_cobranca.ver"><AtacadoCobranca /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/relatorios" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_relatorios.ver"><AtacadoRelatorios /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/catalogo-publico" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_configuracoes.editar"><AtacadoCatalogoPublico /></ProtectedRoute></ModuloAtacadoGuard>} />
                    <Route path="/atacado/configuracoes" element={<ModuloAtacadoGuard><ProtectedRoute permissao="atacado_configuracoes.editar"><AtacadoConfiguracoes /></ProtectedRoute></ModuloAtacadoGuard>} />

                    <Route path="*" element={<NotFound />} />

                  </Routes>
                </AppLayout>
                </AuthGuard>
                </PerfilGuard>
              } />
            </Routes>
            </WorkspaceModeProvider>
          </BrowserRouter>
        </EmpresaProvider>
        </LojistaProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
