import { NextResponse } from "next/server";

async function getImdsToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/",
      { headers: { Metadata: "true" }, signal: AbortSignal.timeout(3000) }
    );
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    return NextResponse.json({ error: "AZURE_SUBSCRIPTION_ID not set" }, { status: 500 });
  }

  const token = await getImdsToken();
  if (!token) {
    return NextResponse.json({ available: false, reason: "IMDS not reachable (dev mode)" });
  }

  // Try Consumption balances API (works for free trial / PAYG with credits)
  try {
    const res = await fetch(
      `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Consumption/balances?api-version=2019-10-01`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.ok) {
      const data = await res.json();
      const p = data.properties ?? {};
      return NextResponse.json({
        available: true,
        source: "balances",
        currency: p.currency ?? "USD",
        beginning: p.beginningBalance ?? 0,
        utilized: p.utilized ?? 0,
        remaining: p.endingBalance ?? 0,
      });
    }
  } catch {
    // fall through to total-cost approach
  }

  // Fallback: compute total cost since 2025-01-01 via Cost Management
  try {
    const res = await fetch(
      `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "AmortizedCost",
          timeframe: "Custom",
          timePeriod: { from: "2025-01-01", to: new Date().toISOString().split("T")[0] },
          dataset: {
            granularity: "None",
            aggregation: { totalCost: { name: "PreTaxCost", function: "Sum" } },
          },
        }),
      }
    );

    const data = await res.json();
    const rows: [number, string][] = data?.properties?.rows ?? [];
    const utilized = rows[0]?.[0] ?? 0;
    const currency = rows[0]?.[1] ?? "USD";
    const beginning = 100; // free trial credit

    return NextResponse.json({
      available: true,
      source: "cost-management",
      currency,
      beginning,
      utilized,
      remaining: Math.max(0, beginning - utilized),
    });
  } catch {
    return NextResponse.json({ available: false, reason: "API error" });
  }
}
