// lib/supabase.ts
// ─────────────────────────────────────────────────────────────
// ProposalAI — Supabase Client + Helper Functions
//
// SETUP:
//   1. npm install @supabase/supabase-js
//   2. Add to .env.local:
//        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//        NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
//   3. Import { supabase } wherever you need it.
// ─────────────────────────────────────────────────────────────
 
import { createClient } from "@supabase/supabase-js";
 
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
 
// ─── TYPES ────────────────────────────────────────────────────
 
export type ProposalStatus = "ready" | "sent" | "accepted" | "declined";
 
export interface Business {
  id?: string;
  user_id?: string;
  name: string;
  owner: string;
  trade: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}
 
export interface Proposal {
  id?: string;
  user_id?: string;
  client_name: string;
  client_email?: string;
  trade: string;
  description?: string;
  line_items: LineItem[];
  total_amount?: number;
  timeline?: string;
  output_text: string;
  status: ProposalStatus;
  created_at?: string;
  updated_at?: string;
}
 
export interface LineItem {
  id: number;
  desc: string;
  amount: string;
}
 
export interface Subscription {
  is_pro: boolean;
  proposal_count: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}
 
// ─── AUTH ─────────────────────────────────────────────────────
 
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
 
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
 
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
 
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
 
// ─── BUSINESS PROFILE ─────────────────────────────────────────
 
export async function getBusiness(): Promise<Business | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}
 
export async function saveBusiness(profile: Omit<Business, "id" | "user_id" | "created_at" | "updated_at">): Promise<Business> {
  const user = await getUser();
  if (!user) throw new Error("Not logged in");
  const { data, error } = await supabase
    .from("businesses")
    .upsert({ user_id: user.id, ...profile }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
// ─── PROPOSALS ────────────────────────────────────────────────
 
export async function saveProposal(proposal: {
  clientName: string;
  clientEmail?: string;
  trade: string;
  description?: string;
  lineItems: LineItem[];
  totalAmount: string;
  timeline?: string;
  outputText: string;
}): Promise<Proposal> {
  const user = await getUser();
  if (!user) throw new Error("Not logged in");
 
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      user_id:      user.id,
      client_name:  proposal.clientName,
      client_email: proposal.clientEmail ?? null,
      trade:        proposal.trade,
      description:  proposal.description ?? null,
      line_items:   proposal.lineItems,
      total_amount: parseFloat(proposal.totalAmount.replace(/[^0-9.]/g, "")),
      timeline:     proposal.timeline ?? null,
      output_text:  proposal.outputText,
      status:       "ready" as ProposalStatus,
    })
    .select()
    .single();
 
  if (error) throw error;
  return data;
}
 
export async function getProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
 
export async function updateProposalStatus(id: string, status: ProposalStatus): Promise<void> {
  const { error } = await supabase
    .from("proposals")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}
 
// ─── SUBSCRIPTION ─────────────────────────────────────────────
 
export async function getSubscription(): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("is_pro, proposal_count, stripe_customer_id, stripe_subscription_id")
    .single();
  if (error) throw error;
  return data;
}
 
// ─── RPC FUNCTION ─────────────────────────────────────────────
// Run this once in Supabase SQL Editor to enable proposal count tracking:
//
// create or replace function increment_proposal_count(uid uuid)
// returns void language plpgsql security definer as $$
// begin
//   update subscriptions
//   set proposal_count = proposal_count + 1
//   where user_id = uid;
// end; $$;
