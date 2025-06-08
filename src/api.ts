import { Hono } from 'hono'
import { Env } from './types'
import developers from './developers'
import apiKeys from './api_keys'
import riders from './riders'
import tasks from './tasks'

const app = new Hono<Env>()

app.get('/', (c) => {
  return c.text('Welcome to FleetCore API!')
})

app.route('/developers', developers)
app.route('/apikeys', apiKeys)
app.route('/riders', riders)
app.route('/tasks', tasks)

export default app
