import { useState } from "react";
import { Plus, Search, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Client = {
  id: number;
  name: string;
  phone: string;
  email: string;
  orders: number;
  lastVisit: string;
};

const initialClients: Client[] = [
  { id: 1, name: "Maria Silva", phone: "(11) 99999-1111", email: "maria@email.com", orders: 3, lastVisit: "07/04/2026" },
  { id: 2, name: "João Santos", phone: "(11) 98888-2222", email: "joao@email.com", orders: 1, lastVisit: "06/04/2026" },
  { id: 3, name: "Ana Costa", phone: "(11) 97777-3333", email: "ana@email.com", orders: 2, lastVisit: "08/04/2026" },
  { id: 4, name: "Pedro Lima", phone: "(11) 96666-4444", email: "pedro@email.com", orders: 5, lastVisit: "03/04/2026" },
  { id: 5, name: "Carla Souza", phone: "(11) 95555-5555", email: "carla@email.com", orders: 1, lastVisit: "08/04/2026" },
];

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const handleNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newClient: Client = {
      id: clients.length + 1,
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      email: (fd.get("email") as string) || "",
      orders: 0,
      lastVisit: new Date().toLocaleDateString("pt-BR"),
    };
    setClients([newClient, ...clients]);
    setDialogOpen(false);
    toast.success("Cliente cadastrado!");
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clients.length} cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4 mt-2">
              <div className="space-y-3">
                <div><Label className="text-xs">Nome</Label><Input name="name" required placeholder="Nome completo" className="mt-1.5" /></div>
                <div><Label className="text-xs">Telefone</Label><Input name="phone" required placeholder="(00) 00000-0000" className="mt-1.5" /></div>
                <div><Label className="text-xs">Email (opcional)</Label><Input name="email" type="email" placeholder="email@exemplo.com" className="mt-1.5" /></div>
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou telefone..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((client) => (
          <div key={client.id} className="stat-card group">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{client.name}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">{client.phone}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{client.email}</span>
                  </div>
                )}
              </div>
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-medium shrink-0">
                {client.orders} OS
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">Última visita: {client.lastVisit}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-10 text-sm">Nenhum cliente encontrado</p>
        )}
      </div>
    </div>
  );
}
