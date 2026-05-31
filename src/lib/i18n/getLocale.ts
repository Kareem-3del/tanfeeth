
import { SupportedLocale } from '@/types';
import { getLocalizedFieldValue } from '@/utils/locale';

export async function getAppLocale(
    locale: string,
) {
    const lang = locale as SupportedLocale;

    const dir = lang === "ar" ? "rtl" : "ltr";

    const getLocalizedValue = <T extends Record<string, any>>(
        data: T | null | undefined,
        prefix: string = "name",
        fallbackKey?: keyof T
    ) => getLocalizedFieldValue(data, lang, prefix, fallbackKey);

    return {
        lang,
        dir,
        getLocalizedValue,
    };
}