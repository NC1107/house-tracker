/**
 * Inline glossary: wraps a jargon term with a hover/tap definition (native <abbr title>),
 * so first-time buyers aren't left guessing what PITI/DTI/etc. mean.
 */
export const GLOSSARY: Record<string, string> = {
  PITI: "Your full monthly housing payment: Principal, Interest, property Taxes, and Insurance (plus HOA/PMI if any).",
  DTI: "Debt-to-income ratio — your monthly debt payments as a share of gross income. Lenders cap this to decide how much you qualify for.",
  LTV: "Loan-to-value — the loan as a share of the home's price. Below 80% (20%+ down) avoids PMI.",
  PMI: "Private mortgage insurance — an added monthly cost when you put under 20% down on a conventional loan. It drops off once you reach ~20% equity.",
  MIP: "FHA mortgage insurance premium — like PMI but for FHA loans; at 3.5% down it lasts the life of the loan.",
  "price-to-income": "Home price ÷ annual household income. ~3–4× is historically normal; 5×+ means homes are expensive relative to earnings.",
  "sale-to-list": "Final sale price ÷ asking price. Below 1.0 means homes are selling under asking — a sign buyers have leverage.",
  "months of supply": "How long it would take to sell every listing at the current sales pace. ~6 months is balanced; higher favors buyers.",
  "Months of supply": "How long it would take to sell every listing at the current sales pace. ~6 months is balanced; higher favors buyers.",
  "Sale-to-list ratio": "Final sale price ÷ asking price. Below 1.0 means homes are selling under asking — buyers have leverage.",
  "Days on market": "How long a typical listing sits before going under contract. Longer means buyers have more time to negotiate.",
  "Listings with price cuts": "Share of active listings that have dropped their price — a sign sellers are competing for buyers.",
  "housing cost burden": "The share of your gross income that goes to the full housing payment. Under ~30% is considered comfortable.",
  ZHVI: "Zillow Home Value Index — the typical home value in an area over time.",
  jumbo: "A loan above the conforming limit (~$832,750 in 2026). It usually needs stronger credit and may carry a higher rate.",
};

export function Term({ term, children }: { term: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const def = GLOSSARY[term];
  const text = children ?? term;
  if (!def) return <>{text}</>;
  return (
    <abbr title={def} className="cursor-help border-b border-dotted border-current no-underline">
      {text}
    </abbr>
  );
}
