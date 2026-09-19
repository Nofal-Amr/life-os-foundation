/** True when the app is running inside an embedded frame (preview, iframe). */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export type Coords = { latitude: number; longitude: number };

/**
 * Ask the device for its position, translating every failure into a clear,
 * actionable message instead of a silent no-op.
 */
export function requestDeviceLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This browser cannot share a location. Enter a city instead."));
      return;
    }
    if (isEmbedded()) {
      reject(
        new Error(
          "Browsers block location sharing inside an embedded preview. Open the app in its own browser tab, or enter a city instead.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error(
              "Location permission was declined. Allow it in your browser settings, or enter a city instead.",
            ),
          );
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("Finding your location took too long. Try again, or enter a city."));
          return;
        }
        reject(new Error("Your location is not available right now. Enter a city instead."));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  });
}
