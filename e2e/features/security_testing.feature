Feature: Security and Penetration Testing Protocols
  As a Security Engineer/Senior QA
  I want to ensure Navia's infrastructure resists common OWASP Top 10 vulnerabilities
  So that user financial data remains strictly confidential and uncompromised

  @security @xss @injection
  Scenario Outline: Validate protection against Cross-Site Scripting (XSS) in inputs
    Given an authenticated user is on the "Settings" page
    When they inject the payload "<xss_payload>" into the "Display Name" field
    And click save
    Then the application should sanitize the input
    And the script should NOT execute when rendering the profile
    And the raw payload should be displayed as safe text or rejected

    Examples:
      | xss_payload                                 |
      | <script>alert(1)</script>                   |
      | <img src=x onerror=alert('XSS')>            |
      | javascript:/*--></title></style></textarea></script></xmp><svg/onload=+/"/+/onmouseover=1/+/[*/[]/+alert(1)//> |

  @security @sqli @injection
  Scenario Outline: Validate protection against SQL Injection in Database Operations
    Given an authenticated user is on the "Payment Methods" section
    When they enter the payload "<sqli_payload>" as the Account Alias
    And save the payment method
    Then the application should handle the input as literal strings (Parameterization/ORM layer active)
    And no database syntax errors or unauthorized data dumps should occur

    Examples:
      | sqli_payload                  |
      | ' OR 1=1 --                   |
      | "; DROP TABLE users; --       |
      | admin' #                      |

  @security @broken_access_control @authorization
  Scenario: Prevent unauthorized access to authenticated routes
    Given an unauthenticated visitor
    When they attempt to directly navigate to the URL "/ledger" or "/settings"
    Then the server middleware should intercept the request
    And they should be immediately redirected to the "/login" page

  @security @rate_limiting @brute_force
  Scenario: Validate Rate Limiting on Authentication Endpoints (Brute Force Protection)
    Given a malicious user attempts to guess an OTP
    When they submit an invalid OTP to the verification endpoint 10 times consecutively within 1 minute
    Then the 11th request should return a "429 Too Many Requests" response
    And the UI should display a rate limit warning

  @security @broken_authentication @session_management
  Scenario: Reject invalid or manipulated JWT tokens
    Given a user modifies their LocalStorage/Cookie session JWT token to an invalid signature
    When they attempt to perform a protected action (e.g., fetch "Payment Methods")
    Then the Supabase Edge API should reject the request with a "401 Unauthorized" status
    And the user session should be destroyed, forcing a logout
