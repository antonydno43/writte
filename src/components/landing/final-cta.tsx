import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="hero-dark relative overflow-hidden"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-28 lg:px-8">
        <h2
          id="final-cta-heading"
          className="animate-fade-up mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Your next customer is already out there.
        </h2>

        <div
          className="animate-fade-up mt-10"
          style={{ animationDelay: "100ms" }}
        >
          <Button
            asChild
            size="lg"
            className="h-12 rounded-lg px-8 text-base shadow-lg shadow-primary/30"
          >
            <Link href="/signup">
              Start free today
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <p
          className="animate-fade-up mt-5 text-sm text-white/60 sm:text-base"
          style={{ animationDelay: "180ms" }}
        >
          No credit card. No lock-in. Just growth.
        </p>
      </div>
    </section>
  );
}
