const js = require("@eslint/js");
const globals = require("globals");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^next$" }],
      "no-console": "warn",
    },
  },
  prettierConfig,
  {
    ignores: ["node_modules/", "logs/", "src/storage/", "coverage/"],
  },
];
