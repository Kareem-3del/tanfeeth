"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button"; // تأكد من وجود Button من shadcn
import { useAppTranslation } from "@/lib/i18n/use-translation";

import { Container } from "../layout/container";

export function Hero() {
    const t = useAppTranslation("common");

    return (
        <section className="w-full py-12 lg:py-20 bg-white">
            <Container>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    <div className="flex flex-col items-start gap-6 order-2 lg:order-1">
                        <h1
                            className="text-6xl lg:text-8xl font-bold text-primary"
                        >
                            {t("home.hero.title")}
                        </h1>

                        <p
                            className="text-lg lg:text-xl text-slate-600 max-w-lg leading-relaxed"
                        >
                            {t("home.hero.subtitle")}
                        </p>


                        <div className="flex flex-wrap gap-4 mt-4">
                            <Button
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary/5 px-8 py-6 text-lg rounded-md"
                            >
                                {t("home.hero.abouTanfeeth")}
                            </Button>
                            <Button
                                className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-md"
                            >
                                {t("home.hero.login")}
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-center items-center order-1 lg:order-2">
                        <div className="relative w-full max-w-[500px] aspect-square">
                            <Image
                                src="/logo-crop.svg" // تأكد من وضع صورة الشعار الكبير في مجلد public
                                alt="Tanfeeth Hero"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>

                </div>
            </Container>



        </section>
    );
}