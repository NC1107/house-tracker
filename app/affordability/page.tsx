import AffordabilityCalculator from "@/components/AffordabilityCalculator";
import { PageHeader } from "@/components/ui";
import { latestMortgageRate } from "@/lib/queries";
import { NATIONAL } from "@/lib/reference";

export const dynamic = "force-dynamic";

export default async function AffordabilityPage() {
  const rate = await latestMortgageRate("30yr");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Affordability"
        subtitle={`Bank-grade underwriting math — full PITI, PMI/MIP, and real front/back-end DTI ratios. ${
          rate ? `Rate prefilled from FRED (${rate.rate.toFixed(2)}%).` : "Rate defaults to 6.8% until data is ingested."
        }`}
      />
      <AffordabilityCalculator defaultRate={rate?.rate ?? 6.8} defaultIncome={NATIONAL.medianHouseholdIncome} />
    </div>
  );
}
