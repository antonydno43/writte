import type { Metadata } from "next";

import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: {
    absolute: "YourBiz CRM — Run your whole business relationship journey in one calm place",
  },
  description:
    "YourBiz CRM keeps contacts, deals, tasks and your team in sync — multi-currency pipelines (₹ and $), timezone harmony and bank-grade security. Built for India, ready for the world.",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
