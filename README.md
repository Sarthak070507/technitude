# Tech Treasure

1. Keep your existing `.env` in the project root.
2. Run `npm.cmd install`.
3. Make sure MySQL database `tech_treasure` and its tables exist.
4. Run `npm.cmd start`.
5. Participant: `/register.html`
6. Organizer: `/admin.html`

Round 1 uses server timestamps; the displayed timer is recalculated from server time so minimizing/backgrounding the browser does not pause the elapsed time. Each skip adds exactly 5 seconds to `round1_penalty`, and the stored `round1_duration` includes that penalty.
