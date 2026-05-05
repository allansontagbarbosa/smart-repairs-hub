// Shared password policy for edge functions that set user passwords.

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const SENHAS_COMUNS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyui", "qwertyuiop", "abc123456", "123abc123", "admin1234",
  "administrator", "welcome123", "letmein123", "iloveyou1", "trustno1!",
  "monkey1234", "dragon1234", "master1234", "shadow1234", "superman1",
  "starwars1", "computer1", "internet1", "football1", "baseball1",
  "ditt12345", "ditt123456", "mobilefix1", "mobilefix123", "bruspy123",
  "celular123", "tecnico123", "gerente123", "loja1234567", "assistencia1",
  "reparo1234", "iphone1234", "samsung123", "android12", "telefone1",
  "12345678a", "12345678!", "12345678a!", "abcdefghi", "abc123456",
  "senha1234", "senha12345", "senha@123", "mudar123!", "trocar123",
]);

export function validatePassword(senha: unknown): PasswordValidationResult {
  const errors: string[] = [];

  if (!senha || typeof senha !== "string") {
    return { valid: false, errors: ["Senha é obrigatória"] };
  }

  if (senha.length < 10) errors.push("A senha deve ter no mínimo 10 caracteres");
  if (senha.length > 128) errors.push("A senha não pode ter mais de 128 caracteres");
  if (!/[A-Z]/.test(senha)) errors.push("Inclua pelo menos uma letra maiúscula");
  if (!/[a-z]/.test(senha)) errors.push("Inclua pelo menos uma letra minúscula");
  if (!/[0-9]/.test(senha)) errors.push("Inclua pelo menos um número");
  if (SENHAS_COMUNS.has(senha.toLowerCase())) {
    errors.push("Esta senha é muito comum. Escolha uma menos óbvia");
  }

  return { valid: errors.length === 0, errors };
}
