import { useFormContext, Controller } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Props {
    label: string;
    name: string;
    className?: string;
}

export function FormSwitch({ label, name, className }: Props) {
    const { control } = useFormContext();

    return (
        <Controller
            name={name}
            control={control}
            render={({ field }) => (
                <div className={cn("flex items-center space-x-3 space-x-reverse py-1", className)}>
                    <Switch
                        id={name}
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-blue-600"
                    />
                    <Label
                        htmlFor={name}
                        className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none"
                    >
                        {label}
                    </Label>
                </div>
            )}
        />
    );
}