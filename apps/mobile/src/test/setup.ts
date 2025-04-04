jest.mock("@env", () => ({
  API_URL: "https://test-api.example.com",
}));

// Mock secure storage
jest.mock("../lib/storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock react-native modules
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper");
jest.mock("react-native-reanimated", () => {
  return {
    __esModule: true,
    default: {
      addWhitelistedUIProps: jest.fn(),
      addWhitelistedNativeProps: jest.fn(),
    },
  };
});

// Mock Expo modules
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(() => new Uint8Array([1, 2, 3, 4])),
}));

// Mock navigation
jest.mock("@react-navigation/native", () => {
  return {
    __esModule: true,
    NavigationContainer: ({ children }) => children,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
  };
});

// Mock SVG components
jest.mock("react-native-svg", () => {
  return {
    SvgXml: () => "SvgXml",
    Svg: () => "Svg",
    G: () => "G",
    Path: () => "Path",
    Circle: () => "Circle",
    Rect: () => "Rect",
  };
});

// Suppress warning logs during tests
console.warn = jest.fn();
console.error = jest.fn();
