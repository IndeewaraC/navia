Feature: Groceries and Provisions Management
  As an authenticated Navia user
  I want to manage my grocery lists and receipts, even offline
  So that I can track my grocery spending accurately against my ledger

  Background:
    Given an authenticated user is on the "Provisions" page

  @groceries @active_run
  Scenario: Start a new grocery run
    When the user clicks on "Start a Grocery Run"
    Then a new active cart session should be initialized
    And the user should be redirected to the "Active Grocery Run" page

  @groceries @active_run @offline
  Scenario: Add items and track prices in active cart
    Given the user is on an "Active Grocery Run" page
    When the user adds an item "Organic Milk" with an estimated price of "$4.50"
    And the user adds an item "Whole Wheat Bread" with an estimated price of "$3.20"
    Then the active cart should display "2" items
    And the running total should calculate to "$7.70"

  @groceries @active_run @checkout
  Scenario: Settle and finalize a grocery receipt
    Given the user has an active cart with a running total of "$7.70"
    When the user clicks "Settle Receipt"
    And confirms the final checkout amount of "$8.00" (including tax)
    Then the grocery run should be marked as completed
    And the final total "$8.00" should be deducted from the Operational Ledger
    And the user should be redirected back to the "Provisions" page

  @groceries @history
  Scenario: View past grocery receipts
    Given the user has previously completed a grocery trip at "Trader Joe's" for "$45.00"
    When the user views the "Past Receipts" section on the Provisions page
    Then the trip to "Trader Joe's" should be listed
    And the settled total of "$45.00" should be visible

  @groceries @history @empty
  Scenario: View past grocery receipts when none exist
    Given the user has never completed a grocery trip
    When the user views the "Past Receipts" section
    Then an empty state message "No grocery trips logged yet" should be displayed
