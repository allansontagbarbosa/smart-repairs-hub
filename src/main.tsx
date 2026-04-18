import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";

// Redirect automático do preview Lovable para o domínio de produção.
// Usuários que acessarem a URL *.lovableproject.com são enviados para
// mobilefix.dev preservando path/query/hash. Use ?preview na URL para
// editar no Lovable sem ser redirecionado.
const PRODUCTION_DOMAIN =
  (import.meta.env.VITE_PRODUCTION_DOMAIN as string | undefined) ?? "mobilefix.dev";
const hostname = window.location.hostname;
const isPreview = hostname.endsWith(".lovableproject.com");
const isDev = hostname === "localhost" || hostname === "127.0.0.1";
const temBypass = new URLSearchParams(window.location.search).has("preview");

if (isPreview && !isDev && !temBypass) {
  const novaUrl = `https://${PRODUCTION_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(novaUrl);
  // Interrompe a renderização durante o redirect.
  throw new Error("Redirecionando para produção...");
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
