# Email-Only Account Display

Date: 2026-10-08

Removed the role label beside the email in the identity/logout control and its
unused CSS rule. Backend role and authorization behavior are retained. Rebuilt
frontend assets under `backend/static/`; the specification documents this display.

Verification: 12 frontend tests passed, and `npm --prefix frontend run build`
succeeded. Browser checks with a simulated teacher-role account passed for English,
Simplified Chinese, and Traditional Chinese at 1440px and 390px widths. Each
identity control displays only the email, and clicking it clears the login token.
Inspected desktop/mobile screenshots: the email is readable with no role label.
The Docker image was rebuilt and the live Compose container restarted. The app
is healthy and serves the newly built JavaScript asset. No human decisions remain.
