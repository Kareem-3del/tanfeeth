import { useEffect, useRef, type ReactNode } from 'react';
import { useFormState } from 'react-hook-form';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppTranslation } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

import { getFirstErrorPath, getAllErrorMessages } from '../../utilities/errors';


interface Props {
    children: ReactNode;
    submitText?: string;
    className?: string;
    contentClassName?: string;
    buttonClassName?: string;
    action?: ReactNode;
}

export function FormContainer({ action, children, submitText, contentClassName, className, buttonClassName }: Props) {
    const cardRef = useRef<HTMLDivElement>(null);

    const { isSubmitting, errors, submitCount } = useFormState();

    const isUploading = Object.values(errors).some(err => err?.message === "uploading");

    const t = useAppTranslation("common")

    useEffect(() => {

        if (submitCount > 0 && Object.keys(errors).length > 0) {

            const messages = getAllErrorMessages(errors);
            messages.forEach((err) => {
                toast.error(err, { toastId: err });
            });

            const fullErrorPath = getFirstErrorPath(errors);
            if (fullErrorPath) {
                const firstErrorPath = fullErrorPath.split('.')[0];

                const fieldElement =
                    document.querySelector(`[name="${firstErrorPath}"]`) ||
                    document.querySelector(`[name="${fullErrorPath}"]`) || // تجربة المسار كاملاً
                    document.querySelector(`[data-test="${CSS.escape(firstErrorPath)}"]`);

                if (fieldElement) {
                    fieldElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    });

                    fieldElement.classList.add('animate-shake');

                    const timer = setTimeout(() => {
                        (fieldElement as HTMLElement).focus?.();
                        fieldElement.classList.remove('animate-shake');
                    }, 400);

                    return () => clearTimeout(timer);
                }
            }
        }
    }, [errors, submitCount]);

    return (
        <Card
            ref={cardRef}
            className={cn("p-4 sm:p-6 rounded-[2rem] border-zinc-200 dark:border-zinc-800", className)}
        >
            <div className={cn("flex flex-col gap-6 md:gap-8", contentClassName)}>
                {children}

                <div className="flex items-center gap-4 ">
                    <Button
                        type="submit"
                        disabled={isSubmitting || isUploading}
                        className={cn(
                            "w-fit px-5 py-3 rounded-[8px] h-12 font-medium text-md transition-all active:scale-95",
                            buttonClassName
                        )}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                {submitText || t("actions.submit")}
                            </div>
                        ) : (
                            submitText || t("actions.submit")
                        )}
                    </Button>
                    {action}
                </div>

            </div>
        </Card>
    );
}