import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

const scriptCache = new Map<string, Promise<void>>();

function loadPaypalScript(clientId: string): Promise<void> {
  const cacheKey = clientId;
  if (scriptCache.has(cacheKey)) return scriptCache.get(cacheKey)!;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-paypal-sdk]");
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the PayPal SDK"));
    document.body.appendChild(script);
  });

  scriptCache.set(cacheKey, promise);
  return promise;
}

/**
 * Renders the official PayPal Buttons widget. `createOrder` should call the
 * server to create (or reuse) a PayPal order and return its id; `onApprove`
 * fires once the buyer approves in the popup, before funds are captured.
 */
export function PayPalButton({
  clientId,
  createOrder,
  onApprove,
  onError,
  disabled,
}: {
  clientId: string;
  createOrder: () => Promise<string>;
  onApprove: (paypalOrderId: string) => Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let buttonsInstance: any;

    loadPaypalScript(clientId)
      .then(() => {
        if (cancelled || !containerRef.current || !window.paypal) return;

        containerRef.current.innerHTML = "";

        buttonsInstance = window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },
          createOrder: async () => {
            try {
              return await createOrder();
            } catch (err) {
              onError?.(err instanceof Error ? err.message : "Could not start PayPal checkout");
              throw err;
            }
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              await onApprove(data.orderID);
            } catch (err) {
              onError?.(err instanceof Error ? err.message : "Payment could not be completed");
            }
          },
          onError: (err: unknown) => {
            console.error("[PayPal]", err);
            onError?.("PayPal ran into an error. Please try again.");
          },
        });

        buttonsInstance.render(containerRef.current);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load PayPal");
      });

    return () => {
      cancelled = true;
      try {
        buttonsInstance?.close?.();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  return <div ref={containerRef} aria-disabled={disabled} className={disabled ? "pointer-events-none opacity-50" : ""} />;
}
