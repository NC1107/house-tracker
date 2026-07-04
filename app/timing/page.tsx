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
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text-2)]">
        Waiting isn&apos;t automatically worse — this only compares buying now vs. later. If you&apos;d
        rent and invest in the meantime, see{" "}
        <a href="/rent-vs-buy" className="font-medium text-[var(--brand)] underline">Rent vs. Buy</a>{" "}
        for the full picture.
      </p>
      <CostOfWaiting defaultRate={rate?.rate ?? 6.8} defaultPrice={NATIONAL.medianHomePrice} />
    </div>
  );
}
