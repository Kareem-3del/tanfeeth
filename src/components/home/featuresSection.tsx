"use client";

import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

import { useAppTranslation } from "@/lib/i18n/use-translation";

import { Container } from "../layout/container";

export function FeaturesSection() {
    const t = useAppTranslation("common");
    const features: string[] = t.raw("home.features.list");
    const features_2: string[] = t.raw("home.features.list_2");

    return (
        <>
            <section className="w-full py-12 lg:py-24 bg-[#F9FAFB]">
                <Container>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                        <div className="w-full flex justify-center items-center">
                            {/* حاوية الصورة تأخذ المساحة المتاحة لها */}
                            <div className="relative w-full aspect-4/3 max-w-150">
                                <Image
                                    src="/home/ft-1.png"
                                    alt="Features"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-8 w-full">
                            <h2
                                className="text-[28px] md:text-[36px] font-extrabold leading-tight text-[#111928] text-right"
                            >
                                {t("home.features.title")}
                            </h2>

                            <div className="w-full h-px bg-[#E5E7EB]" />

                            <div className="flex flex-col gap-4 w-full">
                                {features.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3 w-full">
                                        {/* الأيقونة ثابتة الحجم */}
                                        <div className="min-w-5 h-5 mt-1 bg-[#337349] rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                        <span
                                            className="text-[16px] font-medium text-[#111928] leading-[150%] text-right"
                                        >
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Container>
            </section>

            <section className="w-full py-12 lg:py-24 bg-[#F9FAFB]">
                <Container>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                        <div className="flex flex-col items-start gap-8 w-full">
                            <h2
                                className="text-[28px] md:text-[36px] font-extrabold leading-tight text-[#111928] text-right"
                            >
                                {t("home.features.title_2")}
                            </h2>

                            <div className="w-full h-px bg-[#E5E7EB]" />

                            <div className="flex flex-col gap-4 w-full">
                                {features_2.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3 w-full">
                                        <div className="min-w-5 h-5 mt-1 bg-[#337349] rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                        <span
                                            className="text-[16px] font-medium text-[#111928] leading-[150%] text-right"
                                        >
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="w-full flex justify-center items-center">
                            {/* حاوية الصورة تأخذ المساحة المتاحة لها */}
                            <div className="relative w-full aspect-4/3 max-w-150">
                                <Image
                                    src="/home/ft-2.png"
                                    alt="Features"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        </div>

                    </div>
                </Container>
            </section>
        </>
    );
}