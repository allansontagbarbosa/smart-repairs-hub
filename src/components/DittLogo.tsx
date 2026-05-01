import { APP_CONFIG } from "@/config/app";

interface Props {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showTagline?: boolean;
  variant?: 'default' | 'white';
  iconOnly?: boolean;
}

/**
 * Ditt Software logo.
 *
 * Símbolo: dois "selos" arredondados sobrepostos diagonalmente
 * (manual da marca pág. 5/6). O símbolo SEMPRE é verde Ditt #00C896
 * em uso normal — a única exceção é variant="white" para fundos escuros.
 */
export function DittLogo({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  variant = 'default',
  iconOnly = false,
}: Props) {
  const sizes = {
    sm: { icon: 24, text: 18, tag: 8, gap: 8 },
    md: { icon: 32, text: 24, tag: 10, gap: 10 },
    lg: { icon: 56, text: 42, tag: 14, gap: 14 },
  };
  const s = sizes[size];

  const colors = {
    default: { symbol: '#00C896', text: '#000000', tag: '#525252' },
    white:   { symbol: '#FFFFFF', text: '#FFFFFF', tag: 'rgba(255,255,255,0.75)' },
  };
  const c = colors[variant];

  // SVG do símbolo: dois rect arredondados sobrepostos.
  // viewBox 100x100 — fácil escalar.
  const Symbol = (
    <svg
      width={s.icon}
      height={s.icon}
      viewBox="0 0 100 100"
      role="img"
      aria-label={APP_CONFIG.name}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <title>{APP_CONFIG.name}</title>
      {/* Forma traseira (canto sup-direito) */}
      <rect
        x="32"
        y="8"
        width="60"
        height="60"
        rx="14"
        ry="14"
        fill={c.symbol}
        opacity="0.55"
      />
      {/* Forma frontal (canto inf-esquerdo) */}
      <rect
        x="8"
        y="32"
        width="60"
        height="60"
        rx="14"
        ry="14"
        fill={c.symbol}
      />
      {/* Recorte central (cria o "ponto" dentro da forma frontal) */}
      <circle cx="38" cy="62" r="7" fill="#FFFFFF" />
    </svg>
  );

  if (iconOnly) return Symbol;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        lineHeight: 1,
      }}
    >
      {Symbol}
      {showWordmark && (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: "'Manrope', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: s.text,
              color: c.text,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            ditt
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "'Manrope', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: s.tag,
                color: c.tag,
                letterSpacing: '0.25em',
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              Software
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** @deprecated Use DittLogo */
export const AssistProLogo = DittLogo;
