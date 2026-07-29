module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testRegex: "src/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"],
};
