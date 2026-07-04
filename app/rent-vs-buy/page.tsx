import RentVsBuy from "@/components/RentVsBuy";
import { latestMortgageRate } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RentVsBuyPage() {
  const rate = await latestMortgageRate("30yr");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rent vs. Buy</h1>
        <p className="text-sm text-slate-500">
          Compares building equity by buying against investing your down payment while
          renting — the net-worth method, accounting for closing costs, maintenance, and
          opportunity cost. Finds your breakeven horizon.
        </p>
      </div>
      <RentVsBuy defaultRate={rate?.rate ?? 6.8} />
    </div>
  );
}
