import { ExternalLink, Watch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { canOpenWatchCompanion, openWatchCompanion } from "@/lib/native";

const RELEASE_URL =
  "https://github.com/Nofal-Amr/life-os-foundation/releases/tag/android-2026-10-08";

/**
 * Settings → Your watch: how phone notifications reach the watch (Galaxy
 * Wearable decides that), and the watch app with its tile and watch-face slot.
 */
export function WatchCard() {
  const canOpen = canOpenWatchCompanion();
  return (
    <section className="stat-card space-y-4 p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold">
          <Watch className="size-4" /> {t("Your watch")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "Life OS reminders and calls reach a Galaxy Watch through Galaxy Wearable on this phone. If they don't show up there:",
          )}
        </p>
      </div>

      <ol className="list-decimal space-y-1.5 ps-5 text-sm">
        <li>
          {t(
            "In Galaxy Wearable: Watch settings → Notifications → App notifications, turn on Life OS.",
          )}
        </li>
        <li>
          {t(
            "In the same Notifications screen, allow notifications on the watch while you're using the phone (otherwise they only go to the watch when the phone is idle).",
          )}
        </li>
        <li>{t("Check the watch isn't in Do not disturb, Bedtime or Theatre mode.")}</li>
      </ol>
      {canOpen ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!openWatchCompanion())
              toast.error(t("Galaxy Wearable isn't installed on this phone."));
          }}
        >
          Open Galaxy Wearable
        </Button>
      ) : null}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm font-semibold">{t("Life OS on the watch")}</p>
        <p className="text-xs text-muted-foreground">
          {t(
            "A prayer-times tile, a “Next prayer” slot for watch faces, and the Qibla. Times are worked out on the watch from its location, so it works offline and without signing in.",
          )}
        </p>
        <ol className="list-decimal space-y-1.5 ps-5 text-xs text-muted-foreground">
          <li>{t("Download life-os-wear.apk from the release page.")}</li>
          <li>
            {t(
              "On the watch: Settings → About watch → Software → tap Software version 5 times. Then Developer options → turn on ADB debugging and Wireless debugging.",
            )}
          </li>
          <li>
            {t("From a computer on the same Wi-Fi:")}{" "}
            <code className="rounded bg-secondary px-1">adb connect</code>{" "}
            {t("the address the watch shows, then")}{" "}
            <code className="rounded bg-secondary px-1">adb install life-os-wear.apk</code>
          </li>
          <li>
            {t(
              "Add the tile: swipe to the last tile, tap +, choose Prayer times. On a watch face: long-press it → Customise → pick a slot → Life OS.",
            )}
          </li>
        </ol>
        <Button type="button" variant="ghost" size="sm" asChild>
          <a href={RELEASE_URL} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> {t("Release page")}
          </a>
        </Button>
      </div>
    </section>
  );
}
