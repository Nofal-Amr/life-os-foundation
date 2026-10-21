import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crosshair, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deletePlace,
  savePlace,
  workKeys,
  workPlacesQuery,
  type PlaceInput,
  type WorkOrg,
  type WorkPlace,
} from "@/data/work/api";
import { parsePlaceInput, RADIUS_DEFAULT_M, RADIUS_MAX_M, RADIUS_MIN_M } from "@/data/work/place";
import { requestDeviceLocation } from "@/lib/geolocation";
import { t } from "@/lib/i18n";
import { toError } from "@/lib/supabase-helpers";

const mapsLink = (place: { latitude: number; longitude: number }) =>
  `https://www.google.com/maps?q=${place.latitude},${place.longitude}`;

/** Places: where people may clock in, each with a radius. */
export function PlacesAdmin({ org }: { org: WorkOrg }) {
  const queryClient = useQueryClient();
  const places = useQuery(workPlacesQuery(org.id));
  const [editing, setEditing] = useState<PlaceInput | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: workKeys.all });
  const remove = useMutation({
    mutationFn: (id: string) => deletePlace(id),
    onSuccess: refresh,
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {(places.data ?? []).map((place: WorkPlace) => (
          <li
            key={place.id}
            className="stat-card flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <p className="font-semibold">{place.name}</p>
              <p className="text-xs text-muted-foreground">
                {t(place.kind === "site" ? "Site" : "Office")} · {place.radius_m} m ·{" "}
                <a
                  className="underline-offset-2 hover:underline"
                  href={mapsLink(place)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Open in Maps")} <ExternalLink className="inline size-3" />
                </a>
              </p>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(place)}>
                Edit
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("Delete")}
                onClick={() => remove.mutate(place.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <PlaceForm
          org={org}
          initial={editing}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : (
        <Button
          type="button"
          onClick={() =>
            setEditing({
              name: "",
              kind: "office",
              latitude: NaN,
              longitude: NaN,
              radius_m: RADIUS_DEFAULT_M,
            })
          }
        >
          {t("Add a place")}
        </Button>
      )}
    </div>
  );
}

function PlaceForm({
  org,
  initial,
  onDone,
}: {
  org: WorkOrg;
  initial: PlaceInput;
  onDone: () => void;
}) {
  const [place, setPlace] = useState(initial);
  const [where, setWhere] = useState(
    Number.isFinite(initial.latitude) ? `${initial.latitude}, ${initial.longitude}` : "",
  );
  const point = parsePlaceInput(where);
  const save = useMutation({
    mutationFn: () =>
      savePlace(org.id, { ...place, latitude: point!.latitude, longitude: point!.longitude }),
    onSuccess: () => {
      toast.success(t("Saved"));
      onDone();
    },
    onError: (error: unknown) => toast.error(toError(error).message),
  });
  const here = useMutation({
    mutationFn: requestDeviceLocation,
    onSuccess: (coords) =>
      setWhere(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`),
    onError: (error: unknown) => toast.error(toError(error).message),
  });

  return (
    <form
      className="stat-card space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (place.name.trim() && point) save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="place-name">Name</Label>
        <Input
          id="place-name"
          value={place.name}
          maxLength={60}
          placeholder={t("e.g. Office, New Capital site")}
          onChange={(event) => setPlace({ ...place, name: event.target.value })}
        />
      </div>
      <div
        className="flex gap-1 rounded-lg bg-secondary p-1"
        role="radiogroup"
        aria-label={t("Kind")}
      >
        {(["office", "site"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={place.kind === kind}
            onClick={() => setPlace({ ...place, kind })}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm ${place.kind === kind ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {t(kind === "site" ? "Site" : "Office")}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="place-where">Where</Label>
        <div className="flex gap-2">
          <Input
            id="place-where"
            value={where}
            placeholder={t("Coordinates or a Google Maps link")}
            onChange={(event) => setWhere(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={here.isPending}
            onClick={() => here.mutate()}
          >
            <Crosshair className="size-4" /> {t("Here")}
          </Button>
        </div>
        {where && !point ? (
          <p className="text-xs text-destructive">{t("Couldn't read a location from that.")}</p>
        ) : point ? (
          <a
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            href={mapsLink(point)}
            target="_blank"
            rel="noreferrer"
          >
            {t("Check the pin in Maps")}
          </a>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="place-radius">
          {t("Radius")}: {place.radius_m} m
        </Label>
        <input
          id="place-radius"
          type="range"
          min={RADIUS_MIN_M}
          max={RADIUS_MAX_M}
          step={10}
          value={place.radius_m}
          onChange={(event) => setPlace({ ...place, radius_m: Number(event.target.value) })}
          className="w-full accent-[var(--primary)]"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!place.name.trim() || !point || save.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
