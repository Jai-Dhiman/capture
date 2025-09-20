module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.(spec|test).(ts|tsx)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-svg|@react-native|expo(nent)?|@expo(nent)?/.*|expo-modules-core|react-clone-referenced-element|@sentry|@shopify|@tanstack)/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
};
