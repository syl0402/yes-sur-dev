// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // 글자는 앱 글꼴을 입힌 @/components/ui/Text를 쓴다 (2026-10-31)
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/Text.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Text", "TextInput"],
          message: "@/components/ui/Text의 Text·TextInput을 쓰세요 (앱 글꼴).",
        }],
      }],
    },
  }
]);
