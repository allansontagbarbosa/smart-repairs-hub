import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { RelDRE } from "@/components/relatorios/RelDRE";
import { RelTecnicos } from "@/components/relatorios/RelTecnicos";
import { RelServicos } from "@/components/relatorios/RelServicos";
import { RelExportacao } from "@/components/relatorios/RelExportacao";
import { RelPrejuizos } from "@/components/relatorios/RelPrejuizos";

export default function Relatorios() {
  const [sp] = useSearchParams();
  const [activeTab, setActiveTab] = useState(sp.get("tab") ?? "dre");

  useEffect(() => {
    const tab = sp.get("tab");
    if (tab) setActiveTab(tab);
    if (sp.get("print") === "1" && tab === "dre") {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [sp]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 w-full">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análises financeiras, de técnicos e defeitos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex sm:grid sm:grid-cols-5 sm:max-w-2xl no-scrollbar">
          <TabsTrigger value="dre" className="shrink-0">DRE</TabsTrigger>
          <TabsTrigger value="tecnicos" className="shrink-0">Técnicos</TabsTrigger>
          <TabsTrigger value="defeitos" className="shrink-0">Serviços</TabsTrigger>
          <TabsTrigger value="prejuizos" className="shrink-0">Prejuízos</TabsTrigger>
          <TabsTrigger value="exportacao" className="shrink-0">Exportação</TabsTrigger>
        </TabsList>
        <TabsContent value="dre">
          <p className="text-[11px] text-muted-foreground mb-3 px-1">
            ⓘ A DRE também está disponível dentro de <strong>Financeiro → DRE</strong> pra acesso mais direto.
          </p>
          <RelDRE />
        </TabsContent>
        <TabsContent value="tecnicos"><RelTecnicos /></TabsContent>
        <TabsContent value="defeitos"><RelServicos /></TabsContent>
        <TabsContent value="prejuizos"><RelPrejuizos /></TabsContent>
        <TabsContent value="exportacao"><RelExportacao /></TabsContent>
      </Tabs>
    </div>
  );
}
