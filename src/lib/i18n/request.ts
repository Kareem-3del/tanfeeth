import { getRequestConfig } from 'next-intl/server';

import { SupportedLocale } from '@/types';

import { getMessagesData } from './messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale as SupportedLocale;

    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    const messages = await getMessagesData(locale);

    return {
        locale: locale as "en" | "ar",
        messages,
        timeZone: 'Africa/Cairo',
    };
});