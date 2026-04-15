import { APP_CONFIG } from "@/config/app";

interface Props {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  iconOnly?: boolean
}

export function AssistProLogo({ size = 'md', showTagline = false, iconOnly = false }: Props) {
  const scales = { sm: 0.4, md: 0.65, lg: 1 }
  const s = scales[size]

  if (iconOnly) {
    return (
      <svg width={40} height={40} viewBox="0 0 100 104" role="img">
        <title>{APP_CONFIG.name}</title>
        <path d="M50 0 L100 14 L100 58 Q100 90 50 104 Q0 90 0 58 L0 14 Z" fill="#0F172A"/>
        <path d="M50 8 L92 20 L92 58 Q92 84 50 96 Q8 84 8 58 L8 20 Z" fill="#1E40AF"/>
        <path d="M50 8 L92 20 L92 40 L8 40 L8 20 Z" fill="#2563EB"/>
        <path d="M50 8 L92 20 L92 24 L8 24 L8 20 Z" fill="#3B82F6" opacity="0.5"/>
        <rect x="32" y="22" width="36" height="56" rx="7" fill="white"/>
        <rect x="37" y="29" width="26" height="40" rx="3" fill="#1E3A8A"/>
        <rect x="45" y="26" width="10" height="3" rx="1.5" fill="#BFDBFE"/>
        <rect x="43" y="72" width="14" height="3" rx="1.5" fill="#BFDBFE"/>
        <polyline points="39,47 45,54 61,40" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  return (
    <svg width={480 * s} height={(showTagline ? 120 : 110) * s} viewBox="0 0 480 120" role="img">
      <title>{APP_CONFIG.name}</title>
      {/* Escudo */}
      <path d="M50 0 L100 14 L100 58 Q100 90 50 104 Q0 90 0 58 L0 14 Z" fill="#0F172A"/>
      <path d="M50 8 L92 20 L92 58 Q92 84 50 96 Q8 84 8 58 L8 20 Z" fill="#1E40AF"/>
      <path d="M50 8 L92 20 L92 40 L8 40 L8 20 Z" fill="#2563EB"/>
      <path d="M50 8 L92 20 L92 24 L8 24 L8 20 Z" fill="#3B82F6" opacity="0.5"/>
      <circle cx="12" cy="16" r="2.5" fill="#60A5FA"/>
      <circle cx="88" cy="16" r="2.5" fill="#60A5FA"/>
      <circle cx="6" cy="62" r="1.8" fill="#93C5FD" opacity="0.7"/>
      <circle cx="94" cy="62" r="1.8" fill="#93C5FD" opacity="0.7"/>
      {/* Phone */}
      <rect x="32" y="22" width="36" height="56" rx="7" fill="white"/>
      <rect x="37" y="29" width="26" height="40" rx="3" fill="#1E3A8A"/>
      <rect x="45" y="26" width="10" height="3" rx="1.5" fill="#BFDBFE"/>
      <rect x="43" y="72" width="14" height="3" rx="1.5" fill="#BFDBFE"/>
      <rect x="37" y="29" width="6" height="40" rx="3" fill="#3B82F6" opacity="0.2"/>
      <circle cx="59" cy="32" r="2" fill="#60A5FA" opacity="0.8"/>
      {/* Check */}
      <polyline points="39,47 45,54 61,40" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Wordmark */}
      <text x="118" y="62" fontFamily="system-ui, sans-serif" fontSize="58" fontWeight="500" letterSpacing="-2" fill="#0f172a">Assist</text>
      <text x="340" y="62" fontFamily="system-ui, sans-serif" fontSize="58" fontWeight="500" letterSpacing="-2" fill="#2563EB">Pro</text>
      {showTagline && (
        <>
          <text x="120" y="90" fontFamily="system-ui, sans-serif" fontSize="13" letterSpacing="4" fill="#64748b">ASSISTÊNCIA TÉCNICA</text>
          <line x1="120" y1="100" x2="440" y2="100" stroke="#e2e8f0" strokeWidth="0.5"/>
        </>
      )}
    </svg>
  )
}

/** @deprecated Use AssistProLogo instead */
export const MobileFixLogo = AssistProLogo;
