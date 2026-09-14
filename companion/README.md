# Autofill Companion

One-time Chrome setup: unzip this folder, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose this folder. No Chrome Store publication or broad browsing permissions are required.

1. Confirm your application contact details and candidate facts in Career Navigator.
2. Review a role's draft and unknowns. Approve preparation, then download its **Autofill packet**.
3. Open the exact employer posting in Chrome. Open the application form on that page.
4. Open this extension, select the packet, then click **Fill reviewed fields**.
5. Inspect every field. Upload your resume file, answer custom questions and consent yourself, then submit on the employer website.
6. Return to Career Navigator and record the employer's confirmation.

Supported origins: Greenhouse hosted boards, Lever global/EU, and Ashby hosted boards. Embedded cross-origin forms, Workday, LinkedIn, Apple custom forms, file uploads and nonstandard fields require manual completion. A custom career-domain posting may need a role URL update and fresh approval to use the employer's hosted form.

The extension only receives access to the tab you invoke it on. It never presses Submit, checks consent, answers screening/demographic questions, overwrites populated fields, bypasses CAPTCHA, or uploads files. It has no network permissions, background worker or persistent storage. Packets expire after 24 hours; approval revocation cannot recall a downloaded packet, so delete old packets after profile or role changes. Downloaded packets contain private application data: keep them out of repositories and shared folders.

Autofill is intentionally conservative. Dynamic, embedded and site-specific forms may not be detected. The final review is always yours.
