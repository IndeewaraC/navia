Feature: Marketing Page Navigation and Content
  As a prospective Navia user
  I want to land on the marketing page and understand the value proposition
  So that I can decide to explore the engine or open my vault

  @marketing @smoke
  Scenario: Verify core marketing content and navigation
    Given a visitor lands on the "Marketing" page
    Then the hero section should display "Your Zero-Trust Privacy Vault"
    And the visitor should see the "Open Your Vault" call to action
    And the visitor should see the "Explore Engine" call to action

  @marketing @navigation
  Scenario: Navigate to Login from Marketing page
    Given a visitor lands on the "Marketing" page
    When the visitor clicks on "Open Your Vault"
    Then the visitor should be redirected to the "Login" page

  @marketing @content
  Scenario Outline: Verify feature sections are present
    Given a visitor lands on the "Marketing" page
    When the visitor scrolls to the "features" section
    Then the visitor should see the "<feature_name>" feature highlighted

    Examples:
      | feature_name       |
      | Dual-Layer Budget  |
      | Magic Month Router |
      | Offline Groceries  |
