import { useState } from "react";
import { Plus, Search, Phone } from "lucide-react";
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
      email: fd.get("email") as string,
      orders: 0,
      lastVisit: new Date().toLocaleDateString("pt-BR"),
    };
    setClients([newClient, ...clients]);
    setDialogOpen(false);
    toast.success("Cliente cadastrado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{clients.length} clientes cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4">
              <div><Label>Nome</Label><Input name="name" required placeholder="Nome completo" /></div>
              <div><Label>Telefone</Label><Input name="phone" required placeholder="(00) 00000-0000" /></div>
              <div><Label>Email</Label><Input name="email" type="email" placeholder="email@exemplo.com" /></div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <div key={client.id} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{client.name}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{client.phone}</span>
                </div>
              </div>
              <span className="text-xs bg-muted px-2 py-1 rounded-full">{client.orders} OS</span>
            </div>
            {client.email && (
              <p className="text-xs text-muted-foreground mt-2">{client.email}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">Última visita: {client.lastVisit}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">Nenhum cliente encontrado</p>
        )}
      </div>
    </div>
  );
}
