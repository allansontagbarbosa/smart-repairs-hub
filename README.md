# Smart Repairs Hub

Sistema de gestão para assistência técnica de dispositivos móveis. Inclui controle de ordens de serviço, estoque de peças, financeiro, comissões de técnicos e portal do cliente.

## Tecnologias

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — autenticação, banco de dados, edge functions
- **Integração**: API IMEI.info para identificação automática de aparelhos

## Configuração

1. Clone o repositório:
   ```bash
   git clone <url-do-repositório>
   cd smart-repairs-hub
   ```

2. Copie o arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```

3. Preencha o `.env` com suas credenciais do Supabase:
   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key-aqui
   VITE_SUPABASE_PROJECT_ID=seu-project-id
   ```

4. Instale as dependências e inicie:
   ```bash
   npm install
   npm run dev
   ```

> ⚠️ **Nunca commite o arquivo `.env` com credenciais reais.** Use `.env.example` como referência.

### Login com Google (Portal do Cliente)

Para habilitar o login com Google no portal do cliente:

1. Acesse o painel do Supabase → **Authentication** → **Providers** → **Google**
2. Ative o provider
3. Configure o **Client ID** e **Client Secret** obtidos no [Google Cloud Console](https://console.cloud.google.com/)
4. Adicione as URLs de redirecionamento autorizadas conforme indicado no painel do Supabase

## Estrutura

- `/src/pages` — Páginas do sistema (Dashboard, Assistência, Financeiro, etc.)
- `/src/components` — Componentes reutilizáveis
- `/src/hooks` — Custom hooks para dados e lógica de negócio
- `/src/contexts` — Contextos (autenticação)
- `/src/pages/portal` — Portal do cliente (login, consulta de OS)
- `/supabase/functions` — Edge functions (ex: IMEI lookup)
