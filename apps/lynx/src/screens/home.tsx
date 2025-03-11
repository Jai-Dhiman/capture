import { useNavigate } from 'react-router'

export function Home() {
  const navigate = useNavigate()
  
  return (
    <view className="container">
      <view className="content">
        <view className="hero">
          <text className="title">Welcome to Capture</text>
        </view>
        <view 
          className="btn-primary"
        >
          <text className="btn-text">Go to Page 2</text>
        </view>
      </view>
    </view>
  )
}