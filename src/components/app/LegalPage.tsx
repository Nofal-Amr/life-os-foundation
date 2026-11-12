import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { LEGAL, LEGAL_DRAFT } from "@/lib/legal";

/** A plain, readable page for the privacy policy and terms. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          Life OS
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {LEGAL.effective ? `In effect from ${LEGAL.effective}.` : null}
        </p>
        {LEGAL_DRAFT ? (
          <p className="tone-warning mt-4 rounded-lg border px-3 py-2 text-sm">
            Draft: who runs Life OS, how to reach them and the date are still to be filled in.
          </p>
        ) : null}
        <div className="legal mt-8 space-y-8 text-base leading-7 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  );
}

/** "write to name@example.com", or a plain fallback while the draft has no address. */
export function Contact() {
  return LEGAL.contactEmail ? (
    <a className="underline underline-offset-4" href={`mailto:${LEGAL.contactEmail}`}>
      {LEGAL.contactEmail}
    </a>
  ) : (
    <span>the contact address on this page</span>
  );
}
