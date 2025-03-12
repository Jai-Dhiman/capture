const LynxStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    NativeModules.NativeLocalStorageModule.setStorageItem(key, value)
    return Promise.resolve()
  },

  getItem: async (key: string): Promise<string | null> => {
    const value = NativeModules.NativeLocalStorageModule.getStorageItem(key)
    return Promise.resolve(value)
  },

  removeItem: async (key: string): Promise<void> => {
    NativeModules.NativeLocalStorageModule.removeStorageItem(key)
    return Promise.resolve()
  },

  clear: async (): Promise<void> => {
    NativeModules.NativeLocalStorageModule.clearStorage()
    return Promise.resolve()
  },
}

export default LynxStorage
