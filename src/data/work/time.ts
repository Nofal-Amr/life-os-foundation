/** The ISO moment for a local "HH:mm" on `day` in a time zone (summer time included). */
export function zonedIso(day: string, time: string, timeZone: string): string {
  const wanted = Date.parse(`${day}T${time}:00Z`);
  let guess = wanted;
  // Shift by the zone's offset at the guess; twice settles it around a clock change.
  for (let i = 0; i < 3; i++) {
    const local = new Date(guess).toLocaleString("sv-SE", { timeZone }).replace(" ", "T");
    guess -= Date.parse(`${local}Z`) - wanted;
  }
  return new Date(guess).toISOString();
}
