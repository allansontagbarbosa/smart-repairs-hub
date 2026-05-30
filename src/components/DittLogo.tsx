import { cn } from "@/lib/utils";
import logoLight from "@/assets/ditt-logo-light.png";
import logoDark from "@/assets/ditt-logo-dark.png";
import logoLightIcon from "@/assets/ditt-logo-light-icon.png";
import logoDarkIcon from "@/assets/ditt-logo-dark-icon.png";

interface Props {
  size?: "sm" | "md" | "lg";
  /**
   * 'auto' (default) — escolhe a logo automaticamente baseado no tema (.dark no html).
   * 'light' — força versão com texto preto.
   * 'dark' — força versão com texto branco.
   */
  variant?: "auto" | "light" | "dark" | "white" | "default" | "primary";
  /** Quando true, renderiza apenas o ícone (sem o wordmark). */
  iconOnly?: boolean;
  /** @deprecated compat — quando false, força iconOnly. */
  showWordmark?: boolean;
  /** @deprecated compat — ignorado (tagline já está embutida nas PNGs). */
  showTagline?: boolean;
  className?: string;
}

/**
 * Logo Ditt — usa as PNGs originais em src/assets/ (tipografia oficial).
 * Em "auto", renderiza ambas as imagens e alterna via CSS dark: para troca instantânea.
 */
export function DittLogo({
  size = "md",
  variant = "auto",
  iconOnly = false,
  showWordmark = true,
  className,
}: Props) {
  const onlyIcon = iconOnly || !showWordmark;
  const heights = { sm: 22, md: 32, lg: 48 };
  const h = heights[size];

  // Compat: variant antigos
  const v: "auto" | "light" | "dark" =
    variant === "white" || variant === "dark"
      ? "dark"
      : variant === "light" || variant === "primary" || variant === "default"
      ? variant === "light"
        ? "light"
        : "auto"
      : "auto";

  if (v === "auto") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <img
          src={onlyIcon ? logoLightIcon : logoLight}
          alt="Ditt"
          className="dark:hidden"
          style={{ height: h, width: "auto" }}
        />
        <img
          src={onlyIcon ? logoDarkIcon : logoDark}
          alt="Ditt"
          className="hidden dark:inline-block"
          style={{ height: h, width: "auto" }}
        />
      </span>
    );
  }

  const src =
    v === "light"
      ? onlyIcon
        ? logoLightIcon
        : logoLight
      : onlyIcon
      ? logoDarkIcon
      : logoDark;

  return (
    <img
      src={src}
      alt="Ditt"
      className={cn("inline-block", className)}
      style={{ height: h, width: "auto" }}
    />
  );
}

/** @deprecated Use DittLogo */
export const AssistProLogo = DittLogo;
