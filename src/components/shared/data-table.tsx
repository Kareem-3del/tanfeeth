import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// تعريف واجهة الأعمدة بشكل عام (Generic)
export interface ColumnDef<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode; // لاستخدام مخصص إذا كان الحقل يحتاج تنسيق
}

interface DataTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
}

export function DataTable<T>({ data, columns }: DataTableProps<T>) {
    return (
        <div className="rounded-md border border-zinc-200">
            <Table>
                <TableHeader>
                    <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                        {columns.map((col, index) => (
                            <TableHead key={index} className="font-medium text-[12px] text-(--text-secondary)">
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {columns.map((col, colIndex) => (
                                <TableCell key={colIndex} className="font-medium text-[12px] text-(--text-secondary)">
                                    {col.cell
                                        ? col.cell(item)
                                        : (item[col.accessorKey as keyof T] as React.ReactNode)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}