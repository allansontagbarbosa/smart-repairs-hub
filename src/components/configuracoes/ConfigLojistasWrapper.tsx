import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigLojistasTab } from "./ConfigLojistasTab";
import { ConfigGruposLojistasTab } from "./ConfigGruposLojistasTab";

export function ConfigLojistasWrapper() {
  const [tab, setTab] = useState("lojistas");
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="lojistas">Lojistas</TabsTrigger>
        <TabsTrigger value="grupos">Grupos</TabsTrigger>
      </TabsList>
      <TabsContent value="lojistas">
        <ConfigLojistasTab />
      </TabsContent>
      <TabsContent value="grupos">
        <ConfigGruposLojistasTab />
      </TabsContent>
    </Tabs>
  );
}
