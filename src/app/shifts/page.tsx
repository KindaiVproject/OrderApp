import Link from "next/link";
import { auth } from "@/auth";
import InstanceHeader from "@/components/InstanceHeader";
import { getCurrentInstance, getMyInstances, requireSession } from "@/lib/instance";
import { currentTimeMs } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import MyShiftsClient from "./MyShiftsClient";
import ShiftScopeSwitcher from "./ShiftScopeSwitcher";
import InstanceShifts from "./InstanceShifts";

// /shifts has two modes: no query = my shifts across every instance I can
// open; ?instance=<id> = that instance's full shift view. It lives outside
// the (protected) group so it also opens from the account menu with no
// instance selected.
export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ instance?: string }> }) {
  await requireSession();
  const { instance: instanceParam } = await searchParams;
  const [openable, current] = await Promise.all([
    getMyInstances().then((list) => list.filter((i) => i.active)),
    getCurrentInstance(),
  ]);
  const selected = openable.find((i) => i.id === instanceParam) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      {current ? (
        <InstanceHeader instance={current} />
      ) : (
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
          <span className="mr-auto text-sm font-semibold text-neutral-800">注文管理</span>
          <Link href="/instances" className="font-medium text-neutral-600 hover:underline">
            インスタンス選択
          </Link>
          <Link href="/account" className="font-medium text-neutral-600 hover:underline">
            アカウント設定
          </Link>
        </header>
      )}

      <main className="flex flex-1 flex-col">
        {openable.length === 0 ? (
          <p className="mx-auto w-full max-w-3xl p-4 text-sm text-neutral-500">
            開けるインスタンスがありません。管理者に招待を依頼してください。
          </p>
        ) : (
          <>
            <div className="mx-auto w-full max-w-3xl px-4 pt-4">
              <ShiftScopeSwitcher
                instances={openable.map((i) => ({ id: i.id, name: i.label || i.name }))}
                value={selected?.id ?? ""}
              />
            </div>
            {selected ? <InstanceShifts instanceId={selected.id} /> : <MyShifts />}
          </>
        )}
      </main>
    </div>
  );
}

async function MyShifts() {
  const session = await auth();
  const assignments = await prisma.shiftAssignment.findMany({
    where: { member: { email: session?.user?.email ?? "" }, shift: { instance: { active: true } } },
    include: { shift: { include: { instance: true } } },
    orderBy: { shift: { startsAt: "asc" } },
  });

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <MyShiftsClient
        nowMs={currentTimeMs()}
        shifts={assignments.map((a) => ({
          id: a.id,
          instanceId: a.shift.instanceId,
          instanceName: a.shift.instance.name,
          instanceLabel: a.shift.instance.label,
          startsAt: a.shift.startsAt.toISOString(),
          endsAt: a.shift.endsAt.toISOString(),
          role: a.role,
        }))}
      />
    </div>
  );
}
