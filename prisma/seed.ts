import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

async function upsertOrg(name: string, label: string, password: string, isTest: boolean) {
  const hashed = await hashPassword(password);
  return prisma.organization.upsert({
    where: { password: hashed },
    update: {},
    create: { name, label, password: hashed, isTest },
  });
}

async function main() {
  const main1 = await upsertOrg("生駒祭 出店", "", "admin", false);
  const vpro = await upsertOrg("vpro 出店", "vpro", "vpro", false);
  const test = await upsertOrg("テスト用", "TEST", "TEST", true);

  for (const org of [main1, vpro, test]) {
    const count = await prisma.product.count({ where: { orgId: org.id } });
    if (count > 0) continue;
    await prisma.product.createMany({
      data: [
        { orgId: org.id, name: "焼きとうもろこし", price: 200, sortOrder: 1 },
        { orgId: org.id, name: "検品", price: 0, sortOrder: 2 },
        { orgId: org.id, name: "廃棄", price: 0, sortOrder: 3 },
      ],
    });
  }

  console.log("seeded organizations:");
  console.log("  admin  -> password: admin");
  console.log("  vpro   -> password: vpro (label: vpro)");
  console.log("  TEST   -> password: TEST (label: TEST)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
