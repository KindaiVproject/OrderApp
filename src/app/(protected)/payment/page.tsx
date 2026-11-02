import { auth } from "@/auth";
import { isInstanceAdmin, requireCurrentInstance } from "@/lib/instance";
import { PAYMENT_LINK_KINDS } from "@/lib/paymentLinks";
import QRCode from "qrcode";
import PaymentClient from "./PaymentClient";

export default async function PaymentPage() {
  const instance = await requireCurrentInstance();
  const session = await auth();
  const canEdit = await isInstanceAdmin(instance.id, session?.user?.email);

  // QR images are drawn here, on the server, so the browser needs no QR code.
  // Level H survives the logo PaymentClient lays over the middle.
  const links = await Promise.all(
    PAYMENT_LINK_KINDS.map(async ({ kind, label, field }) => {
      const url = instance[field];
      const qr = url
        ? await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 640 })
        : null;
      return { kind, label, url, qr };
    }),
  );

  return <PaymentClient links={links} canEdit={canEdit} />;
}
