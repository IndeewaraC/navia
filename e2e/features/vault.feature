Feature: Stability Vault and Exempt Projects
  As an authenticated Navia user
  I want to manage my emergency vault and long-term savings projects
  So that I can allocate funds that bypass my daily operational limit

  Background:
    Given an authenticated user is on the "Vault" page

  @vault @overview
  Scenario: View Vault account balance
    Given the user has a linked account with the alias "Vault"
    And the Vault has a current balance of "$10,000.00"
    When the Vault page loads
    Then the user should see their Vault account balance displayed as "$10,000.00"

  @vault @projects @create
  Scenario: Create a new Exempt Project
    When the user clicks the option to create a new Project
    And enters the project name "Car Repair"
    And sets the target amount to "$2000.00"
    And saves the new project
    Then the "Car Repair" project should appear in the active projects list
    And the initial saved amount should be "$0.00"

  @vault @projects @fund
  Scenario: Fund an Exempt Project
    Given the user has an existing project "Car Repair" with a target of "$2000.00" and saved "$0.00"
    And the user has a "Checking" account with sufficient balance
    When the user selects the option to fund the "Car Repair" project
    And they allocate "$500.00" from their "Checking" account
    And confirm the funding transfer
    Then the "Car Repair" project saved amount should update to "$500.00"
    And a transfer transaction should be logged in the history

  @vault @projects @edit
  Scenario: Edit an Exempt Project Target Amount
    Given the user has an existing project "Vacation" with a target of "$3000.00"
    When the user edits the "Vacation" project
    And updates the target amount to "$4000.00"
    And saves the changes
    Then the "Vacation" project target amount should reflect "$4000.00"

  @vault @projects @complete
  Scenario: Delete or Complete an Exempt Project
    Given the user has an existing project "New Laptop"
    When the user clicks the delete/archive icon for the "New Laptop" project
    And confirms the action
    Then the "New Laptop" project should be removed from the active projects list
