Feature: Offline Grocery Synchronization
  As a Navia user shopping in a store with poor cell reception
  I want my checklist progress to save locally when I lose connection
  So that I can finalize my receipt when I walk out to the parking lot

  Scenario: Ticking off items while disconnected from the network
    Given "TestUser" has an active grocery trip at "Real Canadian Superstore"
    And the Navia app is loaded on their mobile device
    When the device loses network connection
    And "TestUser" ticks off "Chicken Breast" and updates the price to $14.50
    Then the checkout button should be disabled preventing API submission
    And the data must be securely saved in the device's local storage
    When the device regains network connection
    Then the checkout button should be re-enabled
    And submitting the receipt should successfully route the total to the ledger
