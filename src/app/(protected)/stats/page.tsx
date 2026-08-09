import { requireCurrentInstance } from "@/lib/instance";
import { getOrderStats } from "@/lib/stats";
import StatsClient from "./StatsClient";

export default async function StatsPage() {
  const instance = await requireCurrentInstance();
  const { dailyTotals, hourlyByDay } = await getOrderStats(instance.id);

  return <StatsClient dailyTotals={dailyTotals} hourlyByDay={hourlyByDay} />;
}
