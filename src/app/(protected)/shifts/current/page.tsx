import InstanceShifts from "@/app/shifts/InstanceShifts";
import { requireCurrentInstance } from "@/lib/instance";

// The shift screen from inside an instance: the protected layout supplies the
// regular header, and it always shows the current instance (no scope switcher).
export default async function CurrentInstanceShiftsPage() {
  const instance = await requireCurrentInstance();
  return <InstanceShifts instanceId={instance.id} />;
}
