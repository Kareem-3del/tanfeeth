"use client";


import { useTranslations } from "next-intl";

import { AppNamespace } from "@/types";

export function useAppTranslation<N extends AppNamespace>(namespace?: N) {
    const t = useTranslations(namespace);

    return t
}