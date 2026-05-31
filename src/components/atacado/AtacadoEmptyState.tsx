import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  ctaOnClick?: () => void;
}

export function AtacadoEmptyState({ icon: Icon, title, description, ctaLabel, ctaTo, ctaOnClick }: Props) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {ctaLabel && (ctaTo || ctaOnClick) && (
          ctaTo ? (
            <Button asChild size="sm">
              <Link to={ctaTo}>{ctaLabel}</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={ctaOnClick}>{ctaLabel}</Button>
          )
        )}
      </div>
    </div>
  );
}
