import { nanoid } from '@/lib/utils'
import { Chat } from '@/components/chat'
import { getChats } from '@/app/actions'

export const runtime = 'edge'

export default function IndexPage() {
  const id = nanoid()

  const testGetChats = async (formData: FormData) => {
    'use server'
    console.log('🧪 Testing getChats manually...')
    const result = await getChats('2a368736-755f-4a90-9529-01a280a42877')
    console.log('🧪 Manual test result:', result)
    // Do not return result, just return void
  }

  return (
    <div>
      <form action={testGetChats}>
        <button 
          type="submit" 
          style={{
            background: 'red', 
            color: 'white', 
            padding: '10px',
            margin: '10px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          TEST GETCHATS
        </button>
      </form>
      <Chat id={id} />
    </div>
  )
}