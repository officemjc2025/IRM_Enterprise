export const ENV = {

  APP_NAME:
    process.env.NEXT_PUBLIC_APP_NAME ?? "IRM Enterprise",

  APP_ENV:
    process.env.NEXT_PUBLIC_APP_ENV ?? "development",

  DEFAULT_LANGUAGE:
    process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE ?? "th",

  TIMEZONE:
    process.env.NEXT_PUBLIC_TIMEZONE ?? "Asia/Bangkok",

  SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",

  SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",

};
