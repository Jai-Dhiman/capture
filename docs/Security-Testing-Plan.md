# 🛡️ Security Testing Plan for Capture
 
**Goal:** Validate the security of Capture's authentication system using a hands-on, learn-by-doing approach — starting with manual tests, then escalating to tool-assisted ethical hacking.
 
---
 
## 🔰 Phase 1: Manual Testing
 
### 🎯 Objectives
- Understand the structure and flow of Capture’s authentication system
- Perform basic security tests by hand
- Learn how vulnerabilities can arise through real examples
 
### 📚 Setup
 
| Step | Tool / Resource |
|------|------------------|
| Install local/staging instance of Capture | Docker |
| Set up test accounts | Include users with varying permissions |
| Install developer tools | Browser DevTools, Postman, Mailtrap |
 
### 🔍 Tests to Run
 
#### 🔑 Authentication Workflows
 
| Test | Target | Expected Outcome |
|------|--------|------------------|
| OTP Reuse | Passwordless Email Login | Second use should fail |
| Email Enumeration | Login Form | Same error for existing/non-existing users |
| OAuth Redirect Injection | OAuth Login | Modified `redirect_uri` should be rejected |
| WebAuthn Replay | Passkey Login | Replay attack should fail due to challenge mismatch |
 
#### 🧪 Input Validation
 
| Test | Target | Example Input |
|------|--------|---------------|
| SQL Injection | Login or Profile Update Fields | `' OR 1=1--` |
| Script Injection (XSS) | Comment/Input Fields | `<script>alert(1)</script>` |
| Rate Limiting | OTP Submission | 10+ rapid attempts with invalid OTPs |
 
✍️ **Deliverable:** Record results in a markdown file and add to docs/ folder.
 
---
 
## 🧨 Phase 2: Tool-Assisted Ethical Hacking
 
### 🎯 Objectives
- Explore how automated tools find vulnerabilities
- Learn to intercept and modify traffic
- Practice simulating real-world attacker behavior (ethically)
 
### 🔧 Tools to Learn
 
| Tool | Use Case |
|------|----------|
| **OWASP ZAP** | Spidering, passive/active scans |
| **Burp Suite (Community Edition)** | Intercept HTTP traffic |
| **sqlmap** | Automate SQL injection checks |
| **Postman** | Modify and replay requests |
| **Playwright (optional)** | Automate browser testing for WebAuthn |
 
### 🛠 Suggested Activities
 
| Task | Description |
|------|-------------|
| Passive Scan with ZAP | Point ZAP at staging site, document any issues |
| Burp Interception | Catch login requests, modify parameters |
| Run sqlmap | Target an input field, observe alerts |
| Simulate OAuth Phishing | Attempt to capture token via manipulated redirect (safely in test env) |
| Bypass Test with Encoded Payload | Attempt to sneak past validation with URL encoding or Base64 |
 
✍️ **Deliverable:** Create a report with each tool:
- What was tested
- What was found (or not)
- What you learned

---

## Bonus
## 🧰 Phase 3: CI-Integrated Security Scanning

**Goal:** Identify and mitigate vulnerabilities through automated scanning across the codebase, runtime environment, and dependencies.

| Category                | Tooling                                         | Trigger                        | Purpose                                                                 |
|-------------------------|-------------------------------------------------|--------------------------------|-------------------------------------------------------------------------|
| **SAST** (Static App Security Testing)   | GitHub CodeQL, SonarQube, Snyk Code             | On every PR                    | Identify insecure code patterns (e.g. unsanitized inputs, unsafe functions) |
| **DAST** (Dynamic App Security Testing) | OWASP ZAP CLI, Burp Suite Pro (optional)        | Weekly or pre-release on staging | Simulate real-world attacks on the running application                 |
| **Dependency Scanning** | `npm audit`, `yarn audit`, Snyk, Dependabot     | On every PR                    | Detect known CVEs in third-party libraries                             |
| **Secrets Scanning**    | GitGuardian, TruffleHog, GitHub Secret Scanning | On every commit                | Prevent accidental secret/key leaks in code                            |
| **Authentication Logic Tests** | Manual + automated (e.g. Playwright)       | Before major auth changes      | Ensure fallback paths, session logic, and MFA flows are secure         |

---
 
## 🎓 Resources
 
- [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/) (practice app)
- [ZAP Getting Started Guide](https://www.zaproxy.org/getting-started/)
- [OWASP ZAP Docker Guide](https://www.zaproxy.org/docs/docker/baseline-scan/)
- [Burp Suite Academy](https://portswigger.net/web-security)
- [sqlmap Tutorial (Infosec Writeups)](https://infosecwriteups.com/sqlmap-guide-beginners-edition-f355b8e89050)
- [WebAuthn Guide](https://webauthn.guide/)
- [Snyk Learn](https://learn.snyk.io/)
- [Github Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [CodeQL Docs](https://codeql.github.com/docs/)
 
