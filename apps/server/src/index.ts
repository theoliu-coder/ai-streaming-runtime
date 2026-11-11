import express from 'express'

const app = express()

const PORT = 3000

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ai-runtime-server',
  })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
