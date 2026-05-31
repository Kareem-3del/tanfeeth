"use client";

import { Plus } from "lucide-react";

import ActionButton from "@/components/shared/action-button";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { paths } from "@/config/paths";
import { Contract } from "@/features/contracts/types/contract";
import { useContractsStore } from "@/features/contracts/store/useContractsStore";
import { useRouter } from "@/lib/i18n/routing";
import { useAppTranslation } from "@/lib/i18n/use-translation"; // استدعاء دالة الترجمة

export default function ContractsPage() {
    const t = useAppTranslation("contracts"); // استخدام النطاق الخاص بالعقود
    const tCommon = useAppTranslation("common");

    const router = useRouter();
    const contracts = useContractsStore((state) => state.contracts);
    const deleteContract = useContractsStore((state) => state.deleteContract);

    const columns: ColumnDef<Contract>[] = [
        { header: t("fields.contractNumber"), accessorKey: "contractNumber" },
        { header: t("fields.name"), accessorKey: "name" },
        { header: t("fields.contractorName"), accessorKey: "contractorName" },
        {
            header: t("fields.contractValue"),
            cell: (row) => row.contractValue.toLocaleString()
        },
        { header: t("fields.contractStatus"), accessorKey: "contractStatus" },
        {
            header: tCommon("actions.viewDetails"),
            cell: (row) => (
                <div className="flex gap-2 items-center">
                    <Button
                        onClick={() => router.push(paths.dashboard.contracts.edit(row.id))}
                        variant="outline" size="sm"
                    >
                        {t("actions.sign")}
                    </Button>
                    <Button
                        onClick={() => {
                            if (confirm("هل أنت متأكد أنك تريد حذف هذا العقد؟")) {
                                deleteContract(row.id);
                            }
                        }}
                        variant="destructive"
                        size="sm"
                    >
                        حذف
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-zinc-900">{t("sections.basicInfo")}</h1>
                <ActionButton
                    variant="default"
                    onClick={() => router.push(paths.dashboard.contracts.add)}
                >
                    <Plus className="ml-2 h-4 w-4" /> {tCommon("actions.create")}
                </ActionButton>
            </div>

            <DataTable data={contracts} columns={columns} />
        </div>
    );
}