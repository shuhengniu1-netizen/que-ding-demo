# Que Ding · Mahjong Scoring Demo v4.0

An English version of the Que Ding Mahjong scoring prototype. The main flow is: create or join a game, record each hand, finish the full session, and review the saved history from My games.

## Files

- `index.html` — main demo page
- `styles.css` — visual styling and responsive layout
- `script.js` — navigation, hand settlement, session closeout, and history snapshots

## v4.0 highlights

- Bottom navigation uses Home, Record a hand, and My games.
- Confirming a hand keeps you on the Record a hand screen so the next hand can be entered immediately.
- The Record a hand screen shows the room, round count, rules, and current leader.
- The full session can be ended from the Record a hand screen or the ledger.
- Ending a session saves the rules, room code, rounds, winner, four final scores, hand ledger, and AI dispute count.
- My games includes a Recently finished card and full session history cards.

## Demo flow

1. From Home, choose Create a game or Join a game.
2. Set the rules, base score, cap, rounds, and player names.
3. Generate a room and enter the game room.
4. Record and confirm each hand.
5. Choose End session when the game is complete.
6. Review the finished session from My games or History.

## Demo scope

Included: create/join flow, four-player scoring, consecutive hand settlement, session closeout, saved history, ledger review, and AI judge examples.

Not included: real payments, live multiplayer synchronization, full authentication, a complete regional rules library, or a live AI inference service.
