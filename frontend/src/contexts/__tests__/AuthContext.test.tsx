import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'
import { User, AuthToken } from '../../types'

// Test component to access auth context
function TestComponent() {
  const { user, isAuthenticated, login, register, logout, error, isLoading, clearError } = useAuth()
  
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="user-info">
        {user ? user.screenName : 'no-user'}
      </div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      
      <button onClick={() => login('testuser', 'password123')}>Login</button>
      <button onClick={() => register('newuser', 'password123', 'test@example.com')}>Register</button>
      <button onClick={logout}>Logout</button>
      <button onClick={clearError}>Clear Error</button>
    </div>
  )
}

const mockUser: User = {
  id: '1',
  screenName: 'testuser',
  email: 'test@example.com',
  profile: {},
  status: 'online',
  lastSeen: new Date(),
  createdAt: new Date(),
}

const mockAuthToken: AuthToken = {
  token: 'mock-jwt-token',
  user: mockUser,
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should provide initial unauthenticated state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated')
    expect(screen.getByTestId('user-info')).toHaveTextContent('no-user')
    expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
  })

  it('should restore authentication from localStorage on mount', () => {
    // Mock localStorage to return stored values
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === 'aim_token') return 'stored-token'
      if (key === 'aim_user') return JSON.stringify(mockUser)
      return null
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user-info')).toHaveTextContent('testuser')
  })

  it('should handle successful login', async () => {
    const user = userEvent.setup()
    
    // Mock successful login response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuthToken,
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await user.click(screen.getByText('Login'))

    // Should show loading state
    expect(screen.getByTestId('loading')).toHaveTextContent('loading')

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser')
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    // Should store in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('aim_token', 'mock-jwt-token')
    expect(localStorage.setItem).toHaveBeenCalledWith('aim_user', JSON.stringify(mockUser))
  })

  it('should handle login failure', async () => {
    const user = userEvent.setup()
    
    // Mock failed login response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Invalid credentials' } }),
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await user.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated')
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials')
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })
  })

  it('should handle successful registration', async () => {
    const user = userEvent.setup()
    
    // Mock successful registration response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuthToken,
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await user.click(screen.getByText('Register'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('user-info')).toHaveTextContent('testuser')
    })

    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenName: 'newuser',
        password: 'password123',
        email: 'test@example.com',
      }),
    })
  })

  it('should handle registration failure', async () => {
    const user = userEvent.setup()
    
    // Mock failed registration response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Screen name already taken' } }),
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await user.click(screen.getByText('Register'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Screen name already taken')
    })
  })

  it('should handle logout', async () => {
    const user = userEvent.setup()
    
    // Start with authenticated state
    localStorage.setItem('aim_token', 'stored-token')
    localStorage.setItem('aim_user', JSON.stringify(mockUser))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Should be authenticated initially
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')

    await user.click(screen.getByText('Logout'))

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated')
    expect(screen.getByTestId('user-info')).toHaveTextContent('no-user')
    expect(localStorage.removeItem).toHaveBeenCalledWith('aim_token')
    expect(localStorage.removeItem).toHaveBeenCalledWith('aim_user')
  })

  it('should clear errors', async () => {
    const user = userEvent.setup()
    
    // Mock failed login to create an error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Test error' } }),
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await user.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Test error')
    })

    await user.click(screen.getByText('Clear Error'))

    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
  })

  it('should handle network errors gracefully', async () => {
    const user = userEvent.setup()
    
    // Mock network error
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await user.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error')
    })
  })

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')
    
    consoleSpy.mockRestore()
  })
})