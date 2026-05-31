"use client";

import { useContext, type ReactNode } from "react";

import { paths } from "@/config/paths";
import { AuthStateContext } from "@/features/auth/context/AuthStateContext";
import { redirect } from "@/lib/i18n/routing";
import { useAppLocal } from "@/lib/i18n/use-locale";

import { SplashScreen } from "../feedback/SplashScreen";


interface Props {
    redirectTo?: string;
    children: ReactNode;
}

export function ProtectedRoute({ redirectTo = paths.auth.login, children }: Props) {
    const authState = useContext(AuthStateContext);
    const { lang } = useAppLocal()

    if (authState?.isLoading) {
        return (
            <div className="w-full h-screen">
                <SplashScreen withLogo />
            </div>
        );
    }

    if (!authState?.isAuthenticated) {
        redirect({ href: redirectTo, locale: lang });
        return null;
    }

    return <>{children}</>;
}