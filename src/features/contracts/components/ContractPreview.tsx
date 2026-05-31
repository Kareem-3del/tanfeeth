import { ContractFormValues } from '../schemas/contract-schema';

interface ContractPreviewProps {
    data: ContractFormValues;
}

export function ContractPreview({ data }: ContractPreviewProps) {
    return (
        < div className="bg-white p-12.5 shadow-sm border border-zinc-300 w-[210mm] mx-auto font-[Tajawal] text-black overflow-hidden box-border" >

            {/* الجزء النصي الأول */}
            <div className="text-justify leading-[2.2] text-[15px] mb-8" >
                <p>
                    إشارة إلى المذكرة الداخلية المعتمدة رقم <b>({data.competitionReferenceNumber || "---"}) </b>
                    وتاريخ <b>{data.signingDate || "---"}</b>، بخصوص تشكيل اللجنة الدائمة لترسية عقود
                    <b> {data.projectOwnerName || "---"}</b>، وذلك لفحص عروض مناقصة <b>{data.name || "---"}</b>، قامت اللجنة بما يلي:
                </p>

                <p className="mt-4">
                    <b>أولاً:</b> الاطلاع على محضر لجنة فتح المظاريف، وتبين منه طرح هذا المشروع في مناقصة عامة،
                    وقامت اللجنة بتحليل ودراسة العروض المقدمة من الناحية النظامية والفنية، حيث اتضح ما يلي:
                </p>
            </div >

            {/* الجدول (مطابق للشكل الرسمي) */}
            <table className="w-full border-collapse border border-zinc-900 my-6" >
                <thead>
                    <tr className="bg-zinc-200">
                        <th className="border border-zinc-900 p-2 font-bold w-[10%]">الرقم</th>
                        <th className="border border-zinc-900 p-2 font-bold w-[40%]">الشركات/المؤسسات</th>
                        <th className="border border-zinc-900 p-2 font-bold w-[30%]">قيمة الايجار السنوي بالريال</th>
                        <th className="border border-zinc-900 p-2 font-bold w-[20%]">حالة العرض فنياً</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-zinc-900 p-3 text-center">1</td>
                        <td className="border border-zinc-900 p-3 text-center font-bold">{data.contractorName || "---"}</td>
                        <td className="border border-zinc-900 p-3 text-center">{data.contractValue?.toLocaleString() || "---"}</td>
                        <td className="border border-zinc-900 p-3 text-center">مقبول</td>
                    </tr>
                </tbody>
            </table >

            {/* الجزء النصي الثاني */}
            <div className="text-justify leading-[2.2] text-[15px]" >
                <p>
                    وبالتالي يكون عرض <b>"{data.contractorName || "---"}"</b> أفضل العروض مالياً ومقبول فنياً.
                    توصي اللجنة بترسية مناقصة تقديم خدمات السفر على الشركة المذكورة بمبلغ <b>{data.contractValue?.toLocaleString() || "---"}</b> ريال
                    شاملاً ضريبة القيمة المضافة.
                </p>
                <p className="font-bold text-center mt-6">والله الموفق،،</p>
            </div >

            {/* منطقة التوقيعات (دقيقة جداً حسب الصورة) */}
            <div className="mt-16" >
                <p className="font-bold border-b-2 border-black inline-block mb-10 pb-1">أعضاء ورئيس اللجنة:</p>

                <div className="grid grid-cols-4 gap-4 text-center text-[13px]">
                    {/* كل عمود يمثل توقيع */}
                    {[
                        { name: "لمى احمد", role: "ممثل نادي الموظفين" },
                        { name: "خالد محمد", role: "ممثل الرقابة المالية" },
                        { name: "مصطفى الحضرمي", role: "ممثل إدارة العقود" },
                        { name: "محمد الخواجي", role: "ممثل هيئة أملاك الدولة" }
                    ].map((member, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <span className="font-bold">{member.name}</span>
                            <div className="w-full border-t border-black my-2 pt-1">{member.role}</div>
                            <span className="font-bold">عضو</span>
                        </div>
                    ))}
                </div>

                {/* رئيس اللجنة (في المنتصف السفلي) */}
                <div className="mt-12 text-center">
                    <span className="font-bold block">نورا احمد</span>
                    <div className="w-48 border-t border-black my-2 pt-1 mx-auto">نادي الموظفين الاجتماعي</div>
                    <span className="font-bold block">رئيس اللجنة</span>
                </div>
            </div >
        </div >
    );
}