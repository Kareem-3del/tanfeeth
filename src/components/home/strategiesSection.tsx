"use client";

import Image from "next/image";

import { useAppTranslation } from "@/lib/i18n/use-translation";

import { Container } from "../layout/container";

export function StrategiesSection() {
    const t = useAppTranslation("common");

    return (
        <section className="w-full py-[96px] bg-[#F9FAFB]">
            <Container>
                <div className="flex flex-col items-center gap-[64px]">

                    {/* Section Content */}
                    <div className="flex flex-col items-center gap-[24px] max-w-[1216px] w-full">

                        {/* Icon - مكان أيقونة الهدف */}
                        <div className="relative w-[58px] h-[58px]">
                            <Image
                                src="/home/target-icon.svg" // تأكد من وضع أيقونتك هنا
                                alt="Strategy"
                                fill
                                className="object-contain"
                            />
                        </div>

                        {/* Heading مع Clamp */}
                        <h2
                            className="font-extrabold text-primary text-center text-[clamp(28px,3vw,36px)] leading-[125%]"
                        >
                            {t("home.strategies.heading")}
                        </h2>

                        {/* Content Text مع Clamp */}
                        <p
                            className="font-normal text-[#111928] text-right max-w-[768px] leading-[162.5%] text-[clamp(18px,2vw,24px)]"
                            style={{ fontFamily: 'Tajawal' }}
                        >
                            {t("home.strategies.description")}
                        </p>
                    </div>

                </div>
            </Container>
        </section>
    );
}