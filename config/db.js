// import pkg from "pg";
// const { Pool } = pkg;

// let pool;

// const connectDB = async () => {
//   try {
//     pool = new Pool({
//       host: process.env.DB_HOST,
//       user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD,
//       database: process.env.DB_NAME,
//       port: process.env.DB_PORT || 5432,
//       ssl: false, // בפרודקשן לפעמים true
//     });

//     await pool.query("SELECT 1"); // בדיקת חיבור
//     console.log("✅ PostgreSQL connected");
//   } catch (error) {
//     console.error("❌ DB connection failed:", error.message);
//     process.exit(1);
//   }
// };

// export const getDB = () => pool;
// export default connectDB;

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
