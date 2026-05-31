// src/proxy.ts
import createMiddleware from 'next-intl/middleware';

import { routing } from './lib/i18n/routing';


export default createMiddleware(routing);

export const config = {
    // Skip all internal paths and all static files (with dots)
    matcher: [
        // 1. Match the root directly
        '/',
        // 2. Match all localized routes
        '/(ar|en)/:path*',
        // 3. The "Secret Sauce": Ignore anything that has a dot (files) or starts with _next
        '/((?!api|_next|.*\\..*).*)'
    ]
};