/**
 * Web/PWA stub — hardware back is handled via history `popstate` in the shared guard.
 */
export type NativeBackButtonHandle = {
  remove: () => Promise<void>
}

export async function addNativeBackButtonListener(
  _handler: () => void,
): Promise<NativeBackButtonHandle> {
  return {
    remove: async () => {},
  }
}
