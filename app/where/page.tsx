import { PageHeader, Card, SectionTitle, EmptyNote, Freshness } from "@/components/ui";
import ChoroplethMap, { type StateDatum } from "@/components/ChoroplethMap";
import { statePaths } from "@/lib/geo/usStates";
import { latestMetricByState, latestMortgageRate, dbConfigured } from "@/lib/queries";
import { computeStateAffordability, affordabilityColor } from "@/lib/stateAffordability";
import { statePropertyTaxRate, stateInsuranceRate } from "@/lib/geo/stateCosts";
import { getProfile } from "@/lib/profile";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WherePage() {
  const [rateRow, states, stateIncomes] = await Promise.all([
    latestMortgageRate("30yr"),
    latestMetricByState("zhvi_all"),
    latestMetricByState("median_household_income"),
  ]);
  const rate = rateRow?.rate ?? 6.8;
  const profile = await getProfile();
  const income = profile.income;
  const geo = statePaths();

  // In the US-average view, judge each state against ITS OWN median income (Census ACS)
  // when that data is ingested; a personalized profile always uses the user's income.
  const incomeByState = new Map(stateIncomes.map((s) => [s.stateCode, s.value]));
  const usingLocalIncomes = !profile.isCustom && incomeByState.size > 0;

  const data: (StateDatum & { localIncome: number })[] = states
    .map((s) => {
      const localIncome = profile.isCustom ? income : (incomeByState.get(s.stateCode) ?? income);
      const a = computeStateAffordability(s.value, localIncome, rate, {
        propertyTaxRate: statePropertyTaxRate(s.stateCode),
        insuranceRate: stateInsuranceRate(s.stateCode),
        monthlyDebts: profile.monthlyDebts,
        downPct: profile.downPct,
      });
      return { stateCode: s.stateCode, name: s.name, localIncome, ...a };
    })
    .sort((a, b) => a.requiredIncome - b.requiredIncome);

  const affordableCount = data.filter((d) => d.affordable).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Where Can We Afford?"
        subtitle={
          usingLocalIncomes
            ? `Every state colored by how its typical home compares to that state's own median household income (Census ACS) at today's ${rate.toFixed(2)}% rate. Greener is more affordable.`
            : `Every state colored by how its typical home compares to ${profile.isCustom ? "your" : "the median US"} household income ($${income.toLocaleString()}/yr) at today's ${rate.toFixed(2)}% rate. Greener is more affordable.`
        }
        action={<Freshness date={states.map((s) => s.date).sort().at(-1)} label="Home values through" />}
      />

      {!dbConfigured() || data.length === 0 ? (
        <EmptyNote>
          No state home-value data yet. Run <code>npm run ingest:zillow</code> to populate the
          map (Zillow state ZHVI).
        </EmptyNote>
      ) : (
        <>
          <Card>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Affordability by state</h2>
              <span className="text-xs text-[var(--muted)]">
                {affordableCount} of {data.length} states affordable to {profile.isCustom ? "your" : "the median"} household
              </span>
            </div>
            <ChoroplethMap paths={geo.paths} width={geo.width} height={geo.height} data={data} />
          </Card>

          <Card>
            <SectionTitle hint="most to least affordable">Ranked</SectionTitle>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Payments include each state&apos;s effective property-tax rate plus an insurance
              estimate, so high-tax states (NJ, IL, TX) rank lower than home price alone implies.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted)]">
                    <th className="py-1 pr-4 font-medium">State</th>
                    <th className="py-1 pr-4 font-medium">Typical home</th>
                    <th className="py-1 pr-4 font-medium">Price-to-income</th>
                    <th className="py-1 pr-4 font-medium">Income needed</th>
                    {usingLocalIncomes && <th className="py-1 pr-4 font-medium">Median income here</th>}
                    <th className="py-1 pr-4 font-medium">Payment</th>
                    <th className="py-1 font-medium">Median household</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.stateCode} className="border-t border-[var(--border)]">
                      <td className="py-1.5 pr-4 font-medium">{d.name}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{usd(d.homeValue)}</td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: affordabilityColor(d.priceToIncome) }} />
                          {d.priceToIncome}×
                        </span>
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums">{usd(d.requiredIncome)}</td>
                      {usingLocalIncomes && <td className="py-1.5 pr-4 tabular-nums">{usd(d.localIncome)}</td>}
                      <td className="py-1.5 pr-4 tabular-nums">{usd(d.monthlyPayment)}/mo</td>
                      <td className="py-1.5" style={{ color: d.affordable ? "var(--good-ink)" : "var(--critical)" }}>
                        {d.affordable ? "Affordable" : "Stretched"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
