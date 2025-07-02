import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !endpointSecret) {
    return new NextResponse("Missing signature or webhook secret", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed.", err);
    return new NextResponse("Webhook Error", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (!email) {
      console.error("No email found in checkout session");
      return new NextResponse("No email in session", { status: 400 });
    }

    // Upsert user in Supabase (this creates or updates the user)
    const { error: upsertError } = await supabase.from("users").upsert({
      email,
      role: "user",
      daily_limit_remaining: 20,
    });

    if (upsertError) {
      console.error("Failed to upsert user:", upsertError);
      return new NextResponse("Supabase upsert error", { status: 500 });
    }

    // Send magic link email
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      console.error("Failed to send magic link:", inviteError);
      return new NextResponse("Magic link error", { status: 500 });
    }

    console.log(`User ${email} upserted and magic link sent`);
  }

  return new NextResponse("Webhook received", { status: 200 });
}