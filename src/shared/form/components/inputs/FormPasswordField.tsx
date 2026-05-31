import { EyeOff, Eye } from "lucide-react";
import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormPasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    name: string;
    label?: string;
    containerClassName?: string;
}

export const FormPasswordField: React.FC<FormPasswordFieldProps> = ({
    name,
    label,
    className,
    containerClassName,
    ...props
}) => {
    const { control } = useFormContext();
    const [showPassword, setShowPassword] = useState(false);

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
                    {label && (
                        <Label
                            htmlFor={name}
                            className="ml-1 text-(--text-muted) dark:text-zinc-300 mb-1 font-bold leading-none text-[clamp(1.125rem,1.25vw,1.25rem)]"
                        >
                            {label}
                        </Label>
                    )}

                    <div className="relative">
                        <Input
                            {...field}
                            {...props}
                            id={name}
                            type={showPassword ? "text" : "password"}
                            value={field.value ?? ""}
                            className={cn(
                                "h-12 rounded-xl pr-12 transition-all focus-visible:ring-2",
                                error
                                    ? "border-red-500 focus-visible:ring-red-500/20"
                                    : "focus-visible:border-blue-500 focus-visible:ring-blue-500/20",
                                className
                            )}
                        />

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-zinc-500 hover:bg-transparent hover:text-zinc-900 dark:hover:text-zinc-100"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                            <span className="sr-only">
                                {showPassword ? "Hide password" : "Show password"}
                            </span>
                        </Button>
                    </div>

                    {error && (
                        <p className="text-xs font-medium text-red-500 ml-1 animate-in fade-in slide-in-from-top-1">
                            {error.message}
                        </p>
                    )}
                </div>
            )}
        />
    );
};