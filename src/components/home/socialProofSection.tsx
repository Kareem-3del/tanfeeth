"use client";

import Image from "next/image";

import { useAppTranslation } from "@/lib/i18n/use-translation";

import { Container } from "../layout/container";

export function SocialProofSection() {
    const t = useAppTranslation("common");

    return (
        <section className="w-full py-24 bg-white">
            <Container>
                <div className="flex flex-col lg:flex-row items-center justify-between gap-16">


                    {/* Left Content: Text (النصوص) */}
                    <div className="flex flex-col gap-2 max-w-160">
                        <h2
                            className="font-extrabold text-primary text-[clamp(24px,2vw+20px,36px)] leading-[125%]"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            {t("home.social_proof.heading")}
                        </h2>
                        <p className="text-[clamp(14px,1vw+12px,20px)] font-medium text-[#6B7280] leading-[150%]" >
                            {t("home.social_proof.description")}
                        </p>
                    </div>
                    <div className="flex flex-row gap-8 lg:gap-16 w-full lg:w-auto">
                        {/* Stat 1 */}
                        <div className="flex flex-col gap-2">
                            <div className="relative w-10.75 h-12.75">
                                <Image src="/home/arrows.svg" alt="icon" fill className="object-contain" />
                            </div>
                            <h3 className="text-[32px] font-extrabold text-[#111928]">{t("home.social_proof.stats.stat_1.value")}</h3>
                            <p className="text-[16px] font-bold text-[#6B7280]">{t("home.social_proof.stats.stat_1.label")}</p>
                        </div>

                        {/* Stat 2 */}
                        <div className="flex flex-col gap-2">
                            <div className="relative w-11.5 h-13">
                                <Image src="/home/star.svg" alt="icon" fill className="object-contain" />
                            </div>
                            <h3 className="text-[32px] font-extrabold text-[#111928]">{t("home.social_proof.stats.stat_2.value")}</h3>
                            <p className="text-[16px] font-bold text-[#6B7280]">{t("home.social_proof.stats.stat_2.label")}</p>
                        </div>
                    </div>


                </div>
            </Container>
        </section>
    );
}