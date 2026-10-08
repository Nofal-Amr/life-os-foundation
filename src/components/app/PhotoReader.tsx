import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { numbersIn, readPhoto, receiptFrom } from "@/lib/ocr";
import { cn } from "@/lib/utils";

/**
 * "Read from photo": take or pick a photo, read it on the phone, and offer
 * what it found as chips — nothing is filled in until you tap one.
 * kind "number": a meter, odometer or display; "receipt": total and shop.
 */
export function PhotoReader({
  kind,
  onNumber,
  onReceipt,
  className,
}: {
  kind: "number" | "receipt";
  onNumber?: (value: number) => void;
  onReceipt?: (receipt: { total: number | null; merchant: string | null }) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<number[] | null>(null);

  async function read(file: File) {
    setBusy(true);
    setFound(null);
    try {
      const text = await readPhoto(file, kind === "number" ? "digits" : "text");
      if (kind === "receipt") {
        const receipt = receiptFrom(text);
        if (receipt.total == null) toast.error("Couldn't find a total on that receipt.");
        else onReceipt?.(receipt);
        return;
      }
      const numbers = numbersIn(text).slice(0, 5);
      if (!numbers.length) toast.error("No number found. Try closer, straight on, without glare.");
      setFound(numbers);
    } catch {
      toast.error("Couldn't read the photo on this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {busy ? "Reading…" : kind === "receipt" ? "Scan a receipt" : "Read from photo"}
      </Button>
      {found?.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tap the right one:</span>
          {found.map((value) => (
            <button
              key={value}
              type="button"
              className="min-h-9 rounded-md border border-border px-3 text-sm tabular-nums hover:bg-accent"
              onClick={() => {
                onNumber?.(value);
                setFound(null);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
