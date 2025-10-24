import 'dotenv/config'
import { Hono } from 'hono'
import { Webhooks } from '@octokit/webhooks'

import { GitHubAPI } from './utils/github-api.js'

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET
if (!GITHUB_WEBHOOK_SECRET) throw new Error('GITHUB_WEBHOOK_SECRET required')

const webhooks = new Webhooks({ secret: GITHUB_WEBHOOK_SECRET })
const githubApi = new GitHubAPI()

webhooks.on('pull_request.labeled', async ({ id, name, payload }) => {
  console.log(`Received event ${name} for repo ${payload.repository.full_name}`)
  const owner = payload.repository.owner.login
  const repoName = payload.repository.name
  const prNumber = payload.number
  const headSHA = payload.pull_request.head.sha

  switch (payload.label?.name) {
    case 'vote-required':
      await githubApi.postComment(owner, repoName, prNumber,
        "Voting is required for this PR - a vote will be started when someone labels it `vote-start`."
      )
      await githubApi.queueCheck(owner, repoName, 'Legislation Vote', headSHA)
      break
    case 'vote-start':
      await githubApi.postComment(owner, repoName, prNumber,
        "Vote started! Use 👍 / 👎 reactions to cast your vote. Voting will last 48 hours."
      )

      break
  }
})

webhooks.on('pull_request.unlabeled', async ({ id, name, payload }) => {
  console.log(`Received event ${name} for repo ${payload.repository.full_name}`)
  const owner = payload.repository.owner.login
  const repoName = payload.repository.name
  const prNumber = payload.number
  const headSHA = payload.pull_request.head.sha

  switch (payload.label?.name) {
    case 'vote-start':
    case 'vote-required':
      // Comment on the PR to inform users that vote is no longer required
      await githubApi.postComment(owner, repoName, prNumber,
        "Voting has been cancelled for this PR."
      )
      await githubApi.completeAllChecks(owner, repoName, headSHA, "cancelled")
      break;
  }
})

const app = new Hono()

app.post('/webhooks/github', async (c) => {
  const rawBody = await c.req.raw.text()

  const signature = c.req.header('x-hub-signature-256') || ''
  const eventName = c.req.header('x-github-event') || ''
  const deliveryId = c.req.header('x-github-delivery') || ''

  try {
    await webhooks.verifyAndReceive({
      id: deliveryId,
      name: eventName,
      payload: rawBody,
      signature,
    })
    return c.text('ok', 200)
  } catch (err) {
    console.error('Webhook verification/handling failed', err)
    return c.text('invalid signature or handler error', 401)
  }
})

const welcomeStrings = [
  'Hello Hono!',
  'To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono'
]

app.get('/', (c) => {
  return c.text(welcomeStrings.join('\n\n'))
})

export default app
