import CostOfWaiting from "@/components/CostOfWaiting";
import { PageHeader } from "@/components/ui";
import { latestMortgageRate } from "@/lib/queries";
import { NATIONAL } from "@/lib/reference";

export const dynamic = "force-dynamic";

export default async function TimingPage() {
  const rate = await latestMortgageRate("30yr");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost of Waiting"
        subtitle="Thinking of holding off? See what a delay does to your monthly payment, the cash you need, and lifetime interest if prices and rates move."
      />
      <CostOfWaiting defaultRate={rate?.rate ?? 6.8} defaultPrice={NATIONAL.medianHomePrice} />
    </div>
  );
}
