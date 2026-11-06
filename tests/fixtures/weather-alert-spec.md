# <id>: Enable weather alerts

## Requirements

### REQ1: System MUST provide the weather alert message

Delta: added

`alert.txt` in the repository root contains exactly `Weather alerts enabled` followed by a newline.

Verified by: [AC1](#ac1-the-weather-alert-message-is-available)

#### AC1: The weather alert message is available

- GIVEN the repository root.
- WHEN `alert.txt` is read as UTF-8.
- THEN its contents are exactly `Weather alerts enabled\n`.
- Example: The repository has no `alert.txt`. After implementation, `alert.txt` contains exactly `Weather alerts enabled` followed by a newline.
