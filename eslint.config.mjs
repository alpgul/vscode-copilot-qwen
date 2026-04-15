/**
 * ESLint configuration for the project.
 *
 * See https://eslint.style and https://typescript-eslint.io for additional linting options.
 */
// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config(
  {
    ignores: [".vscode-test", "out", "**/*.d.ts"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      curly: "warn",
      // complexity: ["warn", { max: 11 }],
      // "max-depth": ["warn", { max: 5 }],
      // "max-nested-callbacks": ["warn", { max: 5 }],
      // "max-params": ["warn", { max: 5 }],
      // "max-lines-per-function": ["warn", { max: 50 }],
      // "max-statements": ["warn", { max: 13 }],
      // "max-lines": ["warn", { max: 300 }],
      "@stylistic/semi": ["warn", "always"],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
);
