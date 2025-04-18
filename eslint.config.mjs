import globals from "globals";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "samples/**",
      "prism/languages/**",
      "**/*.min.js",
      "**/extensionHostProcess.js",
      "**/.vscode/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.mocha,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
    },
    rules: {
      "no-const-assign":      "warn",
      "no-this-before-super": "warn",
      "no-undef":             "warn",
      "no-unreachable":       "warn",
      "constructor-super":    "warn",
      "valid-typeof":         "warn",
      "no-unused-vars": [     "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
,
      "@typescript-eslint/no-floating-promises": "error"
    },
  },
];
