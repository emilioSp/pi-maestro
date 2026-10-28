# <id>: Enable weather alerts

## Requirements

### REQ1: Provide the weather alert message

Delta: added

The file `alert.txt` in the repository root contains exactly `Weather alerts enabled` followed by a newline.

Verified by: [AC1](#ac1-the-weather-alert-message-is-available)

#### AC1: The weather alert message is available

1. Coverage: success
2. Probe: Read `alert.txt` as UTF-8 and compare it with `Weather alerts enabled\n`.
3. Expected result: The contents match exactly.
4. Example: The repository has no `alert.txt`. After implementation, `alert.txt` contains exactly `Weather alerts enabled` followed by a newline.
