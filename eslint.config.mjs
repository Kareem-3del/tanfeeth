import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginNext from "@next/eslint-plugin-next";
import pluginImport from "eslint-plugin-import";
import configPrettier from "eslint-config-prettier";

export default tseslint.config(
    // 1. الملفات التي يجب تجاهلها (مهم جداً لتجنب البطء)
    {
        ignores: [".next/**", "node_modules/**", "dist/**", "out/**"],
    },

    // 2. إعدادات لغة الـ TypeScript والـ JS الموصى بها
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // 3. إعدادات نكست والـ Hooks والـ React يدوياً لتجنب الـ Circular Error
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            "react": pluginReact,
            "react-hooks": pluginReactHooks,
            "@next/next": pluginNext,
            "import": pluginImport,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        rules: {
            // قواعد الـ Hooks الصارمة (ستعمل الآن فوراً)
            ...pluginReactHooks.configs.recommended.rules,
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            // قواعد نكست الأساسية
            ...pluginNext.configs.recommended.rules,
            ...pluginNext.configs["core-web-vitals"].rules,

            // --- القاعدة التي طلبتها لـ currentPage ---
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],

            "no-console": "warn",
            "prefer-const": "error",

            // --- ترتيب الـ Imports (Clean Architecture) ---
            "import/order": [
                "error",
                {
                    "groups": ["builtin", "external", "internal", ["parent", "sibling", "index"]],
                    "pathGroups": [{ "pattern": "@/**", "group": "internal" }],
                    "newlines-between": "always",
                    "alphabetize": { "order": "asc", "caseInsensitive": true }
                }
            ],
        },
    },

    configPrettier
);