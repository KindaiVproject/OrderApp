import { prisma } from "../src/lib/prisma";

function requireAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error("Set ADMIN_EMAIL in .env before seeding.");
  return email;
}
const ADMIN_EMAIL = requireAdminEmail();

async function upsertInstance(name: string, label: string, active: boolean, memberEmails: string[]) {
  const existing = await prisma.instance.findFirst({ where: { name } });
  const instance =
    existing ??
    (await prisma.instance.create({ data: { name, label, active } }));

  for (const email of memberEmails) {
    await prisma.instanceMember.upsert({
      where: { instanceId_email: { instanceId: instance.id, email } },
      update: {},
      create: { instanceId: instance.id, email },
    });
  }

  const count = await prisma.product.count({ where: { instanceId: instance.id } });
  if (count === 0) {
    await prisma.product.createMany({
      data: [
        { instanceId: instance.id, name: "焼きとうもろこし", price: 200, sortOrder: 1 },
        { instanceId: instance.id, name: "検品", price: 0, sortOrder: 2 },
        { instanceId: instance.id, name: "廃棄", price: 0, sortOrder: 3 },
      ],
    });
  }

  return instance;
}

async function main() {
  await upsertInstance("生駒祭 出店", "", true, [ADMIN_EMAIL]);
  await upsertInstance("vpro 出店", "vpro", true, [ADMIN_EMAIL]);
  await upsertInstance("停止中サンプル", "STOP", false, [ADMIN_EMAIL]);

  console.log(`seeded instances, all inviting ${ADMIN_EMAIL} as a member.`);
  console.log(`sign in with Google as ${ADMIN_EMAIL} to see them on /instances,`);
  console.log("or go to /admin to create more instances and invite other accounts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
