Feature: Transaction History Log
  As an authenticated Navia user
  I want to view, search, and filter my past transactions
  So that I can reconcile my accounts and review my spending

  Background:
    Given an authenticated user is on the "History" page

  @history @view
  Scenario: View full transaction ledger
    Given the user has existing transactions in the current cycle
    When the History page loads
    Then a list of recent transactions should be displayed
    And each transaction should show the "category", "amount", "date", and "source_account"

  @history @search @category
  Scenario: Search transactions by Category
    Given the user has a transaction under the category "Dining"
    When the user types "Dining" into the search bar
    Then the transaction list should filter to only show transactions matching "Dining"
    And transactions like "Utilities" should be hidden

  @history @search @amount
  Scenario: Search transactions by Amount
    Given the user has a transaction for the exact amount of "$14.99"
    When the user types "14.99" into the search bar
    Then the transaction list should display the "$14.99" transaction

  @history @search @empty
  Scenario: Search yields no results
    Given the user is viewing the History page
    When the user types "NonExistentCategory123" into the search bar
    Then the transaction list should be empty
    And a message indicating "No transactions found" should be displayed

  @history @badges
  Scenario: Verify transaction type indicators
    Given the user has logged an "INCOME", an "EXPENSE", and a "TRANSFER"
    When they view the transaction list
    Then the "INCOME" transaction should be styled in green (positive)
    And the "EXPENSE" transaction should be styled in red/rose (negative)
    And the "TRANSFER" transaction should have a neutral visual indicator
