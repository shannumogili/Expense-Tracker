# TODO List for Expense Tracker Enhancements

## 1. Display User Name Near Profile

- [ ] Update `index.html` to fetch user data on load and display name in sidebar (replace "Welcome!" with "Welcome, [Name]!").

## 2. Add Logout Button

- [ ] Add logout button in `index.html` sidebar.
- [ ] Implement logout functionality: clear localStorage token and redirect to `signup.html`.

## 3. Forget Password Functionality

- [ ] Create `forgot-password.html` page with email input form.
- [ ] Create `reset-password.html` page with new password form.
- [ ] Update `login.html` to add "Forgot Password?" link.
- [ ] Update `server.js`: Extend User schema for reset tokens, add `/forgot-password` endpoint (generate token, send email), add `/reset-password` endpoint (verify token, update password).
- [ ] Integrate nodemailer for email sending.

## 4. Google Login

- [ ] Update `package.json` to add dependencies: passport, passport-google-oauth20, express-session, nodemailer.
- [ ] Update `server.js`: Configure Passport with Google strategy, add `/auth/google` and `/auth/google/callback` routes, handle user creation/update, generate JWT on success.
- [ ] Update `login.html` to add Google login button.
- [ ] Optionally update `signup.html` to add Google signup button.

## Followup Steps

- [ ] Install new dependencies with `npm install`.
- [ ] Set up environment variables (e.g., GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, EMAIL_USER, EMAIL_PASS).
- [ ] Test the app: Start MongoDB, run `npm start`, open in browser, verify auth flows, UI updates, email sending.
- [ ] Ensure no errors in console or functionality.
