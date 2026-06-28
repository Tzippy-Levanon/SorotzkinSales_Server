import { createClient } from "@supabase/supabase-js";

let supabase;

export const connectDB = () => {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  console.log("✅ Supabase connected");
};

export default () => supabase;
