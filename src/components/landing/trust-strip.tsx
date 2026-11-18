import {
  Clock4,
  Coins,
  ShieldCheck,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TRUST_ITEMS: { icon: LucideIcon; label: string; iconClasses: string }[] = [
  {
    icon: Coins,
    label: "Multi-currency deals",
    iconClasses: "text-emerald-300",
  },
  {
    icon: Clock4,
    label: "Multi-timezone teams",
    iconClasses: "text-teal-300",
  },
  {
    icon: ShieldCheck,
    label: "Row-level security",
    iconClasses: "text-emerald-300",
  },
  {
    icon: Smartphone,
    label: "Works on mobile",
    iconClasses: "text-teal-300",
  },
  {
    icon: Sparkles,
    label: "No training needed",
    iconClasses: "text-amber-300",
  },
];

/**
 * Thin dark strip directly under the hero — capability pills that scroll
 * horizontally on small screens and center themselves once they fit.
 */
export function TrustStrip() {
  return (
    <section
      aria-label="Product highlights"
      className="border-t border-white/10"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="mx-auto flex w-fit items-center gap-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70">
                    <Icon
                      className={cn("size-4 shrink-0", item.iconClasses)}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
