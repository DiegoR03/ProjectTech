import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import eslintPluginPrettier from "eslint-plugin-prettier";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], ...js.configs.recommended },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.js"], rules: { camelcase: ["error", { properties: "never", ignoreDestructuring: false }], "prettier/prettier": "error" }, plugins: { prettier: eslintPluginPrettier } },
]);

