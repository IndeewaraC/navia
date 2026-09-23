Feature: Ledger Double-Counting Prevention
  As a Navia user managing a Dual-Layer budget
  I want account transfers to be excluded from my daily operational spend
  So that paying my credit card bill does not falsely trigger a limit breach warning

  Scenario: Transferring funds to settle a credit card balance
    Given an active Navia user "TestUser" with a $500.00 monthly operational limit
    And the current operational spend for the cycle is $200.00
    When "TestUser" logs a "TRANSFER" of $150.00 from "Debit" to "Credit"
    Then the transaction should be successfully recorded in the ledger
    And the operational spend calculation should remain exactly $200.00
    And no threshold breach warning should be triggered in the response
