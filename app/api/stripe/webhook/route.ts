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

    // Add email to allowed_emails table in Supabase
    const { error } = await supabase.from("allowed_emails").upsert({ email });

    if (error) {
      console.error("Failed to insert into allowed_emails:", error);
      return new NextResponse("Supabase insert error", { status: 500 });
    }

    console.log(`✅ Email ${email} added to allowed_emails`);
  }

  return new NextResponse("Webhook received", { status: 200 });
}
