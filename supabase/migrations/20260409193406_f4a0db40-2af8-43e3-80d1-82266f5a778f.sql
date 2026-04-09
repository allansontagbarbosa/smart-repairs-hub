
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS especialidade text,
  ADD COLUMN IF NOT EXISTS carga_horaria text,
  ADD COLUMN IF NOT EXISTS salario_fixo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_transporte numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_alimentacao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_admissao date,
  ADD COLUMN IF NOT EXISTS observacoes text;
