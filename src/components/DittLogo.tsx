import { APP_CONFIG } from "@/config/app";
import { useTheme } from "@/contexts/ThemeContext";
import logoLight from "@/assets/ditt-logo-light.png";
import logoLightIcon from "@/assets/ditt-logo-light-icon.png";
import logoDark from "@/assets/ditt-logo-dark.png";
import logoDarkIcon from "@/assets/ditt-logo-dark-icon.png";

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showTagline?: boolean;
  /** 'default' segue o tema, 'white' força versão para fundo escuro */
  variant?: 'default' | 'white';
  iconOnly?: boolean;
}

/**
 * Ditt Software logo.
 * Usa as artes oficiais (manual da marca) e troca automaticamente
 * conforme o tema (claro/escuro). O símbolo permanece sempre verde.
 */
export function DittLogo({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  variant = 'default',
  iconOnly = false,
}: Props) {
  // Hook protegido: fora do ThemeProvider (ex.: tela de login pública), cai no claro.
  let isDark = false;
  try {
    isDark = useTheme().resolvedTheme === 'dark';
  } catch {
    isDark = false;
  }
  const useDarkArt = variant === 'white' || isDark;

  // PNGs já estão recortados, sem fundo e sem artboard quadrado.
  // Mantém altura visual proporcional para headers, sidebar e telas públicas.
  const heights = { sm: 24, md: 32, lg: 52 } as const;
  const h = heights[size];

  // Tagline embute no asset com wordmark, então showTagline controla qual arte:
  // - showWordmark + showTagline -> arte com "SOFTWARE"
  // - showWordmark sem tagline   -> arte só "ditt"
  // - iconOnly                   -> apenas símbolo
  const src = iconOnly
    ? (useDarkArt ? logoDarkIcon : logoLightIcon) // arte ícone vem com "ditt", mas usamos como símbolo escalado
    : showTagline
      ? (useDarkArt ? logoDark : logoLight)
      : (useDarkArt ? logoDarkIcon : logoLightIcon);

  // Para iconOnly de verdade, usa o símbolo SVG isolado (já existente abaixo).
  if (iconOnly) {
    return <SymbolOnly size={h} forceWhite={variant === 'white'} />;
  }

  return (
    <img
      src={src}
      alt={APP_CONFIG.name}
      style={{ height: h, width: 'auto', display: 'block' }}
      draggable={false}
    />
  );
}

function SymbolOnly({ size, forceWhite }: { size: number; forceWhite: boolean }) {
  const fill = forceWhite ? '#FFFFFF' : '#00C896';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Ditt">
      <rect x="32" y="8" width="60" height="60" rx="14" ry="14" fill={fill} opacity="0.55" />
      <rect x="8" y="32" width="60" height="60" rx="14" ry="14" fill={fill} />
      <rect x="34" y="58" width="14" height="14" rx="2" fill="#FFFFFF" />
    </svg>
  );
}

/** @deprecated Use DittLogo */
export const AssistProLogo = DittLogo;
