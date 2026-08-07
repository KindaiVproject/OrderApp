import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  events: {
    // Link any pending invitations (created before this person ever signed
    // in) to their now-known user id.
    async signIn({ user }) {
      if (!user.email || !user.id) return;
      await prisma.instanceMember.updateMany({
        where: { email: user.email, userId: null },
        data: { userId: user.id },
      });
    },
  },
});
