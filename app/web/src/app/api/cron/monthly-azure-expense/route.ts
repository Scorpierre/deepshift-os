import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EUR_RATE = 0.92;

async function getAzureToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: "https://management.azure.com/.default",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Azure auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function queryLastMonthCost(
  token: string
): Promise<{ amount: number; currency: string }> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 1);
  // to is exclusive — subtract 1ms to stay in last month
  to.setMilliseconds(-1);

  const res = await fetch(
    `https://management.azure.com/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        },
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: { name: "PreTaxCost", function: "Sum" },
          },
        },
      }),
    }
  );

  const data = await res.json();
  const rows: [number, string][] = data?.properties?.rows ?? [];
  if (rows.length === 0) return { amount: 0, currency: "EUR" };

  return { amount: rows[0][0], currency: rows[0][1] };
}

// Called by n8n on the 1st of each month
export async function POST(req: NextRequest) {
  if (req.headers.get("x-n8n-secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getAzureToken();
  const { amount, currency } = await queryLastMonthCost(token);

  if (amount === 0) {
    return NextResponse.json({ skipped: true, reason: "no Azure cost last month" });
  }

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthLabel = lastMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const isUsd = currency === "USD";
  const amountEur = isUsd
    ? Math.round(amount * EUR_RATE * 100) / 100
    : Math.round(amount * 100) / 100;

  const expense = await prisma.expense.create({
    data: {
      label: `Azure VM — ${monthLabel}`,
      vendor: "Microsoft Azure",
      amount: amountEur,
      date: new Date(now.getFullYear(), now.getMonth(), 1),
      category: "INFRA",
      type: "ONE_TIME",
      notes: isUsd
        ? `$${amount.toFixed(2)} USD converti à ${EUR_RATE}`
        : `${amount.toFixed(2)} EUR (source Azure Cost Management)`,
    },
  });

  return NextResponse.json({ created: true, expense, currency, amount });
}
