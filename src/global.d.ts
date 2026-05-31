import { MessagesData } from './lib/i18n/messages';
import { routing } from './lib/i18n/routing';

// type Messages = Awaited<ReturnType<typeof Me>>;

declare module 'next-intl' {
    interface AppConfig {
        Locale: (typeof routing.locales)[number];
        Messages: MessagesData;
    }
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntlMessages extends MessagesData { }
}

export { };