// app/[locale]/(dashboard)/layout.tsx
import { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";

interface Props {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}