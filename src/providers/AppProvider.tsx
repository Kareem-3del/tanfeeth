"use client";

import { NextIntlClientProvider } from "next-intl";
import { ReactNode } from "react";
import { Slide, ToastContainer } from 'react-toastify';



import { MessagesData } from "@/lib/i18n/messages";
import { SupportedLocale } from "@/types";

import { ReactQueryProvider } from "./ReactQueryProvider";
import { ThemeProvider } from "./ThemeProvider";

interface ProvidersProps {
    children: ReactNode;
    locale: SupportedLocale;
    messages: MessagesData;
}

export function AppProvider({ children, locale, messages }: ProvidersProps) {
    return (
        <NextIntlClientProvider timeZone="Africa/Cairo" locale={locale} messages={messages}>
            {/* <AuthProvider> */}
            <ReactQueryProvider>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ToastContainer transition={Slide} />
                    {children}
                </ThemeProvider>
            </ReactQueryProvider>
            {/* </AuthProvider> */}

        </NextIntlClientProvider>
    );
}