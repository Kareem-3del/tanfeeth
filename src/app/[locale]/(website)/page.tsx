import { FeaturesSection } from "@/components/home/featuresSection";
import { Hero } from "@/components/home/hero";
import { SocialProofSection } from "@/components/home/socialProofSection";
import { StrategiesSection } from "@/components/home/strategiesSection";

export default function Home() {
    return <>
        <Hero />
        <FeaturesSection />
        <SocialProofSection />
        <StrategiesSection />
    </>
}