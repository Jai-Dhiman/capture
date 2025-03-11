import { useNavigate } from 'react-router'

export function PageTwo() {
  const navigate = useNavigate()
  
  return (
    <view className="container">
      <view className="header">
        <view className="header-back" bindtap={() => navigate('/')}>
          <text>←</text>
        </view>
        <text className="header-title">Page 2</text>
        <view></view>
      </view>
      
      <view className="content">
        <view className="card">
          <view className="card-content">
            <text className="card-title">Your Content</text>
            <text className="text-body">This is page 2 of your application.</text>
          </view>
        </view>
        
        <view className="form-group" style={{marginTop: '20px'}}>
          <text className="form-label">Your Input</text>
          <view className="input-container focused">
            <view className="input-field">
              <text>Type here...</text>
            </view>
          </view>
        </view>
        
        <view className="btn-secondary" bindtap={() => navigate('/')}>
          <text>Back to Home</text>
        </view>
      </view>
      
      <view className="nav-bar">
        <view className="nav-bar-item">
          <text>Home</text>
        </view>
        <view className="nav-bar-item active">
          <text>Page 2</text>
        </view>
        <view className="nav-bar-item">
          <text>Profile</text>
        </view>
      </view>
    </view>
  )
}