import { cn } from "@/lib/utils";

interface Props {
  size?: 'sm' | 'md' | 'lg';
  /** 'default' segue o tema (text-foreground), 'white' força branco (sidebar/fundos escuros), 'primary' usa verde da marca */
  variant?: 'default' | 'white' | 'primary';
  /** Quando true, renderiza só o símbolo (sem o wordmark "ditt") */
  iconOnly?: boolean;
  /** Mantido por compat; quando false, força iconOnly=true */
  showWordmark?: boolean;
  /** Mostra subtítulo "SOFTWARE" abaixo do wordmark */
  showTagline?: boolean;
  className?: string;
}

/**
 * Ditt Software logo — SVG inline.
 * - Símbolo (dois quadrados arredondados) SEMPRE verde da marca (#00C896).
 * - Wordmark "ditt" usa currentColor → adapta ao tema via classe text-*.
 * - Sem PNG raster: legível em qualquer fundo (resolve bug do dark mode).
 */
export function DittLogo({
  size = 'md',
  variant = 'default',
  iconOnly = false,
  showWordmark = true,
  showTagline = false,
  className,
}: Props) {
  const onlyIcon = iconOnly || !showWordmark;

  const dims = {
    sm: { h: 22, font: 18, gap: 6, tagline: 8 },
    md: { h: 30, font: 24, gap: 8, tagline: 10 },
    lg: { h: 48, font: 38, gap: 12, tagline: 14 },
  }[size];

  const textColor =
    variant === 'white' ? 'text-white'
    : variant === 'primary' ? 'text-primary'
    : 'text-foreground';

  // Símbolo sempre verde marca (não usa currentColor).
  const symbol = (
    <svg
      width={dims.h}
      height={dims.h}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Ditt"
      style={{ flexShrink: 0 }}
    >
      <rect x="32" y="8" width="60" height="60" rx="14" ry="14" fill="#00C896" opacity="0.55" />
      <rect x="8" y="32" width="60" height="60" rx="14" ry="14" fill="#00C896" />
      <rect x="34" y="58" width="14" height="14" rx="2" fill="#FFFFFF" />
    </svg>
  );

  if (onlyIcon) {
    return <span className={cn('inline-flex items-center', className)}>{symbol}</span>;
  }

  return (
    <span
      className={cn('inline-flex items-center', textColor, className)}
      style={{ gap: dims.gap }}
    >
      {symbol}
      <span className="inline-flex flex-col leading-none">
        <span
          style={{
            fontFamily: 'Manrope, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: dims.font,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          ditt
        </span>
        {showTagline && (
          <span
            style={{
              fontFamily: 'Manrope, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: dims.tagline,
              letterSpacing: '0.18em',
              opacity: 0.7,
              marginTop: 2,
            }}
          >
            SOFTWARE
          </span>
        )}
      </span>
    </span>
  );
}

/** @deprecated Use DittLogo */
export const AssistProLogo = DittLogo;
