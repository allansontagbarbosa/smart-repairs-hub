export function abrirWhatsApp(telefone: string, mensagem: string) {
  const clean = telefone.replace(/\D/g, "");
  const full = clean.startsWith("55") ? clean : `55${clean}`;
  window.open(`https://wa.me/${full}?text=${encodeURIComponent(mensagem)}`, "_blank");
}
