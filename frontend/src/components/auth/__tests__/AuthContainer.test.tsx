import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContainer } from '../AuthContainer'

// Mock the child components
vi.mock('../LoginWindow', () => ({
  LoginWindow: ({ onSwitchToRegister }: { onSwitchToRegister: () => void }) => (
    <div data-testid="login-window">
      <button onClick={onSwitchToRegister}>Switch to Register</button>
    </div>
  ),
}))

vi.mock('../RegistrationWindow', () => ({
  RegistrationWindow: ({ onSwitchToLogin }: { onSwitchToLogin: () => void }) => (
    <div data-testid="registration-window">
      <button onClick={onSwitchToLogin}>Switch to Login</button>
    </div>
  ),
}))

describe('AuthContainer', () => {
  it('should render LoginWindow by default', () => {
    render(<AuthContainer />)

    expect(screen.getByTestId('login-window')).toBeInTheDocument()
    expect(screen.queryByTestId('registration-window')).not.toBeInTheDocument()
  })

  it('should switch to registration window when requested', async () => {
    const user = userEvent.setup()
    render(<AuthContainer />)

    const switchButton = screen.getByText('Switch to Register')
    await user.click(switchButton)

    expect(screen.queryByTestId('login-window')).not.toBeInTheDocument()
    expect(screen.getByTestId('registration-window')).toBeInTheDocument()
  })

  it('should switch back to login window when requested', async () => {
    const user = userEvent.setup()
    render(<AuthContainer />)

    // Switch to registration
    const switchToRegisterButton = screen.getByText('Switch to Register')
    await user.click(switchToRegisterButton)

    expect(screen.getByTestId('registration-window')).toBeInTheDocument()

    // Switch back to login
    const switchToLoginButton = screen.getByText('Switch to Login')
    await user.click(switchToLoginButton)

    expect(screen.getByTestId('login-window')).toBeInTheDocument()
    expect(screen.queryByTestId('registration-window')).not.toBeInTheDocument()
  })

  it('should handle multiple switches between modes', async () => {
    const user = userEvent.setup()
    render(<AuthContainer />)

    // Start with login
    expect(screen.getByTestId('login-window')).toBeInTheDocument()

    // Switch to registration
    await user.click(screen.getByText('Switch to Register'))
    expect(screen.getByTestId('registration-window')).toBeInTheDocument()

    // Switch back to login
    await user.click(screen.getByText('Switch to Login'))
    expect(screen.getByTestId('login-window')).toBeInTheDocument()

    // Switch to registration again
    await user.click(screen.getByText('Switch to Register'))
    expect(screen.getByTestId('registration-window')).toBeInTheDocument()
  })
})