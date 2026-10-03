Feature: User Authentication and OTP Verification
  As a Navia user
  I want to securely sign up and log in using an OTP
  So that I can access my financial data safely

  @auth @signup
  Scenario: Initial Signup with a valid email
    Given an unregistered user navigates to the "Signup" page
    When they enter a valid email address "newuser@example.com"
    And they submit the signup form
    Then they should be prompted to enter an OTP sent to their email

  @auth @otp @signup
  Scenario: Signup verification with Valid OTP
    Given a user has received an OTP for signup
    When they enter the valid OTP "123456"
    And submit the OTP form
    Then their account should be created successfully
    And they should be navigated to the "Ledger" page

  @auth @otp @signup
  Scenario: Signup verification with Invalid OTP
    Given a user has received an OTP for signup
    When they enter an invalid OTP "000000"
    And submit the OTP form
    Then they should see an error message "Invalid or expired OTP"
    And they should remain on the OTP verification page

  @auth @login
  Scenario: Login verification with Valid OTP
    Given a registered user "existinguser@example.com" requests a login OTP
    When they navigate to the OTP verification step
    And they enter the valid OTP "654321"
    And submit the OTP form
    Then they should be successfully authenticated
    And they should be navigated to the "Ledger" page

  @auth @login
  Scenario: Login verification with Invalid OTP
    Given a registered user "existinguser@example.com" requests a login OTP
    When they navigate to the OTP verification step
    And they enter an invalid OTP "111111"
    And submit the OTP form
    Then they should see an error message "Invalid OTP code"
    And their session should not be authenticated

  @navigation @post-login
  Scenario Outline: Navigate to other pages post-login
    Given an authenticated user is on the "Ledger" page
    When they navigate to the "<target_page>" page
    Then the "<target_page>" page should load successfully

    Examples:
      | target_page |
      | Vault       |
      | Provisions  |
      | History     |
      | Settings    |
