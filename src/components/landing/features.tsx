import {
  Clock4,
  Coins,
  ListTodo,
  ShieldCheck,
  SquareKanban,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClasses: string;
}

const FEATURES: Feature[] = [
  {
    title: "Pipeline that drags and drops",
    description:
      "Move deals across stages with your finger or mouse. Won and Lost stages light up when it matters.",
    icon: SquareKanban,
    iconClasses: "bg-primary/10 text-primary",
  },
  {
    title: "Contacts & companies",
    description:
      "Every conversation, note and task attached to the right person and company. Nothing slips.",
    icon: Users,
    iconClasses: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Tasks & reminders",
    description:
      "Follow-ups with due dates and priorities, so “I forgot to call” never happens again.",
    icon: ListTodo,
    iconClasses: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    title: "Multi-currency deals",
    description:
      "Quote in ₹, close in $. Indian number formatting (₹12,50,000) built in, plus 25+ currencies.",
    icon: Coins,
    iconClasses: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Timezone harmony",
    description:
      "Your teammate in New York and you in Chennai see the same deadline in your own local time. No more 3 a.m. surprises.",
    icon: Clock4,
    iconClasses: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    title: "Bank-grade security",
    description:
      "Every workspace’s data is isolated with Postgres row-level security. Your data is yours, technically enforced.",
    icon: ShieldCheck,
    iconClasses: "bg-primary/10 text-primary",
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mesh-light scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="features-heading"
            className="animate-fade-up text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Everything a growing business needs. Nothing it doesn’t.
          </h2>
          <p
            className="animate-fade-up mt-4 text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Start simple, grow powerful — YourBiz grows at your pace.
          </p>
        </div>

        <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="h-full animate-fade-up"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <Card className="h-full gap-4 py-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
                  <div className="px-6">
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-xl",
                        feature.iconClasses
                      )}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="px-6">
                    <h3 className="text-lg font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
