const express = require('express')
const AWS = require('aws-sdk')
const { nanoid } = require('nanoid')

const app = express()
app.use(express.json())

// DynamoDB setup
const dynamo = new AWS.DynamoDB.DocumentClient({
  region: 'ap-south-1'
})

const TABLE_NAME = 'url-shortener-urls'

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Shorten a URL
app.post('/shorten', async (req, res) => {
  const { longUrl } = req.body

  if (!longUrl) {
    return res.status(400).json({ error: 'longUrl is required' })
  }

  const code = nanoid(6)

  const params = {
    TableName: TABLE_NAME,
    Item: {
      code: code,
      longUrl: longUrl,
      createdAt: new Date().toISOString(),
      clicks: 0
    }
  }

  try {
    await dynamo.put(params).promise()
    res.json({
      code: code,
      shortUrl: `http://localhost:3000/${code}`
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save URL' })
  }
})

// Redirect short code to long URL
app.get('/:code', async (req, res) => {
  const { code } = req.params

  const params = {
    TableName: TABLE_NAME,
    Key: { code: code }
  }

  try {
    const result = await dynamo.get(params).promise()

    if (!result.Item) {
      return res.status(404).json({ error: 'Short URL not found' })
    }

    // Increment click count
    await dynamo.update({
      TableName: TABLE_NAME,
      Key: { code: code },
      UpdateExpression: 'SET clicks = clicks + :inc',
      ExpressionAttributeValues: { ':inc': 1 }
    }).promise()

    res.redirect(result.Item.longUrl)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to retrieve URL' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})