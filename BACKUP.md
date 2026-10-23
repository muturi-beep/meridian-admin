# Admin Credentials Backup

## Login

- Email: [karanjasolomon51@gmail.com]
- Password: [FdI49bwa55ej27oY9dnHdg]
- 2FA secret: stored in password manager as "Meridian Admin 2FA"

## Database

- MongoDB read-only user: admin_readonly
- Password: stored in password manager as "Meridian Admin DB"
- Connection string: in .env / Vercel env vars

## Recovery

- If password lost: node reset-admin-password.js
- If 2FA lost: node reset-totp.js
- If all lost: .env rebuild from this file + Atlas

## Secret storage

- NEVER store in .env backups outside the project folder
- Password manager: Bitwarden / 1Password / KeePassXC

## 2FA Code Authentication on Powershell

cd C:\Users\HomePC\Desktop\DM\meridian-admin
node totp.js(code is only 30secs)

## 2FA Code Authentication on Terminal

node totp.js
