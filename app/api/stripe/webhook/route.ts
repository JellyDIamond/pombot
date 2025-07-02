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

    // Check if user exists in Supabase Auth
    const { data: authUser, error: authError } = await supabase
      .from("auth.users")
      .select("id")
      .eq("email", email)
      .limit(1)
      .single();

    if (authError && authError.code !== 'PGRST116') { // PGRST116 = no rows found, ignore
      console.error("Failed to query auth user:", authError);
      return new NextResponse("Supabase error", { status: 500 });
    }

    let userId = authUser?.id;

    if (!userId) {
      // Create user with confirmed email but no password
      const { data, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createError || !data?.user) {
        console.error("Failed to create auth user:", createError);
        return new NextResponse("Supabase error", { status: 500 });
      }
      userId = data.user.id;
    }

    // Upsert user in your users table with password_set flag = false
    const { error: upsertError } = await supabase.from("users").upsert({
      id: userId,
      email,
      role: "user",
      daily_limit_remaining: 20,
      password_set: false,
    });

    if (upsertError) {
      console.error("Failed to upsert user:", upsertError);
      return new NextResponse("Supabase error", { status: 500 });
    }

    // Send magic link email so user can log in and set password
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      console.error("Failed to send magic link:", inviteError);
      return new NextResponse("Magic link error", { status: 500 });
    }

    console.log(`User ${email} created/upserted and magic link sent`);
  }

  return new NextResponse("Webhook received", { status: 200 });
}
