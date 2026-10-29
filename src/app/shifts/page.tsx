import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentInstance, getMyInstances } from "@/lib/instance";
import { currentTimeMs } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import MyShiftsClient from "./MyShiftsClient";
import ShiftScopeSwitcher from "./ShiftScopeSwitcher";
import InstanceShifts from "./InstanceShifts";

// Link-preview card (Discord, X, Slack ...) for a shared /shifts link. The
// image is the route's own `opengraph-image.png`. These replace the root
// layout's openGraph object wholesale, so site name/type/locale are repeated.
const SHIFTS_TITLE = "シフトを確認";
const SHIFTS_DESCRIPTION = "注文管理 — ログインして自分のシフトを確認できます";
export const metadata: Metadata = {
  title: SHIFTS_TITLE,
  description: SHIFTS_DESCRIPTION,
  openGraph: {
    siteName: "注文管理",
    title: SHIFTS_TITLE,
    description: SHIFTS_DESCRIPTION,
    type: "website",
    locale: "ja_JP",
  },
  twitter: { card: "summary_large_image", title: SHIFTS_TITLE, description: SHIFTS_DESCRIPTION },
};

// Link-preview crawlers are never signed in. Normally that means a redirect to
// /login, and the card would then show the login page's tags — so they get a
// small public page here instead (no data, just the tags above).
const LINK_PREVIEW_BOT =
  /Discordbot|Twitterbot|Slackbot|facebookexternalhit|LinkedInBot|WhatsApp|TelegramBot|Applebot/i;

// /shifts has two modes: no query = my shifts across every instance I can
// open; ?instance=<id> = that instance's full shift view. It lives outside
// the (protected) group so it also opens from the account menu with no
// instance selected.
export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ instance?: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    const ua = (await headers()).get("user-agent") ?? "";
    if (LINK_PREVIEW_BOT.test(ua)) {
      return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-4 text-center">
          <h1 className="text-base font-semibold text-neutral-800">{SHIFTS_TITLE}</h1>
          <p className="text-xs text-neutral-500">{SHIFTS_DESCRIPTION}</p>
        </main>
      );
    }
    redirect("/login");
  }
  const { instance: instanceParam } = await searchParams;
  // Shifts stay viewable on stopped instances, so every membership counts.
  const [openable, current] = await Promise.all([getMyInstances(), getCurrentInstance()]);
  const selected = openable.find((i) => i.id === instanceParam) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Deliberately not the instance header: this page can show another
          (or no) instance, and the 注文/厨房/... panel would belong to
          whichever instance was opened last. */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
        <span className="mr-auto text-sm font-semibold text-neutral-800">注文管理 シフト</span>
        {current && (
          <Link href="/order" className="font-medium text-neutral-600 hover:underline">
            {current.label || current.name}に戻る
          </Link>
        )}
        <Link href="/instances" className="font-medium text-neutral-600 hover:underline">
          トップ
        </Link>
        <Link href="/account" className="font-medium text-neutral-600 hover:underline">
          アカウント設定
        </Link>
      </header>

      <main className="flex flex-1 flex-col">
        {openable.length === 0 ? (
          <p className="mx-auto w-full max-w-3xl p-4 text-sm text-neutral-500">
            参加しているインスタンスがありません。管理者に招待を依頼してください。
          </p>
        ) : (
          <>
            <div className="mx-auto w-full max-w-3xl px-4 pt-4">
              <ShiftScopeSwitcher
                instances={openable.map((i) => ({ id: i.id, name: `${i.label || i.name}${i.active ? "" : "(停止中)"}` }))}
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
    where: { member: { email: session?.user?.email ?? "" } },
    include: { shift: { include: { instance: true } } },
    orderBy: { shift: { startsAt: "asc" } },
  });

  // Each instance names/colors its own roles, so look the color up per instance.
  const roles = await prisma.shiftRole.findMany({
    where: { instanceId: { in: [...new Set(assignments.map((a) => a.shift.instanceId))] } },
  });
  const colorOf = (instanceId: string, role: string) =>
    roles.find((r) => r.instanceId === instanceId && r.name === role)?.color ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <MyShiftsClient
        nowMs={currentTimeMs()}
        shifts={assignments.map((a) => ({
          id: a.id,
          instanceId: a.shift.instanceId,
          instanceName: a.shift.instance.name,
          instanceLabel: a.shift.instance.label,
          instanceActive: a.shift.instance.active,
          startsAt: a.shift.startsAt.toISOString(),
          endsAt: a.shift.endsAt.toISOString(),
          role: a.role,
          roleColor: colorOf(a.shift.instanceId, a.role),
        }))}
      />
    </div>
  );
}
