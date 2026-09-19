import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EntityIcon } from "@/components/app/EntityIdentity";
import { Button } from "@/components/ui/button";
import { projectCoverUrlQuery, validateProjectCover } from "@/data/projects";
import { cn } from "@/lib/utils";

export function ProjectCover({ path, name, icon, color, className }: { path?: string | null; name: string; icon?: string | null; color?: string | null; className?: string }) {
  const url = useQuery(projectCoverUrlQuery(path ?? null));
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(path && url.data && !failed);

  if (!path) return null;

  return (
    <div className={cn("relative aspect-[16/6] w-full overflow-hidden bg-muted", className)}>
      {showImage ? (
        <img src={url.data ?? ""} alt={`${name} cover`} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="grid size-full place-items-center">
          <EntityIcon icon={icon} color={color} containerClassName="size-12" className="size-6" />
        </div>
      )}
    </div>
  );
}

export function ProjectCoverPicker({ file, currentPath, removeCurrent, onFileChange, onRemoveCurrent }: { file: File | null; currentPath?: string | null; removeCurrent: boolean; onFileChange: (file: File | null) => void; onRemoveCurrent: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const currentUrl = useQuery(projectCoverUrlQuery(removeCurrent ? null : currentPath ?? null));
  const shown = preview ?? currentUrl.data;

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Cover image</span>
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <div className="relative aspect-[16/6]">
          {shown ? <img src={shown} alt="Project cover preview" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-7" /></div>}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-card p-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            try {
              validateProjectCover(selected);
              onFileChange(selected);
            } catch (error) {
              onFileChange(null);
              event.target.value = "";
              window.alert(error instanceof Error ? error.message : "Please choose another image.");
            }
          }} />
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}><Upload className="size-4" />{shown ? "Replace" : "Choose image"}</Button>
          {shown ? <Button type="button" size="sm" variant="ghost" onClick={() => { onFileChange(null); onRemoveCurrent(); }}><X className="size-4" />Remove</Button> : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Optional · PNG, JPEG or WebP · up to 5MB</p>
    </div>
  );
}