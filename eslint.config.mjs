import globals                from "globals";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser               from "@typescript-eslint/parser";

const awaitInAsyncOnlyRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow await outside of async functions unless top-level await in modules',
    },
    schema: [],
    messages: {
      awaitOutsideAsync: 'await is only allowed inside async functions or at the top-level of modules.',
    },
  },
  create(context) {
    const sourceType = context.parserOptions.sourceType || 'script';
    let asyncStack = [];
    let nodeStack = [];

    return {
      Program(node) {
        asyncStack = [];
        nodeStack = [node];
      },
      FunctionDeclaration(node) {
        asyncStack.push(node.async);
        nodeStack.push(node);
      },
      FunctionExpression(node) {
        asyncStack.push(node.async);
        nodeStack.push(node);
      },
      ArrowFunctionExpression(node) {
        asyncStack.push(node.async);
        nodeStack.push(node);
      },
      'FunctionDeclaration:exit'() {
        asyncStack.pop();
        nodeStack.pop();
      },
      'FunctionExpression:exit'() {
        asyncStack.pop();
        nodeStack.pop();
      },
      'ArrowFunctionExpression:exit'() {
        asyncStack.pop();
        nodeStack.pop();
      },
      AwaitExpression(node) {
        const insideAsync = asyncStack.includes(true);

        if (!insideAsync) {
          const parentNode = nodeStack[nodeStack.length - 1];
          const isTopLevel = parentNode && parentNode.type === 'Program';
          const isModule = sourceType === 'module';

          if (!(isTopLevel && isModule)) {
            context.report({ node, messageId: 'awaitOutsideAsync' });
          }
        }
      }
    };
  }
};

export default [
  {
    ignores: [
      "node_modules/**",
      "out/**",
      "notes/**",
      "prism/**",
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
      custom: {
        rules: {
          'await-in-async-only': awaitInAsyncOnlyRule,
        },
      },
      "@typescript-eslint": typescriptEslintPlugin,
    },
    rules: {
      "no-const-assign":      "warn",
      "no-this-before-super": "warn",
      "no-undef":             "warn",
      "no-unreachable":       "warn",
      "constructor-super":    "warn",
      "valid-typeof":         "warn",

      "no-unused-vars": [ "off", {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
      } ],

      "@typescript-eslint/no-floating-promises": "error",
      "custom/await-in-async-only": "error"
    },
  },
];
