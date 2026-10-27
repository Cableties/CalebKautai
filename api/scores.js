// High scores for the games page.
// GET ?game=…                          the top scores
// POST { action: 'start', game }       a signed run token, when a game starts
// POST { game, initials, score, run }  put a score on the board
import { randomUUID } from 'node:crypto'
import { allow, noStorage, redis } from './_lib/store.js'
import { GAMES, KEPT, TOP, board, parseScore, startRun } from './_lib/scores.js'

const key = (game) => `scores:${game}`
// The signing secret for run tokens: its own if set, else the one the guestbook links use
const secret = () => process.env.SCORE_SECRET ?? process.env.MODERATION_SECRET

export default async function handler(req, res) {
  if (!redis) return noStorage(res)
  res.setHeader('Cache-Control', 'no-store')
  const top = async (game) => board(await redis.zrange(key(game), 0, TOP - 1, { rev: true, withScores: true }))

  if (req.method === 'GET') {
    const { game } = req.query
    if (!GAMES[game]) return res.status(400).json({ error: 'Which game?' })
    return res.json({ scores: await top(game) })
  }

  if (req.method === 'POST') {
    if (!secret()) return res.status(503).json({ error: 'Scores are not configured' })
    const body = req.body ?? {}
    if (body.action === 'start') {
      if (!GAMES[body.game]) return res.status(400).json({ error: 'Which game?' })
      return res.json({ run: startRun(body.game, Date.now(), secret()) })
    }

    const { entry, error } = parseScore(body, Date.now(), secret())
    if (error) return res.status(400).json({ error })
    if (!(await allow(`score:${entry.game}`, req, 10))) {
      return res.status(429).json({ error: 'Slow down! Try again in a few seconds.' })
    }
    const member = `${entry.initials}#${randomUUID().slice(0, 8)}`
    await redis.zadd(key(entry.game), { score: entry.score, member })
    await redis.zremrangebyrank(key(entry.game), 0, -(KEPT + 1)) // keep only the best KEPT
    const rank = await redis.zrevrank(key(entry.game), member)
    return res.status(201).json({ rank: rank == null ? null : rank + 1, scores: await top(entry.game) })
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).json({ error: 'Method not allowed' })
}
