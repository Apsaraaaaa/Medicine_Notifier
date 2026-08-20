/**
 * Camera and gallery access, loaded lazily.
 *
 * `expo-image-picker` is the only module these features add, and it is
 * required through this shim rather than imported directly for the same reason
 * `expo-notifications` is (see notifications/reminders.ts): a static import is
 * evaluated at startup, so a build that does not yet have the module would
 * crash on launch rather than simply not offering the camera.
 *
 * With the module present the scanner offers the camera and the gallery; with
 * it absent `available()` is false and the scan screen falls back to typing the
 * label out, which runs through exactly the same parser.
 */

interface PickedImage {
  uri: string;
  mimeType: string;
}

type PickerModule = typeof import("expo-image-picker");

let cached: PickerModule | null | undefined;

function picker(): PickerModule | null {
  if (cached === undefined) {
    try {
      cached = require("expo-image-picker") as PickerModule;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export function imagePickerAvailable(): boolean {
  return picker() !== null;
}

/** Thrown when the user declines the OS permission, so the caller can say so. */
export class PermissionDenied extends Error {
  constructor() {
    super("permission-denied");
    this.name = "PermissionDenied";
  }
}

function firstAsset(result: {
  canceled: boolean;
  assets?: { uri: string; mimeType?: string }[] | null;
}): PickedImage | null {
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType || "image/jpeg" };
}

/**
 * Common options for both sources.
 *
 * Quality is dropped to 0.7 and the longest edge left as the camera gives it:
 * OCR needs the detail, but a raw 12MP JPEG is several megabytes over a phone
 * connection for no extra accuracy. Editing is allowed so a photo of a whole
 * prescription can be cropped down to the one line that matters.
 */
const OPTIONS = { quality: 0.7, allowsEditing: true, exif: false } as const;

export async function takePhoto(): Promise<PickedImage | null> {
  const P = picker();
  if (!P) return null;
  const permission = await P.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied();
  return firstAsset(
    await P.launchCameraAsync({ ...OPTIONS, mediaTypes: ["images"] })
  );
}

export async function pickPhoto(): Promise<PickedImage | null> {
  const P = picker();
  if (!P) return null;
  // The modern photo picker needs no permission on Android 13+, and
  // requesting one there simply returns granted, so this stays uniform.
  const permission = await P.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied();
  return firstAsset(
    await P.launchImageLibraryAsync({ ...OPTIONS, mediaTypes: ["images"] })
  );
}
