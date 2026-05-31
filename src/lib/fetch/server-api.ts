import { env } from "process";

import { cookies } from "next/headers";

import { ACCESS_TOKEN_KEY, LOCALE_KEY } from "@/config/constants";
import { FetchOptions, SupportedLocale } from "@/types";

export async function serverApi<T>(
    endpoint: string,
    { params, useAuth = false, locale, ...options }: FetchOptions & { locale?: SupportedLocale } = {}
): Promise<T> {
    const baseUrl = env.serverUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = new URL(`${baseUrl}/api${cleanEndpoint}`);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                fullUrl.searchParams.append(key, String(value));
            }
        });
    }

    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");

    let currentLocale = locale;

    if (useAuth) {
        const cookieStore = await cookies();
        const token = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
        if (!currentLocale) {
            currentLocale = cookieStore.get(LOCALE_KEY)?.value as SupportedLocale;
        }

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }

    headers.set("Accept-Language", currentLocale || "ar");

    const response = await fetch(fullUrl.toString(), {
        ...options,
        headers,
    });

    const responseText = await response.text();
    let data;
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw {
            status: response.status,
            message: data.message || "Server Error",
            errors: data.errors
        };
    }

    return data as T;
}