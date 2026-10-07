import React from "react";
import { useState } from "react";
import { Mail, Moon, Sun, Phone, Linkedin, MapPin, ChevronDown, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLink } from "@/components/kit/arrow-link";
import { Tooltip } from "@/components/kit/tooltip";

type ProjectLink = {
  label: string;
  href: string;
};

type Project = {
  kicker: string;
  title: string;
  description: string;
  tags: string[];
  writeup: string;
  links: ProjectLink[];
  accent: string;
};

const PROJECTS: Project[] = [
  {
    kicker: "Research",
    title: "European Climate Tech Market Map",
    description:
      "PitchBook-sourced market intelligence dashboard — 11,682 companies across 6 sectors, plus a 2,674-company searchable index with personal contact data redacted (disclosed on the page).",
    tags: ["Data visualization", "PitchBook", "Market research"],
    writeup:
      "A market-intelligence dashboard built on a PitchBook export of 11,682 European climate tech companies across 6 sectors, with sector-level charts for the big picture and a searchable, sortable company table for the detail work. I built it to make a sprawling raw export actually usable for research and outreach. The public version has all personal contact fields (name, email, title) stripped from the company index since the underlying source included licensed contact data — that redaction is disclosed directly on the page.",
    links: [{ label: "View live", href: "https://climate-market-map-rileye.zocomputer.io" }],
    accent: "oklch(0.58 0.19 292)",
  },
  {
    kicker: "Build",
    title: "FAQ Dashboard",
    description:
      "Point it at any website — it scrapes the content, auto-generates categories and audience types, and publishes a searchable FAQ hub with an embedded AI chatbot and admin tools.",
    tags: ["Web scraping", "Multi-tenant", "AI chatbot"],
    writeup:
      "Give it any website URL and it scrapes the content, auto-generates FAQ categories and audience types, and publishes a searchable public FAQ hub with an embedded AI chatbot. I built it to replace a manual, one-off FAQ-writing process with something repeatable: the scraper and classification pipeline do the first pass, and a separate admin dashboard lets a real person review, edit, and approve entries before anything goes live.",
    links: [
      { label: "User side", href: "https://faq-dashboard-rileye.zocomputer.io/faq/zo-faqs" },
      { label: "Admin dashboard", href: "https://faq-dashboard-rileye.zocomputer.io/" },
    ],
    accent: "oklch(0.7 0.16 145)",
  },
  {
    kicker: "Persona",
    title: "Riley Voss, Data Designer",
    description:
      "A custom AI persona with a full character, working style, and compounding knowledge base — blind-graded against Claude and Gemini on an 8-question data-viz judgment exam.",
    tags: ["Prompt engineering", "Persona design", "Benchmarked: 93/100"],
    writeup:
      "A custom AI persona — full backstory, working style, and a compounding data-visualization knowledge base — designed to bring consistent judgment to chart and dashboard critique. I built it to test whether a well-specified persona could hold its own against frontier models on a real task: it was blind-graded head-to-head against Claude and Gemini on an 8-question data-viz exam, with the grading methodology disclosed on the page rather than just the final score.",
    links: [{ label: "View live", href: "https://data-designer-rileye.zocomputer.io" }],
    accent: "oklch(0.75 0.15 80)",
  },
  {
    kicker: "Capstone",
    title: "Fantasy Draft Helper",
    description:
      "Multi-user fantasy football dashboard — Sleeper & ESPN sync, live draft assistant, waiver-wire recommendations, and an AI chat grounded in your own league data.",
    tags: ["Full-stack", "Bun / Hono / React", "Multi-tenant"],
    writeup:
      "A full-stack fantasy football app that syncs directly with a user's Sleeper or ESPN league, then layers a live draft assistant, waiver-wire add/drop recommendations, and an AI chatbot grounded in that league's actual data on top. I built it as my capstone to go beyond a single-league personal tool — every user gets their own isolated session and database, so the app works for anyone's league, not just mine, and the draft/waiver logic reacts to real roster and scoring settings instead of generic rankings.",
    links: [{ label: "View live", href: "https://draft-app-rileye.zocomputer.io" }],
    accent: "oklch(0.65 0.19 25)",
  },
];

const THEMES = {
  light: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.147 0.004 49.25)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.147 0.004 49.25)",
    muted: "oklch(0.97 0.001 106.424)",
    mutedForeground: "oklch(0.553 0.013 58.071)",
    border: "oklch(0.923 0.003 48.717)",
    secondary: "oklch(0.97 0.001 106.424)",
    secondaryForeground: "oklch(0.216 0.006 56.043)",
    ring: "oklch(0.709 0.01 56.259)",
  },
  dark: {
    background: "oklch(0.147 0.004 49.25)",
    foreground: "oklch(0.985 0.001 106.423)",
    card: "oklch(0.216 0.006 56.043)",
    cardForeground: "oklch(0.985 0.001 106.423)",
    muted: "oklch(0.268 0.007 34.298)",
    mutedForeground: "oklch(0.709 0.01 56.259)",
    border: "oklch(1 0 0 / 10%)",
    secondary: "oklch(0.268 0.007 34.298)",
    secondaryForeground: "oklch(0.985 0.001 106.423)",
    ring: "oklch(0.553 0.013 58.071)",
  },
} as const;

function ThemeSlider({
  mode,
  onToggle,
}: {
  mode: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mode === "dark"}
      aria-label="Toggle dark mode"
      onClick={onToggle}
      className="relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors"
      style={{
        background: mode === "dark" ? "oklch(0.268 0.007 34.298)" : "oklch(0.923 0.003 48.717)",
        borderColor: mode === "dark" ? "oklch(1 0 0 / 10%)" : "oklch(0.923 0.003 48.717)",
      }}
    >
      <span
        className="absolute left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: mode === "dark" ? "translateX(28px)" : "translateX(0)" }}
      >
        {mode === "dark" ? (
          <Moon className="size-3.5 text-zinc-700" />
        ) : (
          <Sun className="size-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [openProject, setOpenProject] = useState<string | null>(null);
  const t = THEMES[mode];

  return (
    <main
      id="top"
      className="min-h-screen bg-background text-foreground transition-colors"
      style={
        {
          "--background": t.background,
          "--foreground": t.foreground,
          "--card": t.card,
          "--card-foreground": t.cardForeground,
          "--muted": t.muted,
          "--muted-foreground": t.mutedForeground,
          "--border": t.border,
          "--secondary": t.secondary,
          "--secondary-foreground": t.secondaryForeground,
          "--ring": t.ring,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        {/* Header */}
        <header>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                KITE Scouting · 2026 Internship
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                Riley Elliott
              </h1>
              <p className="mt-3 text-lg text-pretty text-muted-foreground">
                I build data products — dashboards, full-stack apps, and AI personas — end to end.
              </p>
              <p className="mt-6 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                Over a summer at KITE Scouting I shipped four things start to finish: a full-stack
                fantasy football app, a multi-tenant FAQ platform, a market-intelligence dashboard, and
                a custom AI persona with a benchmarked skill. Everything below is a public, genericized
                version of real work — client and program branding removed, sensitive data redacted or
                replaced where the underlying source required it, and methodology disclosed wherever a
                claim on this page could otherwise be misread.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 sm:justify-between">
              <ThemeSlider
                mode={mode}
                onToggle={() => setMode((m) => (m === "light" ? "dark" : "light"))}
              />
              <img
                src="/images/riley-headshot.jpg"
                alt="Riley Elliott"
                className="w-32 shrink-0 rounded-2xl object-cover ring-1 ring-border sm:w-48 sm:flex-1"
              />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Tooltip label="Email">
              <a
                href="mailto:rileyell@stanford.edu"
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Mail className="size-4" />
                rileyell@stanford.edu
              </a>
            </Tooltip>
            <Tooltip label="Call">
              <a
                href="tel:+18585192611"
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Phone className="size-4" />
                +1 858 519 2611
              </a>
            </Tooltip>
            <Tooltip label="LinkedIn">
              <a
                href="https://www.linkedin.com/in/riley-elliott-883b563b2"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Linkedin className="size-4" />
                LinkedIn
              </a>
            </Tooltip>
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              Stanford, CA
            </span>
          </div>
        </header>

        {/* Projects */}
        <section className="mt-16">
          <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Selected work
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PROJECTS.map((project) => {
              const isOpen = openProject === project.title;
              return (
                <Card
                  key={project.title}
                  className="h-fit overflow-hidden py-0 transition-all"
                >
                  <div
                    aria-hidden
                    className="h-2"
                    style={{ background: project.accent }}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenProject(isOpen ? null : project.title)}
                    aria-expanded={isOpen}
                    className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CardContent className="space-y-2.5 px-5 pt-5 pb-5">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {project.kicker}
                      </p>
                      <h3 className="text-lg font-medium text-foreground">
                        {project.title}
                      </h3>
                      <p className="text-sm text-pretty leading-relaxed text-muted-foreground">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {project.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                        {isOpen ? "Hide details" : "View details"}
                        <ChevronDown
                          className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </CardContent>
                  </button>
                  {isOpen && (
                    <div className="space-y-4 border-t px-5 py-4">
                      <p className="text-sm text-pretty leading-relaxed text-muted-foreground">
                        {project.writeup}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {project.links.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            {link.label}
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t pt-8 text-sm text-muted-foreground">
          <p className="text-pretty">
            Each project above is a standalone site with its own write-up on methodology and what
            was changed for public presentation. Nothing here exposes confidential client data —
            where a build depended on licensed or proprietary data, it was redacted, replaced with
            representative content, or scoped to aggregate figures only.
          </p>
          <div className="mt-4">
            <ArrowLink href="#top" direction="up">
              Back to top
            </ArrowLink>
          </div>
        </footer>
      </div>
    </main>
  );
}
