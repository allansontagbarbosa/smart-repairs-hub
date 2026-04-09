import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Assistencia from "./pages/Assistencia";
import FluxoAssistencia from "./pages/FluxoAssistencia";
import Estoque from "./pages/Estoque";
import Financeiro from "./pages/Financeiro";
import Clientes from "./pages/Clientes";
import ConsultaCliente from "./pages/ConsultaCliente";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public client portal — no sidebar */}
          <Route path="/consulta" element={<ConsultaCliente />} />

          {/* Internal system with sidebar */}
          <Route path="*" element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/assistencia" element={<Assistencia />} />
                <Route path="/assistencia/fluxo" element={<FluxoAssistencia />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
