import AffordabilityCalculator from "@/components/AffordabilityCalculator";
import { latestMortgageRate } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AffordabilityPage() {
  const rate = await latestMortgageRate("30yr");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Affordability</h1>
        <p className="text-sm text-slate-500">
          Bank-grade math — full PITI, PMI/MIP, and real DTI underwriting ratios. Rate
          {rate ? ` prefilled from the latest FRED reading (${rate.rate.toFixed(2)}%).` : " defaults to 6.8% until data is ingested."}
        </p>
      </div>
      <AffordabilityCalculator defaultRate={rate?.rate ?? 6.8} />
    </div>
  );
}
