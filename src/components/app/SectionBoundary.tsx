import { Component, type ReactNode } from "react";

import { t } from "@/lib/i18n";

/**
 * Keeps one part of a page from taking the whole app down: if anything
 * inside throws while drawing, this part says so and the rest keeps working.
 */
export class SectionBoundary extends Component<
  { children: ReactNode; label?: string },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("Section failed", this.props.label ?? "", error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium text-foreground">
          {this.props.label
            ? `${t(this.props.label)}: ${t("this part couldn't load.")}`
            : t("This part couldn't load.")}
        </p>
        <p className="mt-1 text-muted-foreground">
          {t("The rest of Life OS still works. Leave this page and come back to try again.")}
        </p>
      </div>
    );
  }
}
