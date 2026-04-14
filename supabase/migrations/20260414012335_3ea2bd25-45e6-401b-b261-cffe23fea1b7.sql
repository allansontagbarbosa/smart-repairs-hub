
CREATE TABLE IF NOT EXISTS public.tipos_defeito (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  valor_mao_obra NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tipos_defeito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.tipos_defeito FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.os_defeitos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  defeito_id UUID REFERENCES public.tipos_defeito(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.os_defeitos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.os_defeitos FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.tipos_defeito (nome, categoria, valor_mao_obra) VALUES
('Tela quebrada / trincada','tela',80),('Tela sem imagem / apagada','tela',80),
('Touch não responde','tela',60),('Manchas na tela','tela',80),
('Bateria não carrega','bateria',50),('Bateria vicia / dura pouco','bateria',50),
('Aparelho desliga sozinho','bateria',50),('Bateria inchada','bateria',60),
('Conector de carga com defeito','conector',60),('Não carrega (conector solto)','conector',60),
('Câmera traseira com defeito','camera',70),('Câmera frontal com defeito','camera',60),
('Alto-falante sem som','audio',50),('Microfone não funciona','audio',50),
('Botão home com defeito','botoes',50),('Botão power não funciona','botoes',50),
('Sem sinal de rede / antena','rede',70),('Wi-Fi não conecta','rede',60),
('Travando / lento','software',40),('Loop de inicialização','software',50),
('Dano por água / líquido','fisico',80),('Queda / impacto forte','fisico',60),
('Carcaça trincada / quebrada','fisico',70),('Face ID não funciona','biometria',80),
('Touch ID / leitor digital falhou','biometria',70)
ON CONFLICT DO NOTHING;
