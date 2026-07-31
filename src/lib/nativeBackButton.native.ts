import { App } from '@capacitor/app'

/**
 * Native Capacitor hardware/system Back adapter.
 * Registering a listener means JS owns Back — the shared guard decides stay vs leave.
 */
export type NativeBackButtonHandle = {
  remove: () => Promise<void>
}

export async function addNativeBackButtonListener(
  handler: () => void,
): Promise<NativeBackButtonHandle> {
  const listener = await App.addListener('backButton', () => {
    handler()
  })
  return {
    remove: async () => {
      await listener.remove()
    },
  }
}
