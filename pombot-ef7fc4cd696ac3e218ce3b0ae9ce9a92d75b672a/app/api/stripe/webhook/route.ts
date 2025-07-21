import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
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
    console.error("Missing signature or webhook secret");
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
      console.error("❌ No email found in checkout session");
      return new NextResponse("No email in session", { status: 400 });
    }

    // 1. Add to allowed_emails
    const { error: emailError } = await supabase
      .from("allowed_emails")
      .upsert({ email });

    if (emailError) {
      console.error("❌ Failed to insert into allowed_emails:", emailError);
      return new NextResponse("Supabase insert error", { status: 500 });
    }

    // 2. Add to users table
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        email,
        is_paid: true,
        created_at: new Date().toISOString(),
        role: "user",
        daily_limit_remaining: 10,
      }, { onConflict: 'email' }); // optional if email is unique

    if (userError) {
      console.error("❌ Failed to insert into users:", userError);
      return new NextResponse("User insert error", { status: 500 });
    }

    console.log(`✅ Email ${email} added to allowed_emails and users`);
  }

  return new NextResponse("Webhook received", { status: 200 });
}
