/**
 * Test script to verify backend connection at localhost:3001
 * Run with: node test-backend-connection.js
 */

const testBackendConnection = async () => {
  const BACKEND_URL = 'http://localhost:3001/api/paper/search'
  const testPayload = {
    title: 'machine learning in healthcare'
  }

  console.log('Testing backend connection...')
  console.log('URL:', BACKEND_URL)
  console.log('Payload:', JSON.stringify(testPayload, null, 2))
  console.log('---')

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    console.log('Response Status:', response.status)
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log('Response Body:', responseText)

    if (response.ok) {
      try {
        const jsonData = JSON.parse(responseText)
        console.log('\n✅ SUCCESS - Backend responded with valid JSON:')
        console.log(JSON.stringify(jsonData, null, 2))
      } catch (e) {
        console.log('\n⚠️  Backend responded but response is not JSON')
      }
    } else {
      console.log(`\n❌ Backend returned error status: ${response.status}`)
      try {
        const errorData = JSON.parse(responseText)
        console.log('Error details:', errorData)
      } catch (e) {
        console.log('Error response (not JSON):', responseText)
      }
    }
  } catch (error) {
    console.error('\n❌ ERROR connecting to backend:')
    console.error('Error type:', error.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 TIP: Make sure the backend is running at localhost:3001')
    }
  }
}

testBackendConnection()


