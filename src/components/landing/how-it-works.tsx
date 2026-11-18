import Link from "next/link";
import {
  ArrowRight,
  Handshake,
  MailCheck,
  Rocket,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface Step {
  numeral: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  {
    numeral: "01",
    title: "Create your workspace",
    description:
      "Takes 30 seconds. Name it, pick your currency and timezone.",
    icon: Rocket,
  },
  {
    numeral: "02",
    title: "Invite your team",
    description:
      "They get a friendly email invite — even if they’ve never used a CRM.",
    icon: MailCheck,
  },
  {
    numeral: "03",
    title: "Close your first deal",
    description: "Add contacts, drag deals across the pipeline, celebrate.",
    icon: Handshake,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="how-it-works-heading"
            className="animate-fade-up text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            From signup to first win in an afternoon.
          </h2>
          <p
            className="animate-fade-up mt-4 text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Three steps. No consultants, no spreadsheets, no chaos.
          </p>
        </div>

        <div className="relative mt-16">
          {/* dashed connector between the step icons */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[14%] top-8 hidden border-t-2 border-dashed border-border md:block"
          />
          <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.numeral}
                  className="flex flex-col items-center text-center"
                >
                  <span className="relative z-10 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                    <Icon className="size-7" aria-hidden="true" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-5 text-5xl font-bold leading-none tracking-tight text-primary/15"
                  >
                    {step.numeral}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        <div
          className="animate-fade-up mt-16 flex justify-center"
          style={{ animationDelay: "160ms" }}
        >
          <Button
            asChild
            size="lg"
            className="h-12 rounded-lg px-8 text-base shadow-lg shadow-primary/25"
          >
            <Link href="/signup">
              Start step one now
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
