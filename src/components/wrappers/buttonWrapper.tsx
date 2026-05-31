import React, { ReactNode } from 'react'

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';

interface Props {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string,
    children?: ReactNode
}

export default function ButtonWrapper({ onClick, className, children }: Props) {
    return (
        <Button
            className={cn(
                "bg-white cursor-pointer text-slate-900 shadow-md border border-slate-200 hover:bg-slate-50 hover:shadow-lg transition-all duration-200",
                className
            )}
            onClick={onClick}
        >
            {children}
        </Button>
    )
}