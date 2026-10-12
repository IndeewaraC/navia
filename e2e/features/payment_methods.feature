Feature: Settings - Payment Methods Management
  As an authenticated Navia user
  I want to manage my payment methods and their limits
  So that my Operational Ledger calculates my spend capacity accurately

  Background:
    Given an authenticated user is on the "Settings" page
    And they navigate to the "Payment Methods" section

  @settings @payment_method @create
  Scenario: Create a new payment method
    When the user clicks on "+ Add" payment method
    And enters the name "Amex Platinum"
    And enters the limit "5000"
    And clicks on "Save New Method"
    Then the payment method "Amex Platinum" with limit "$5000" should be saved and visible in the list

  @settings @ledger @integration
  Scenario: Verify new payment method reflects on the Ledger page
    Given a payment method "Amex Platinum" with limit "5000" exists
    When the user navigates to the "Ledger" page
    Then the "Active Funding Sources" section should display "Amex Platinum"
    And the operational capacity limit should include the "$5000" limit

  @settings @payment_method @delete
  Scenario: Delete an existing payment method
    Given the user has an existing payment method "Amex Platinum" in Settings
    When the user clicks the delete (trash) icon for "Amex Platinum"
    And confirms the deletion prompt
    Then the payment method "Amex Platinum" should be removed from the list
    And navigating to the "Ledger" page should reflect the reduced operational capacity limit
