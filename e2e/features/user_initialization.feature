Feature: Global User Initialization
  As a QA engineer
  I want to initialize users based on a global JSON fixture
  So that I can reuse their payment configurations across multiple scenarios

  Scenario: Initializing a Standard User from the global fixture
    Given I initialize the test user "StandardUser" from the global fixture
    Then the user should have 3 payment accounts created in the database
    And the "Primary Checking" account should have a monthly limit of $2000.00
    And the "Everyday Visa" account should have a monthly limit of $1500.00
    And the "MasterCard" should have a monthly limit of $2000.00

  Scenario: Initializing a Premium User from the global fixture
    Given I initialize the test user "PremiumUser" from the global fixture
    Then the user should have 2 payment accounts created in the database
    And the "Wealth Checking" account should have a balance of $1500.00
    And the "Platinum Credit" account should have a monthly limit of $3000.00