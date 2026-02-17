# Uniprofit – Custom login email in Supabase

Supabase sends the login email from its dashboard. To use the Uniprofit subject and a nicer body (and show the 6-digit code), do this once in the Supabase project.

## 1. Open Email Templates

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. In the left sidebar: **Authentication** → **Email Templates**.
3. Open the **Magic Link** template (used for “Send verification code” login).

## 2. Set the subject

In **Subject**, replace the default with:

```
UniProfit Login
```

(or e.g. `Your UniProfit login code` if you prefer).

## 3. Replace the body with this HTML

In the **Message (HTML)** editor, replace the whole content with:

```html
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a; margin-bottom: 8px;">UniProfit</h2>
  <p style="color: #4b5563; margin-bottom: 24px;">Use the code below to sign in. It expires in 1 hour.</p>
  
  <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
    <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a;">{{ .Token }}</span>
  </div>
  
  <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Or click the button below to sign in directly:</p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Log in to UniProfit</a>
  
  <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">If you didn’t request this, you can ignore this email.</p>
</div>
```

- **Subject** = “UniProfit Login” (or your chosen subject).
- **Message** = the HTML above so the email shows:
  - “UniProfit” title and a short line of copy.
  - The **6-digit code** in a clear box (`{{ .Token }}`).
  - A “Log in to UniProfit” button using the magic link (`{{ .ConfirmationURL }}`).

## 4. Save

Click **Save** at the bottom of the Email Templates page.

## 5. (Optional) Plain-text version

If Supabase lets you edit a **Message (plain text)** version, you can use:

```
UniProfit Login

Your sign-in code: {{ .Token }}
(Valid for 1 hour.)

Or open this link to sign in: {{ .ConfirmationURL }}

If you didn’t request this, you can ignore this email.
```

---

After this, the next “Send verification code” emails will:

- Use the subject **UniProfit Login** (or whatever you set).
- Show the **6-digit code** in the email body.
- Show a clear “Log in to UniProfit” button and a nicer layout.

The verification code **only appears in the email if the template includes** `{{ .Token }}`. The default Supabase template often only has the link; adding the block with `{{ .Token }}` fixes that.
