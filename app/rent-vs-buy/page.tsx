import RentVsBuy from "@/components/RentVsBuy";
import { PageHeader } from "@/components/ui";
import { latestMortgageRate } from "@/lib/queries";
import { NATIONAL } from "@/lib/reference";

export const dynamic = "force-dynamic";

export default async function RentVsBuyPage() {
  const rate = await latestMortgageRate("30yr");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent vs. Buy"
        subtitle="Compares building equity by buying against investing your down payment while renting — the net-worth method, accounting for closing costs, maintenance, and opportunity cost. Finds your breakeven horizon."
      />
      <RentVsBuy defaultRate={rate?.rate ?? 6.8} defaultRent={NATIONAL.medianAskingRent} />
    </div>
  );
}
