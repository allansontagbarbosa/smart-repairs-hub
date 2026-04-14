import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { RelDRE } from "@/components/relatorios/RelDRE";
import { RelTecnicos } from "@/components/relatorios/RelTecnicos";
import { RelDefeitos } from "@/components/relatorios/RelDefeitos";
import { RelExportacao } from "@/components/relatorios/RelExportacao";

export default function Relatorios() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 w-full">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análises financeiras, de técnicos e defeitos</p>
        </div>
      </div>

      <Tabs defaultValue="dre" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="tecnicos">Técnicos</TabsTrigger>
          <TabsTrigger value="defeitos">Defeitos</TabsTrigger>
          <TabsTrigger value="exportacao">Exportação</TabsTrigger>
        </TabsList>
        <TabsContent value="dre"><RelDRE /></TabsContent>
        <TabsContent value="tecnicos"><RelTecnicos /></TabsContent>
        <TabsContent value="defeitos"><RelDefeitos /></TabsContent>
        <TabsContent value="exportacao"><RelExportacao /></TabsContent>
      </Tabs>
    </div>
  );
}
