// components/FormStepper.tsx
import { cn } from "@/lib/utils";

interface Step {
    id: string;
    label: string;
}

export function FormStepper({ steps, activeStep }: { steps: Step[], activeStep: number }) {
    return (
        <div className="hidden lg:flex flex-col gap-8 sticky top-24">
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-4">
                    <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors",
                        index <= activeStep ? "bg-teal-700 text-white" : "bg-zinc-100 text-zinc-400"
                    )}>
                        {index + 1}
                    </div>
                    <span className={cn("font-medium", index <= activeStep ? "text-teal-700" : "text-zinc-500")}>
                        {step.label}
                    </span>
                </div>
            ))}
        </div>
    );
}