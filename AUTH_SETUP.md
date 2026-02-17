# Auth setup (Supabase)

## 1. Add your Supabase anon key

In `.env.local` set:

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Get the anon key from [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API** → **Project API keys** → `anon` `public`.

## 2. Redirect URL (for Google & magic links)

In Supabase: **Authentication** → **URL Configuration** → **Redirect URLs**, add:

- `http://localhost:3000/auth/callback` (local)
- `https://your-production-domain.com/auth/callback` (production)

## 3. Google sign-in

1. In Supabase: **Authentication** → **Providers** → enable **Google**.
2. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials): OAuth 2.0 Client ID (Web application), add authorized redirect URI:  
   `https://fflbcooidsnbctmomhkn.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret into the Supabase Google provider settings.

## 4. Email (password & verification code)

- **Email provider**: Supabase uses its built-in email; for production you can set a custom SMTP in **Project Settings** → **Auth** → **SMTP**.
- **Confirm email**: For sign-up with email/password, enable **Confirm email** in **Authentication** → **Providers** → **Email** if you want users to confirm before signing in.
- **Email OTP**: The “Verification code” tab uses Supabase’s email OTP; ensure **Enable Email OTP** (or magic link) is allowed in Auth settings. The 6-digit code is sent by Supabase’s default template; you can customize it under **Authentication** → **Email Templates**.

After setting `NEXT_PUBLIC_SUPABASE_ANON_KEY` and (for Google) the redirect URL and Google provider, restart the dev server and use **Login** to sign in with Google, email/password, or email verification code.
