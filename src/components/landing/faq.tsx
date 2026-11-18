"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Do I need CRM experience to use YourBiz?",
    answer:
      "No. If you can use WhatsApp and a spreadsheet, you can use YourBiz. Every field has plain-English labels, and empty pages guide you with one clear next step.",
  },
  {
    question: "Is my business data safe?",
    answer:
      "Yes. Your data lives in a Supabase Postgres database protected with row-level security — each workspace can only ever see its own rows, enforced at the database layer, not just in the app.",
  },
  {
    question: "Which currencies and timezones are supported?",
    answer:
      "25+ currencies including INR, USD, EUR, GBP, AED, SGD — with Indian-style formatting (₹12,50,000). Timezone list covers every IANA zone; each teammate sees dates in their own timezone.",
  },
  {
    question: "My team is in different countries. Will it work for us?",
    answer:
      "That’s exactly why YourBiz exists. A deadline set in Chennai shows correctly in New York, Dubai and Sydney for each teammate.",
  },
  {
    question: "Can I invite teammates who don’t have an account?",
    answer:
      "Yes. Invite by email — they receive a link, create their account, and land inside your workspace. They can also keep their own separate workspace and switch between both.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Your data is yours. Contacts and deals can be exported any time, and workspace owners can manage everything from settings.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="faq-heading"
            className="animate-fade-up text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Frequently asked questions
          </h2>
          <p
            className="animate-fade-up mt-4 text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            Straight answers — no fine print.
          </p>
        </div>

        <div
          className="animate-fade-up mx-auto mt-12 max-w-3xl"
          style={{ animationDelay: "140ms" }}
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
