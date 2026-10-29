import { getAdminEmail, requireAdmin } from "@/lib/instance";
import { prisma } from "@/lib/prisma";
import UsersClient, { type Person } from "./UsersClient";

// Everyone the app knows about, across all instances: people who signed in, and
// people who were only invited (never signed in). Admin only.
export default async function UsersPage() {
  await requireAdmin();
  const [users, members, adminInvites] = await Promise.all([
    prisma.user.findMany({ include: { _count: { select: { pushSubscriptions: true } } } }),
    prisma.instanceMember.findMany({ include: { instance: true }, orderBy: { createdAt: "asc" } }),
    prisma.adminInvite.findMany(),
  ]);

  const adminEmails = new Set([getAdminEmail(), ...adminInvites.map((a) => a.email)].filter(Boolean));
  const people = new Map<string, Person>();

  for (const u of users) {
    people.set(u.email, {
      email: u.email,
      userId: u.id,
      googleName: u.name,
      displayName: u.displayName,
      image: u.image,
      isAdmin: adminEmails.has(u.email),
      devices: u._count.pushSubscriptions,
      reminder30: u.shiftReminder30,
      memberships: [],
    });
  }
  for (const m of members) {
    let person = people.get(m.email);
    if (!person) {
      // Invited but never signed in.
      person = {
        email: m.email,
        userId: null,
        googleName: null,
        displayName: null,
        image: null,
        isAdmin: adminEmails.has(m.email),
        devices: 0,
        reminder30: null,
        memberships: [],
      };
      people.set(m.email, person);
    }
    person.memberships.push({
      instanceId: m.instanceId,
      instanceName: m.instance.name,
      active: m.instance.active,
      isInstanceAdmin: m.isInstanceAdmin,
      memberName: m.displayName,
    });
  }
  // Admins who are in no instance and never signed in still show up.
  for (const email of adminEmails) {
    if (!people.has(email)) {
      people.set(email, {
        email,
        userId: null,
        googleName: null,
        displayName: null,
        image: null,
        isAdmin: true,
        devices: 0,
        reminder30: null,
        memberships: [],
      });
    }
  }

  const instances = [...new Map(members.map((m) => [m.instanceId, m.instance.name])).entries()].map(
    ([id, name]) => ({ id, name }),
  );
  return <UsersClient initialPeople={[...people.values()]} instances={instances} />;
}
