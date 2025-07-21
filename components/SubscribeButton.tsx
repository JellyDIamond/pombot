'use client'

export default function SubscribeButton() {
  const handleSubscribe = async () => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
    })

    const data = await res.json()

    if (data?.url) {
      window.location.href = data.url
    } else {
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <button
      onClick={handleSubscribe}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
    >
      Subscribe to Unlock Full Access
    </button>
  )
}