import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayPalButton } from "@/components/PayPalButton";
import GiftCardVisual from "@/components/GiftCardVisual";
import { Sparkles } from "lucide-react";

const PRESET_CENTS = [500, 1000, 2500, 5000, 10000, 25000];

function BuyGiftCard({
  amountCents,
  setAmountCents,
  customAmount,
  setCustomAmount,
}: {
  amountCents: number;
  setAmountCents: (cents: number) => void;
  customAmount: string;
  setCustomAmount: (value: string) => void;
}) {
  const utils = trpc.useUtils();
  const paypalConfigQuery = trpc.giftCards.paypalConfig.useQuery();

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pendingCard, setPendingCard] = useState<{ id: number; code: string } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [activatedCard, setActivatedCard] = useState<{ code: string; balanceCents: number } | null>(null);

  const purchase = trpc.giftCards.purchase.useMutation({
    onSuccess: (card) => {
      setPaymentError(null);
      setPendingCard({ id: card.id, code: card.code });
    },
  });

  const createPayment = trpc.giftCards.createPayment.useMutation();
  const capturePayment = trpc.giftCards.capturePayment.useMutation({
    onSuccess: (card) => {
      if (card) {
        setActivatedCard({ code: card.code, balanceCents: card.balanceCents });
        utils.giftCards.myGiftCards.invalidate();
      }
    },
  });

  const effectiveAmountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : amountCents;
  const paypalReady = paypalConfigQuery.data?.configured;

  if (activatedCard) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-md border bg-muted/30 p-6 text-center">
        <div className="w-full max-w-xs">
          <GiftCardVisual
            label={formatPrice(activatedCard.balanceCents).replace(/\.00$/, "")}
            sublabel={activatedCard.code}
          />
        </div>
        <div>
          <p className="font-display text-xl">Gift card ready</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPrice(activatedCard.balanceCents)} of store credit, redeemable at checkout.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Save the code above — it's the only way to redeem the card. We can't recover it if it's lost.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setActivatedCard(null);
            setPendingCard(null);
            setCustomAmount("");
            setRecipientName("");
            setRecipientEmail("");
            setMessage("");
          }}
        >
          Buy another
        </Button>
      </div>
    );
  }

  if (pendingCard) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-start gap-3 rounded-md border bg-muted/30 p-4">
          <div className="w-full max-w-xs">
            <GiftCardVisual
              label={formatPrice(effectiveAmountCents).replace(/\.00$/, "")}
              sublabel={recipientName ? `For ${recipientName}` : "Store credit"}
            />
          </div>
          <button
            type="button"
            className="text-xs underline underline-offset-4"
            onClick={() => setPendingCard(null)}
          >
            Edit details
          </button>
        </div>

        <div>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Pay with PayPal</h2>

          {!paypalReady ? (
            <p className="text-sm text-muted-foreground">
              PayPal isn't configured yet. Add <code>PAYPAL_CLIENT_ID</code> and{" "}
              <code>PAYPAL_CLIENT_SECRET</code> to the server's <code>.env</code> file and restart the
              server.
            </p>
          ) : (
            <PayPalButton
              clientId={paypalConfigQuery.data!.clientId}
              createOrder={async () => {
                const result = await createPayment.mutateAsync({ giftCardId: pendingCard.id });
                return result.paypalOrderId;
              }}
              onApprove={async () => {
                await capturePayment.mutateAsync({ giftCardId: pendingCard.id });
              }}
              onError={(msg) => setPaymentError(msg)}
            />
          )}

          {paymentError && <p className="mt-3 text-sm text-destructive">{paymentError}</p>}
          {capturePayment.isPending && (
            <p className="mt-3 text-sm text-muted-foreground">Activating your gift card…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        purchase.mutate({
          valueCents: effectiveAmountCents,
          recipientName: recipientName || undefined,
          recipientEmail: recipientEmail || undefined,
          message: message || undefined,
        });
      }}
    >
      <div>
        <Label>Amount</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a card above, or enter a custom amount.
        </p>
        <div className="mt-3 max-w-[200px]">
          <Input
            id="custom-amount"
            type="number"
            min={5}
            max={1000}
            step="0.01"
            placeholder="$0.00"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recipient-name">Recipient name (optional)</Label>
        <Input id="recipient-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="recipient-email">Recipient email (optional)</Label>
        <Input
          id="recipient-email"
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gift-message">Message (optional)</Label>
        <Textarea
          id="gift-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Happy birthday! Treat yourself."
        />
      </div>

      {purchase.error && <p className="text-sm text-destructive">{purchase.error.message}</p>}
      {!effectiveAmountCents || effectiveAmountCents < 500 ? (
        <p className="text-xs text-muted-foreground">Minimum gift card value is $5.</p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={purchase.isPending || !effectiveAmountCents || effectiveAmountCents < 500}
      >
        {purchase.isPending ? "Continuing…" : `Continue to payment — ${formatPrice(effectiveAmountCents || 0)}`}
      </Button>
    </form>
  );
}

function CheckBalance() {
  const [code, setCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const checkBalance = trpc.giftCards.checkBalance.useQuery(
    { code: submittedCode ?? "" },
    { enabled: !!submittedCode },
  );

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedCode(code.trim());
        }}
      >
        <Input
          placeholder="REL-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono uppercase"
        />
        <Button type="submit" disabled={!code.trim()}>
          Check balance
        </Button>
      </form>

      {checkBalance.isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}
      {checkBalance.isError && (
        <p className="text-sm text-destructive">{checkBalance.error.message}</p>
      )}
      {checkBalance.data && (
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="font-mono text-sm tracking-wide">{checkBalance.data.code}</p>
          <p className="mt-2 font-display text-2xl">{formatPrice(checkBalance.data.balanceCents)}</p>
          <p className="text-xs text-muted-foreground">
            remaining of {formatPrice(checkBalance.data.initialValueCents)} originally loaded
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Gift cards are applied automatically at checkout — just enter the code on the payment step.
      </p>
    </div>
  );
}

export default function GiftCards() {
  const [activeTab, setActiveTab] = useState("buy");
  const [amountCents, setAmountCents] = useState(5000);
  const [customAmount, setCustomAmount] = useState("");

  return (
    <div className="container max-w-5xl py-12">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Store credit</span>
      </div>
      <h1 className="mt-2 font-display text-3xl tracking-tight">Gift Cards</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Buy a digital gift card for someone (or yourself) — it works as store credit toward anything
        in the shop, accessories and crystals included.
      </p>

      {/* 3-column grid of card denominations — this IS the amount picker
         for the Buy tab below, not just decoration, so there's only one
         place to choose an amount instead of two duplicate pickers. */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESET_CENTS.map((cents) => (
          <GiftCardVisual
            key={cents}
            label={formatPrice(cents).replace(/\.00$/, "")}
            sublabel="Store credit"
            selected={activeTab === "buy" && amountCents === cents && !customAmount}
            onClick={() => {
              setAmountCents(cents);
              setCustomAmount("");
              setActiveTab("buy");
            }}
          />
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="buy">Buy a gift card</TabsTrigger>
          <TabsTrigger value="balance">Check balance</TabsTrigger>
        </TabsList>
        <TabsContent value="buy" className="mt-6 max-w-md">
          <BuyGiftCard
            amountCents={amountCents}
            setAmountCents={setAmountCents}
            customAmount={customAmount}
            setCustomAmount={setCustomAmount}
          />
        </TabsContent>
        <TabsContent value="balance" className="mt-6 max-w-md">
          <CheckBalance />
        </TabsContent>
      </Tabs>
    </div>
  );
}
