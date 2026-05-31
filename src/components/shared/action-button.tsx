import React, { ReactNode } from 'react'

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';

interface Props {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string,
    children?: ReactNode;
    variant?: "link" | "default" | "outline" | "secondary" | "ghost" | "destructive" | null | undefined
}
export default function ActionButton({ onClick, className, children, variant }: Props) {
    return <Button
        onClick={onClick}
        type="button"
        variant={variant}
        className={cn(
            "w-fit px-5 py-3 rounded-[8px] h-12 font-medium text-md transition-all active:scale-95",
            className
        )}
    >

        {children}
    </Button>
}

