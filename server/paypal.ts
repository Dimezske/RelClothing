import { ENV } from "./_core/env";

const PAYPAL_API_BASE =
  ENV.paypal.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

type PayPalTokenResponse = {
  access_token: string;
  expires_in: number;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!ENV.paypal.clientId || !ENV.paypal.clientSecret) {
    throw new Error(
      "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your .env (sandbox credentials work for testing).",
    );
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basicAuth = Buffer.from(`${ENV.paypal.clientId}:${ENV.paypal.clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PayPal auth failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as PayPalTokenResponse;
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function paypalFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.message || data?.error_description || `PayPal request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

/** Creates a PayPal order for the given amount. Returns the PayPal order id to hand to the JS SDK buttons. */
export async function createPaypalOrder(input: { amountCents: number; currency?: string; referenceId: string }) {
  const value = (input.amountCents / 100).toFixed(2);

  const data = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          amount: {
            currency_code: input.currency ?? "USD",
            value,
          },
        },
      ],
    }),
  });

  return data as { id: string; status: string };
}

/** Captures funds for a PayPal order the buyer has approved. */
export async function capturePaypalOrder(paypalOrderId: string) {
  const data = await paypalFetch(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
  });

  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    status: data.status as string,
    captureId: capture?.id as string | undefined,
    captureStatus: capture?.status as string | undefined,
  };
}

/** Refunds (fully or partially) a previously captured PayPal payment. */
export async function refundPaypalCapture(captureId: string, amountCents?: number, currency = "USD") {
  const body = amountCents
    ? JSON.stringify({ amount: { value: (amountCents / 100).toFixed(2), currency_code: currency } })
    : JSON.stringify({});

  const data = await paypalFetch(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    body,
  });

  return data as { id: string; status: string };
}

export const paypalClientConfig = {
  clientId: ENV.paypal.clientId,
  configured: Boolean(ENV.paypal.clientId && ENV.paypal.clientSecret),
};
