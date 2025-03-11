import { useNavigate } from 'react-router'

export function Home() {
  const navigate = useNavigate()
  
  return (
    <view className="container container-fluid">
      <image 
        className="container-fluid-bg" 
        src="https://source.unsplash.com/random/800x1200/?fluid" 
      />
      
      <view className="header">
        <view className="header-back"></view>
        <text className="text-title">Capture</text>
        <view></view>
      </view>
      
      <view className="content">
        <view className="card">
          <view className="card-content">
            <text className="card-title">Welcome to Capture</text>
            <text className="text-body">Privacy-first social media platform</text>
          </view>
        </view>
        
        <view className="divider"></view>
        
        <view className="form-group">
          <text className="form-label">Email</text>
          <view className="input-container">
            <view className="input-icon">
              <text>📧</text>
            </view>
            <view className="input-field">
              <text>youremail@example.com</text>
            </view>
          </view>
        </view>
        
        <view className="form-group">
          <text className="form-label">Password</text>
          <view className="input-container">
            <view className="input-icon">
              <text>🔒</text>
            </view>
            <view className="input-field">
              <text>••••••••</text>
            </view>
          </view>
        </view>
        
        <view className="btn-primary" bindtap={() => navigate('/page2')}>
          <text>Log In</text>
        </view>
        
        <view className="divider"></view>
        
        <view className="btn-social" bindtap={() => console.log('Google login')}>
          <text className="social-icon">G</text>
          <text>Continue with Google</text>
        </view>
        
        <view className="btn-social" style={{marginTop: '10px'}} bindtap={() => console.log('Apple login')}>
          <text className="social-icon">🍎</text>
          <text>Continue with Apple</text>
        </view>
        
        <view className="flex-center" style={{marginTop: '20px'}}>
          <text className="text-body">Don't have an account? </text>
          <text className="text-link-primary" bindtap={() => console.log('Register')}>Register</text>
        </view>
      </view>
      
      <view className="nav-bar">
        <view className="nav-bar-item active">
          <text>Home</text>
        </view>
        <view className="nav-bar-item">
          <text>Search</text>
        </view>
        <view className="nav-bar-item">
          <text>Profile</text>
        </view>
      </view>
    </view>
  )
}