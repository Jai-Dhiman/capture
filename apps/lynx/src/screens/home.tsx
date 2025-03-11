import { useNavigate } from 'react-router'

export function Home() {
  const navigate = useNavigate()
  
  return (
    <view className="flex flex-col min-h-screen bg-background p-5">
      <view className="flex flex-col flex-1">
        <view className="flex flex-1 justify-center items-center">
          <text className="text-2xl font-bold text-text">Welcome to Capture</text>
        </view>
        <view 
          className="bg-primary p-4 rounded-lg flex items-center justify-center my-2.5"
          bindtap={() => navigate('/page2')}
        >
          <text className="text-black font-semibold">Go to Page 2</text>
        </view>
      </view>
    </view>
  )
}