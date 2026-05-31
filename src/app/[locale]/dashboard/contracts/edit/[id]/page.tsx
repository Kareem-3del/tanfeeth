"use client";

import { useContractsStore } from "@/features/contracts/store/useContractsStore";
import { ContractForm } from "@/features/contracts/forms/ContractForm";

interface EditContractPageProps {
    params: { id: string };
}

export default function Page({ params }: EditContractPageProps) {
    const contract = useContractsStore((state) =>
        state.contracts.find((item) => item.id === params.id)
    );

    if (!contract) {
        return <div>العقد غير موجود</div>;
    }

    return (
        <div className="p-8">
            <ContractForm contract={contract} />
        </div>
    );
}