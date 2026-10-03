Feature: Settings - Profile and Engine Configuration
  As an authenticated Navia user
  I want to initialize and update my settings (Display Name, Anchor Pay Date)
  So that the application math engine calculates my cycles correctly

  Background:
    Given an authenticated user is on the "Settings" page
    And the settings engine form is initialized

  @settings @display_name
  Scenario Outline: Validate Display Name input formats
    When the user enters "<display_name>" into the Display Name field
    And clicks on "Save Configuration"
    Then the system should <expected_result> the profile

    Examples:
      | description                       | display_name            | expected_result              |
      | Characters only                   | JohnDoe                 | successfully update          |
      | Numbers only                      | 123456789               | successfully update          |
      | Symbols only                      | !@#$%^&*                | successfully update          |
      | Characters and numbers            | John123                 | successfully update          |
      | Characters, numbers, symbols      | John_Doe-123!           | successfully update          |
      | Maximum characters (50 chars)     | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | successfully update |
      | Empty name                        |                         | gracefully handle or reject  |
      | Exceed maximum characters         | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | reject and warn     |

  @settings @anchor_date
  Scenario Outline: Validate Anchor Pay Date input formats
    When the user attempts to enter "<input_value>" into the Anchor Pay Date date-picker field
    And clicks on "Save Configuration"
    Then the system should <expected_behavior>

    # Note: Modern browsers block non-date inputs on type="date", but API/Raw input should still be tested.
    Examples:
      | description                  | input_value  | expected_behavior                  |
      | Type with letters            | abcdef       | reject the input as invalid format |
      | Type with symbols            | --/--/----   | reject the input as invalid format |
      | Empty Anchor Pay Date        |              | warn that anchor date is required  |
      | Previous Date (Valid)        | 2023-01-01   | successfully update                |
      | Today's Date (Valid)         | {today}      | successfully update                |
      | Future Date (Valid)          | 2030-12-31   | successfully update                |
