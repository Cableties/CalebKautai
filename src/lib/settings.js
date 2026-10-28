// Game settings, shared by the games and the scores API. Each game has a few switches, all off to
// start with, and each mix of them gets its own high-score board, named for the game plus each
// switch that's on, in order: "snake", "snake-wrap", "snake-wrap-portals", …
export const settingsGame = (base, options, settings = {}) =>
  [base, ...options.filter((o) => settings[o.id]).map((o) => o.id)].join('-')

// Every board a game can have, for the server to accept
export const allSettingsGames = (base, options) =>
  Array.from({ length: 2 ** options.length }, (_, n) =>
    settingsGame(base, options, Object.fromEntries(options.map((o, i) => [o.id, Boolean(n & (1 << i))]))),
  )
