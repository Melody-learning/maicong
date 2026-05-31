# board-history Specification

## Purpose
TBD - created by archiving change add-board-history-view. Update Purpose after archive.
## Requirements
### Requirement: Recent Board History Index
The system SHALL maintain a bounded newest-first history of recently created boards.

#### Scenario: New board is added to history
- **WHEN** `POST /api/board` successfully creates a board
- **THEN** the system records that board id in the recent board history.

#### Scenario: History is bounded
- **WHEN** the recent board history exceeds the configured or default retention count
- **THEN** the system keeps the newest records and removes older records from the history index.

#### Scenario: Replaced board remains in history
- **WHEN** a new board replaces a previous current board
- **THEN** both board ids remain eligible for recent history until removed by bounded retention.

### Requirement: Board History API
The system SHALL expose a token-protected API for reading recent board history.

#### Scenario: Sender token reads history
- **WHEN** `GET /api/board/history` is called with a valid `SEND_TOKEN`
- **THEN** the system returns recent board summaries in newest-first order.

#### Scenario: Invalid token is rejected
- **WHEN** `GET /api/board/history` is called without a valid `SEND_TOKEN`
- **THEN** the system rejects the request without returning board text.

#### Scenario: Missing board records are skipped
- **WHEN** the history index contains an id whose board record no longer exists
- **THEN** the system omits that missing record from the history response without failing the whole request.

### Requirement: Simple History Summary
The board history response SHALL provide only the fields needed for the lightweight sender history view.

#### Scenario: History item includes time and content
- **WHEN** history contains a board record
- **THEN** the response item includes the board id, text, and creation time.

#### Scenario: Current board is marked
- **WHEN** a history item is the current unexpired board
- **THEN** that item includes a current marker such as `isCurrent: true`.

#### Scenario: Non-current boards are not marked current
- **WHEN** a history item is expired, replaced, cleared, dismissed, or otherwise not the current unexpired board
- **THEN** that item is not marked current.

#### Scenario: Lifecycle details are not required
- **WHEN** history is returned for the sender web view
- **THEN** the response does not require receiver display state, ended reason labels, queue state, or diagnostic lifecycle descriptions.
