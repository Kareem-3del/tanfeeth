"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";

import { SupportedLocale } from "@/types";
import { getLocalizedFieldValue } from "@/utils/locale";

import { usePathname, useRouter } from "./routing";


export function useAppLocal() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const lang = locale as SupportedLocale;
    const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

    /**
     * Extracts a localized string from a data object based on the current language.
     * Expects a pattern like {field}_en or {field}_ar.
     * * @param data - The object containing localized fields
     * @param prefix - The base name of the field (default is "name")
     * @param fallbackKey - A specific key to use if the localized one is empty
     */
    const getLocalizedValue = useCallback(
        <T extends Record<string, any>>(
            data: T | null | undefined,
            prefix: string = "name",
            fallbackKey?: keyof T
        ): string => getLocalizedFieldValue(data, lang, prefix, fallbackKey),
        [lang]
    );

    /**
     * Switches the application language between Arabic and English.
     * Maintains the current pathname.
     */
    const toggleLanguage = useCallback(() => {
        const nextLocale = lang === "en" ? "ar" : "en";
        router.replace(pathname, { locale: nextLocale });
    }, [lang, pathname, router]);

    return {
        lang,
        dir,
        getLocalizedValue,
        toggleLanguage,
    }
}