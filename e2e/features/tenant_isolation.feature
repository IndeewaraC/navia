Feature: Multi-Tenant Boundary Isolation
  As a registered platform user
  I want my financial ledger secured by Row-Level Security
  So that no other user can access or modify my transaction data

  Scenario: Prevent Direct Object Reference (IDOR) across tenant boundaries
    Given a provisioned test user "UserA" with an active session
    And "UserA" has an existing transaction record
    And a separately authenticated API context for test user "UserB"
    When "UserB" sends a GET request attempting to fetch "UserA"'s transaction
    Then the API response status code should be 404 or return an empty array
    And no transaction data belonging to "UserA" is exposed
