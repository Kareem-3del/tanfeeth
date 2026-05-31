import { SupportedLocale } from "@/types";

export const getLocalizedFieldValue = <T extends Record<string, any>>(
    data: T | null | undefined,
    lang: SupportedLocale,
    prefix: string = "name",
    fallbackKey?: keyof T
): string => {
    if (!data) return "";

    const localizedKey = `${prefix}_${lang}`;
    const defaultFallback = `${prefix}_en`;

    const value = data[localizedKey] ?? (fallbackKey ? data[fallbackKey] : data[defaultFallback]);

    return (typeof value === 'string' && value.trim() !== '' ? value : "---");
};
