
import { getTranslations } from 'next-intl/server';

import { AppNamespace, SupportedLocale } from '@/types';

export async function getAppTranslation<N extends AppNamespace>(
    locale: string,
    namespace?: N,
) {
    const lang = locale as SupportedLocale;

    // next-intl server-side call
    const t = await getTranslations({
        locale: lang,
        namespace: namespace
    });

    return {
        t
    };
}