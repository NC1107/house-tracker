import AffordabilityCalculator from "@/components/AffordabilityCalculator";
import { PageHeader } from "@/components/ui";
import { latestMortgageRate } from "@/lib/queries";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function AffordabilityPage() {
  const [rate, profile] = await Promise.all([latestMortgageRate("30yr"), getProfile()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Affordability"
        subtitle={`Full PITI, PMI/MIP, and real front/back-end DTI ratios — the same checks a lender runs. ${
          rate ? `Rate prefilled from FRED (${rate.rate.toFixed(2)}%).` : "Rate defaults to 6.8% until data is ingested."
        }`}
      />
      <AffordabilityCalculator
        defaultRate={rate?.rate ?? 6.8}
        defaultIncome={profile.income}
        defaultDownPct={Math.round(profile.downPct * 100)}
        defaultDebts={profile.monthlyDebts}
      />
    </div>
  );
}
