"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { FaFacebook, FaXTwitter, FaLinkedin, FaInstagram } from "react-icons/fa6";

import { paths } from "@/config/paths";
import { Link } from "@/lib/i18n/routing";

export function Footer() {
    const t = useTranslations("layout");

    const navLinks = [
        { key: "home", href: paths.home },
        { key: "login", href: paths.auth.login },
        { key: "about", href: paths.about },
        { key: "contact", href: paths.contact },
    ];

    return (
        <footer className="w-full bg-white py-10 border-t border-slate-100">
            <div className="container mx-auto px-4 flex flex-col items-center gap-6">

                {/* 1. أيقونات التواصل الاجتماعي */}
                <div className="flex gap-4 text-slate-600">
                    <FaFacebook className="h-5 w-5 cursor-pointer text-primary transition-colors" />
                    <FaXTwitter className="h-5 w-5 cursor-pointer text-primary transition-colors" />
                    <FaLinkedin className="h-5 w-5 cursor-pointer text-primary transition-colors" />
                    <FaInstagram className="h-5 w-5 cursor-pointer text-primary transition-colors" />
                </div>

                <nav className="flex items-center gap-8">
                    {navLinks.map((link, index) => (
                        <div key={link.key} className="flex items-center gap-8">
                            <Link
                                href={link.href}
                                className="text-[18px] font-medium text-primary transition-colors"
                            >
                                {t(`nav.${link.key}` as any)}
                            </Link>

                            {index < navLinks.length - 1 && (
                                <span
                                    className="bg-primary w-0.5 h-4 rounded-full"
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                    ))}
                </nav>

                {/* 3. النص الوصفي */}
                <p
                    className="text-center text-[14px] font-normal text-primary max-w-2xl leading-6"
                >
                    {t("footer.description")}
                </p>

                {/* 4. اللوجوهات والحقوق */}
                <div className="flex items-center justify-end w-full gap-8 mt-4">
                    <Image src="/vision-2030.svg" alt="Vision 2030" width={82} height={64} />

                    <Image src="/logo-crop.svg" alt="Tanfeeth Logo" width={82} height={64} />
                </div>

                <div
                    className="text-[16px] font-normal text-primary mt-2 leading-[100%]"
                    style={{ fontFamily: 'Noto Sans, sans-serif' }}
                >
                    {t("footer.rights")}
                </div>
            </div>
        </footer>
    );
}