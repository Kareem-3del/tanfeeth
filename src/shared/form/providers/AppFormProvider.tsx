import { FormProvider, type UseFormReturn, type FieldValues } from "react-hook-form";

import { cn } from "@/lib/utils";

export type FormProps<T extends FieldValues> = {
  onSubmit: (data: T) => void;
  children: React.ReactNode;
  methods: UseFormReturn<T>;
  className?: string;
};

export function AppFormProvider<T extends FieldValues>({
  children,
  onSubmit,
  methods,
  className,
}: FormProps<T>) {
  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(e) => {
          e.stopPropagation();
          methods.handleSubmit(onSubmit)(e);
        }}
        noValidate
        autoComplete="on"
        className={cn("space-y-4", className)}
      >
        {children}
      </form>
    </FormProvider>
  );
}