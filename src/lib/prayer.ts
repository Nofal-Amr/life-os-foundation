import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import { parseISO } from "date-fns";

type MethodKey = keyof typeof CalculationMethod;

/** Prayer times for a specific ISO date (yyyy-MM-dd) at saved coordinates. */
export function prayerTimesFor(
  latitude: number,
  longitude: number,
  method: string | null,
  asrSchool: string | null,
  isoDate: string,
): PrayerTimes {
  const key = (method && method in CalculationMethod ? method : "MuslimWorldLeague") as MethodKey;
  const factory = CalculationMethod[key] as () => ReturnType<
    typeof CalculationMethod.MuslimWorldLeague
  >;
  const params = factory();
  params.madhab = asrSchool === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  const date = parseISO(isoDate);
  date.setHours(12, 0, 0, 0);
  return new PrayerTimes(new Coordinates(latitude, longitude), date, params);
}
