import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock4,
  Globe,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrustStrip } from "@/components/landing/trust-strip";
import { cn } from "@/lib/utils";

const amountTones = {
  teal: "bg-teal-400/15 text-teal-200",
  emerald: "bg-emerald-400/15 text-emerald-200",
  amber: "bg-amber-400/15 text-amber-200",
} as const;

const AVATAR_GRADIENTS = [
  "from-teal-300 to-teal-500",
  "from-amber-300 to-amber-500",
  "from-emerald-300 to-emerald-500",
] as const;

interface MockDeal {
  amount: string;
  tone: keyof typeof amountTones;
  date: string;
  skeletons: string[];
  avatars: number;
  hot?: boolean;
  won?: boolean;
}

const PIPELINE_COLUMNS: { title: string; deals: MockDeal[] }[] = [
  {
    title: "New leads",
    deals: [
      {
        amount: "₹45,000",
        tone: "teal",
        date: "Today",
        skeletons: ["w-3/4", "w-2/5"],
        avatars: 3,
      },
      {
        amount: "₹1,20,000",
        tone: "teal",
        date: "Mon",
        skeletons: ["w-4/5", "w-1/2"],
        avatars: 2,
      },
      {
        amount: "$8,500",
        tone: "emerald",
        date: "Wed",
        skeletons: ["w-3/5", "w-2/5"],
        avatars: 2,
      },
    ],
  },
  {
    title: "In talks",
    deals: [
      {
        amount: "₹12,50,000",
        tone: "amber",
        date: "Today",
        skeletons: ["w-4/5", "w-1/2"],
        avatars: 3,
        hot: true,
      },
      {
        amount: "$14,200",
        tone: "emerald",
        date: "Thu",
        skeletons: ["w-3/5", "w-2/5"],
        avatars: 2,
      },
    ],
  },
  {
    title: "Won",
    deals: [
      {
        amount: "₹8,90,000",
        tone: "emerald",
        date: "Fri",
        skeletons: ["w-3/4", "w-1/2"],
        avatars: 3,
        won: true,
      },
      {
        amount: "$5,400",
        tone: "emerald",
        date: "Mon",
        skeletons: ["w-2/3", "w-1/2"],
        avatars: 1,
        won: true,
      },
    ],
  },
];

function PipelineColumn({ title, deals }: { title: string; deals: MockDeal[] }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2 sm:p-2.5">
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-white/45 sm:text-[10px]">
          {title}
        </span>
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/55">
          {deals.length}
        </span>
      </div>
      <div className="space-y-2">
        {deals.map((deal) => (
          <div
            key={`${deal.amount}-${deal.date}`}
            className={cn(
              "rounded-lg border p-2 sm:p-2.5",
              deal.won
                ? "border-emerald-400/25 bg-emerald-400/[0.07]"
                : "border-white/10 bg-white/[0.06]",
              deal.hot &&
                "animate-float border-amber-400/40 bg-white/[0.09] shadow-[0_12px_40px_-10px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/60"
            )}
          >
            <div className="space-y-1.5">
              {deal.skeletons.map((width, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full",
                    width,
                    index === 0 ? "bg-white/25" : "bg-white/10"
                  )}
                />
              ))}
            </div>
            <div className="mt-2.5">
              <span
                className={cn(
                  "inline-block whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  amountTones[deal.tone]
                )}
              >
                {deal.amount}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-1.5">
              <span className="flex -space-x-1">
                {Array.from({ length: deal.avatars }).map(
                  (_, avatarIndex) => (
                    <span
                      key={avatarIndex}
                      className={cn(
                        "size-3 rounded-full border border-white/25 bg-gradient-to-br",
                        AVATAR_GRADIENTS[
                          avatarIndex % AVATAR_GRADIENTS.length
                        ]
                      )}
                    />
                  )
                )}
              </span>
              {deal.won ? (
                <span className="flex items-center gap-1">
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-400/20">
                    <Check className="size-2 text-emerald-300" aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/45">
                    {deal.date}
                  </span>
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/45">
                  {deal.date}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Product illustration built entirely from divs — no images. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <p className="sr-only">
        Illustration of the YourBiz CRM pipeline board with deal cards across
        New leads, In talks and Won stages, showing amounts in rupees and
        dollars.
      </p>
      <div aria-hidden="true" className="relative">
        {/* soft glow behind the panel */}
        <div className="absolute -inset-8 rounded-[2.5rem] bg-teal-500/10 blur-3xl" />

        {/* CRM window */}
        <div className="relative animate-float-slow rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-[0_30px_80px_-24px_rgba(13,148,136,0.45)] backdrop-blur-xl sm:p-5">
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          {/* window header */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 sm:pb-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-400/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
            </span>
            <span className="text-xs font-medium text-white/70">
              YourBiz CRM
            </span>
            <span className="ml-auto hidden items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/40 sm:flex">
              <Sparkles className="size-3 text-teal-300" />
              Workspace · Sunrise Traders
            </span>
          </div>

          {/* mini pipeline */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
            {PIPELINE_COLUMNS.map((column) => (
              <PipelineColumn key={column.title} {...column} />
            ))}
          </div>
        </div>

        {/* floating capability chips — inline row under the panel on mobile,
            floating glass chips anchored to the panel corners from md up */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:absolute md:inset-0 md:mt-0 md:pointer-events-none">
          <div className="animate-float flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2.5 shadow-xl backdrop-blur-md md:absolute md:-bottom-5 md:-left-4">
            <TrendingUp className="size-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white">
              +₹4.2L this month
            </span>
          </div>
          <div className="animate-float-slow flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2.5 shadow-xl backdrop-blur-md md:absolute md:-top-5 md:-right-4">
            <Clock4 className="size-4 text-teal-300" />
            <span className="text-xs font-semibold text-white">
              Team: 6 timezones in sync
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Always-dark hero band with the headline, CTAs and the product preview. */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="hero-dark relative overflow-hidden"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="max-w-2xl">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-md">
                <Globe className="size-4 text-teal-300" aria-hidden="true" />
                Built for India. Ready for the world.
              </span>
            </div>

            <h1
              id="hero-heading"
              className="animate-fade-up mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-5xl xl:text-6xl"
              style={{ animationDelay: "90ms" }}
            >
              Run your whole business relationship journey in{" "}
              <span className="text-gradient-brand">one calm place</span>.
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-white/70"
              style={{ animationDelay: "160ms" }}
            >
              YourBiz CRM keeps your contacts, deals, tasks and team in sync —
              with multi-currency pipelines that understand ₹ and $, and
              timezones that never clash between India and everywhere else.
            </p>

            <div
              className="animate-fade-up mt-10 flex flex-col gap-4 sm:flex-row"
              style={{ animationDelay: "230ms" }}
            >
              <Button
                asChild
                size="lg"
                className="h-12 rounded-lg px-8 text-base shadow-lg shadow-primary/30"
              >
                <Link href="/signup">
                  Start free — no card needed
                  <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-lg border-white/15 bg-white/10 px-8 text-base text-white backdrop-blur-md hover:bg-white/15 hover:text-white dark:bg-transparent dark:hover:bg-white/10"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <ul
              className="animate-fade-up mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/60"
              style={{ animationDelay: "300ms" }}
            >
              {[
                "Unlimited contacts",
                "Multi-workspace",
                "Invite your team free",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </div>
      </div>

      <TrustStrip />
    </section>
  );
}
