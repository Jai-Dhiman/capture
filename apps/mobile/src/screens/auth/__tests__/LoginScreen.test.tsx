import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { useAuth } from '../../../hooks/auth/useAuth';
import { useAlert } from '../../../lib/AlertContext';

const mockNavigation = {
  navigate: jest.fn(),
};

jest.mock('../../../hooks/auth/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../lib/AlertContext', () => ({
  useAlert: jest.fn(),
}));

// Mock the components that might cause issues in tests
jest.mock('components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => 'LoadingSpinner',
}));

jest.mock('../../../components/providers/OAuth', () => 'OAuth');
jest.mock('components/ui/Header', () => 'Header');

// Mock SVG components
jest.mock('../../../assets/icons/EmailIcon.svg', () => 'EmailIcon');
jest.mock('../../../assets/icons/LockIcon.svg', () => 'LockIcon');
jest.mock('../../../assets/icons/ViewPasswordIcon.svg', () => 'ViewPasswordIcon');
jest.mock('../../../assets/icons/HidePasswordIcon.svg', () => 'HidePasswordIcon');

describe('LoginScreen', () => {
  // Setup mocks before each test
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    (useAuth as jest.Mock).mockReturnValue({
      login: {
        mutate: jest.fn(),
        isPending: false,
      },
    });
    
    (useAlert as jest.Mock).mockReturnValue({
      showAlert: jest.fn(),
    });
  });

  it('renders correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Check if key elements are rendered
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('Your Password')).toBeTruthy();
    expect(getByPlaceholderText('johndoe@gmail.com')).toBeTruthy();
    expect(getByText('Log In')).toBeTruthy();
    expect(getByText('Forgot Password?')).toBeTruthy();
    expect(getByText('Don\'t have an account?')).toBeTruthy();
    expect(getByText('Register')).toBeTruthy();
  });

  it('shows validation errors for empty form submission', async () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Attempt to submit the form without filling in fields
    fireEvent.press(getByText('Log In'));
    
    // Check if alert was shown for empty fields
    const mockShowAlert = useAlert().showAlert;
    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        'Please enter both email and password',
        { type: 'warning' }
      );
    });
  });

  it('handles user input correctly', () => {
    const { getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Get input fields
    const emailInput = getByPlaceholderText('johndoe@gmail.com');
    
    // Enter text in email field
    fireEvent.changeText(emailInput, 'test@example.com');
    
    // Check if value was updated
    expect(emailInput.props.value).toBe('test@example.com');
  });

  it('submits the form with valid credentials', async () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Get form elements
    const emailInput = getByPlaceholderText('johndoe@gmail.com');
    const passwordInput = getByText('Your Password').parent.findByType('TextInput');
    const loginButton = getByText('Log In');
    
    // Fill in the form
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    
    // Submit the form
    fireEvent.press(loginButton);
    
    // Check if login was called with correct credentials
    const mockLogin = useAuth().login;
    await waitFor(() => {
      expect(mockLogin.mutate).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'password123' },
        expect.any(Object)
      );
    });
  });

  it('toggles password visibility', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Find password field and toggle button
    const passwordField = getByText('Your Password').parent;
    const passwordInput = passwordField.findByType('TextInput');
    
    // Password should be hidden initially
    expect(passwordInput.props.secureTextEntry).toBe(true);
    
    // Find and press the toggle button
    const toggleButton = passwordField.findByProps({ 
      onPress: expect.any(Function),
      className: "absolute right-[9px]" 
    });
    fireEvent.press(toggleButton);
    
    // Password should be visible now
    expect(passwordInput.props.secureTextEntry).toBe(false);
  });

  it('navigates to ForgotPassword screen', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Find and press the Forgot Password link
    const forgotPasswordLink = getByText('Forgot Password?');
    fireEvent.press(forgotPasswordLink);
    
    // Check if navigation was called
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('navigates to Signup screen', () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Find and press the Register link
    const registerLink = getByText('Register');
    fireEvent.press(registerLink);
    
    // Check if navigation was called
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Signup');
  });

  it('shows loading spinner when login is in progress', () => {
    // Override the mock to simulate loading state
    (useAuth as jest.Mock).mockReturnValue({
      login: {
        mutate: jest.fn(),
        isPending: true,
      },
    });
    
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    // Check if loading spinner is shown
    expect(getByText('LoadingSpinner')).toBeTruthy();
  });
});