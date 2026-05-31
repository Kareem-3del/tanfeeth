"use client"

import { Globe, Search, Settings, User } from "lucide-react";
import Image from "next/image";

import { paths } from "@/config/paths";
import { Link } from "@/lib/i18n/routing";
import { useAppLocal } from "@/lib/i18n/use-locale";
import { useAppTranslation } from "@/lib/i18n/use-translation";

import ButtonWrapper from "../wrappers/buttonWrapper";

export function Header() {
    const t = useAppTranslation("layout")

    const { toggleLanguage } = useAppLocal()
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60">
            <div className="container mx-auto flex items-center justify-between px-10 py-8">
                <Link href={paths.home} className="flex max-w-[110] items-center gap-8">
                    <Image src="/logo.svg" alt="Logo" width={100} height={40} />
                </Link>

                <div className="flex items-center gap-4">

                    <ButtonWrapper onClick={toggleLanguage}>
                        <Globe className="h-5 w-5 text-black stroke-[2.5]" />
                    </ButtonWrapper>

                    <ButtonWrapper>
                        <Search className="h-5 w-5 text-black stroke-[2.5]" />
                    </ButtonWrapper>

                    <ButtonWrapper>
                        <User className="h-4 w-4  text-black stroke-[2.5]" />
                        {t("header.loginBtn")}
                    </ButtonWrapper>
                </div>
            </div>
        </header>
    );
}