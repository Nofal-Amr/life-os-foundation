import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", "mobile/android/build"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // react-refresh/only-export-components only affects hot reload while developing: a file
    // that exports a component and something else reloads the whole page instead of the one
    // component. These files already did that when the lint gate was added. New files are
    // still checked. Do not add to these lists; remove a file once its exports are split.
    files: [
      // shadcn/ui components: the generator puts the variants or hook next to the component.
      "src/components/ui/badge.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/form.tsx",
      "src/components/ui/navigation-menu.tsx",
      "src/components/ui/sidebar.tsx",
      "src/components/ui/toggle.tsx",
      // A context provider with the hook that reads it.
      "src/hooks/useAppearance.tsx",
      "src/hooks/useAuth.tsx",
      "src/hooks/useTheme.tsx",
      // App components that also export a hook or helper.
      "src/components/app/EntityIdentity.tsx",
      "src/components/app/Holidays.tsx",
      "src/components/app/HubCard.tsx",
      "src/components/app/LocalAi.tsx",
      "src/components/app/MoneyBreakdown.tsx",
      "src/components/app/OnThisDay.tsx",
      "src/components/app/PrayerLog.tsx",
      "src/components/app/PrayerReminders.tsx",
      "src/components/app/Shortcuts.tsx",
      "src/components/app/SpendingInbox.tsx",
      "src/components/app/TaskSteps.tsx",
      "src/components/app/Timer.tsx",
      "src/components/app/TodayRing.tsx",
      "src/components/app/UniversalSearch.tsx",
      "src/components/app/UserAvatar.tsx",
      "src/components/app/work/MyMonth.tsx",
    ],
    rules: { "react-refresh/only-export-components": "off" },
  },
  eslintPluginPrettier,
);
