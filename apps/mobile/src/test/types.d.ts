import "@testing-library/jest-native/extend-expect";

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any[]> extends Function, MockInstance<T, Y> {
      new (...args: Y): T;
      (...args: Y): T;
    }
  }
}

declare namespace jest {
  type MockedFunction<T extends (...args: any[]) => any> = jest.Mock & T;
}
