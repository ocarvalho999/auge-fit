import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "test-results/**",
      "playwright-report/**",
      ".tmp/**",
      "public/sw.js",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // A chave de serviço só pode ser importada por código exclusivo do servidor.
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/lib/supabase/admin*"] }],
    },
  },
];
export default config;
