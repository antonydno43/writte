"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Currency = "inr" | "usd";

interface Plan {
  name: string;
  tagline: string;
  price: Record<Currency, string>;
  period: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    tagline: "For solo founders testing the CRM waters",
    price: { inr: "₹0", usd: "$0" },
    period: "forever",
    features: [
      "Up to 2 teammates",
      "Contacts & companies",
      "Deal pipeline",
      "Tasks & notes",
      "Mobile-ready",
    ],
  },
  {
    name: "Growth",
    tagline: "For teams that sell every day",
    price: { inr: "₹899", usd: "$12" },
    period: "per user / month",
    features: [
      "Everything in Starter",
      "Unlimited teammates",
      "Custom pipeline stages",
      "Multi-currency reporting",
      "Email invitations & roles",
      "Priority email support",
    ],
    highlighted: true,
  },
  {
    name: "Scale",
    tagline: "For businesses across countries",
    price: { inr: "₹2,399", usd: "$29" },
    period: "per user / month",
    features: [
      "Everything in Growth",
      "Advanced reporting",
      "Audit-friendly exports",
      "Dedicated manager",
      "Early access to new modules",
    ],
  },
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "inr", label: "₹ INR" },
  { value: "usd", label: "$ USD" },
];

export function Pricing() {
  const [currency, setCurrency] = useState<Currency>("inr");

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="mesh-light scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="pricing-heading"
            className="animate-fade-up text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Simple pricing for serious growth
          </h2>
          <p
            className="animate-fade-up mt-4 text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Start free. Upgrade when your pipeline demands it.
          </p>

          <div
            className="animate-fade-up mt-8 flex justify-center"
            style={{ animationDelay: "140ms" }}
          >
            <div
              role="group"
              aria-label="Pricing currency"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm"
            >
              {CURRENCIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCurrency(option.value)}
                  aria-pressed={currency === option.value}
                  className={cn(
                    "h-11 rounded-full px-5 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    currency === option.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ul className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-7">
          {PLANS.map((plan, index) => (
            <li
              key={plan.name}
              className={cn(
                "h-full animate-fade-up",
                plan.highlighted && "relative z-10"
              )}
              style={{ animationDelay: `${180 + index * 100}ms` }}
            >
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl p-6 sm:p-8",
                  plan.highlighted
                    ? "border-2 border-primary bg-card/70 shadow-xl shadow-primary/15 backdrop-blur-md lg:scale-[1.04]"
                    : "border border-border/80 bg-card shadow-sm"
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs shadow-lg shadow-primary/25">
                    Most popular
                  </Badge>
                )}

                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    key={currency}
                    className="animate-fade-in text-4xl font-bold tracking-tight text-foreground"
                  >
                    {plan.price[currency]}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {plan.period}
                  </span>
                </div>

                <ul className="mt-8 flex flex-col gap-3.5 border-t border-border/70 pt-6">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          Early access: billing is not switched on yet — every workspace
          currently runs on Growth features, free. When paid plans begin, early
          users keep a grandfathered discount.
        </p>
      </div>
    </section>
  );
}
