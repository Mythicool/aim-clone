import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegistrationWindow } from '../RegistrationWindow'

// Mock the auth context
const mockRegister = vi.fn()
const mockClearError = vi.fn()

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  }),
}))

describe('RegistrationWindow', () => {
  const mockOnSwitchToLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render registration form with all required fields', () => {
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    expect(screen.getByLabelText(/screen name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password:')).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/terms of service/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should have classic AIM styling classes', () => {
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const window = document.querySelector('.aim-window.registration-window')
    expect(window).toBeInTheDocument()
    
    const header = document.querySelector('.aim-window-header')
    expect(header).toBeInTheDocument()
    expect(header).toHaveTextContent('Register New Account')
  })

  it('should disable submit button initially', () => {
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const submitButton = screen.getByRole('button', { name: /create account/i })
    expect(submitButton).toBeDisabled()
  })

  it('should validate screen name requirements', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)

    // Test too short
    await user.type(screenNameInput, 'ab')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText(/must be at least 3 characters/i)).toBeInTheDocument()
    })

    // Clear and test invalid characters
    await user.clear(screenNameInput)
    await user.type(screenNameInput, 'test@user')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText(/can only contain letters, numbers/i)).toBeInTheDocument()
    })

    // Test valid screen name
    await user.clear(screenNameInput)
    await user.type(screenNameInput, 'valid_user123')
    await user.tab()
    await waitFor(() => {
      expect(screen.queryByText(/must be at least 3 characters/i)).not.toBeInTheDocument()
    })
  })

  it('should validate email format', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const emailInput = screen.getByLabelText(/email address/i)

    // Test invalid email
    await user.type(emailInput, 'invalid-email')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument()
    })

    // Test valid email
    await user.clear(emailInput)
    await user.type(emailInput, 'test@example.com')
    await user.tab()
    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid email/i)).not.toBeInTheDocument()
    })
  })

  it('should validate password requirements', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const passwordInput = screen.getByLabelText('Password:')

    // Test too short password
    await user.type(passwordInput, '123')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText(/must be at least 6 characters/i)).toBeInTheDocument()
    })

    // Test valid password
    await user.clear(passwordInput)
    await user.type(passwordInput, 'password123')
    await user.tab()
    await waitFor(() => {
      expect(screen.queryByText(/must be at least 6 characters/i)).not.toBeInTheDocument()
    })
  })

  it('should validate password confirmation', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const passwordInput = screen.getByLabelText('Password:')
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'different')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    // Test matching passwords
    await user.clear(confirmPasswordInput)
    await user.type(confirmPasswordInput, 'password123')
    await user.tab()

    await waitFor(() => {
      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument()
    })
  })

  it('should enable submit button when all fields are valid and terms are agreed', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password:')
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByLabelText(/terms of service/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(screenNameInput, 'testuser')
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'password123')
    await user.click(termsCheckbox)

    expect(submitButton).not.toBeDisabled()
  })

  it('should call register function on form submission', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password:')
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByLabelText(/terms of service/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(screenNameInput, 'testuser')
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'password123')
    await user.click(termsCheckbox)
    await user.click(submitButton)

    expect(mockRegister).toHaveBeenCalledWith('testuser', 'password123', 'test@example.com')
  })

  it('should call register function on Enter key press', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password:')
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const termsCheckbox = screen.getByLabelText(/terms of service/i)

    await user.type(screenNameInput, 'testuser')
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'password123')
    await user.click(termsCheckbox)
    await user.keyboard('{Enter}')

    expect(mockRegister).toHaveBeenCalledWith('testuser', 'password123', 'test@example.com')
  })

  it('should call onSwitchToLogin when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnSwitchToLogin).toHaveBeenCalled()
  })

  it('should call onSwitchToLogin when login link is clicked', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const loginLink = screen.getByText(/already have an account/i)
    await user.click(loginLink)

    expect(mockOnSwitchToLogin).toHaveBeenCalled()
  })

  it('should call onSwitchToLogin when X button is clicked', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const closeButton = document.querySelector('.aim-window-control:last-child')
    expect(closeButton).toBeInTheDocument()
    
    await user.click(closeButton!)
    expect(mockOnSwitchToLogin).toHaveBeenCalled()
  })

  it('should clear validation errors when inputs change', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)

    // Create validation error
    await user.type(screenNameInput, 'ab')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText(/must be at least 3 characters/i)).toBeInTheDocument()
    })

    // Error should clear when typing
    await user.type(screenNameInput, 'c')
    await waitFor(() => {
      expect(screen.queryByText(/must be at least 3 characters/i)).not.toBeInTheDocument()
    })
  })

  it('should enforce maxLength on screen name input', () => {
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i) as HTMLInputElement
    expect(screenNameInput.maxLength).toBe(50)
  })

  it('should have proper accessibility attributes', () => {
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password:')
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    expect(screenNameInput).toHaveAttribute('autoComplete', 'username')
    expect(emailInput).toHaveAttribute('autoComplete', 'email')
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password')
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')
  })

  it('should not submit without agreeing to terms', async () => {
    const user = userEvent.setup()
    render(<RegistrationWindow onSwitchToLogin={mockOnSwitchToLogin} />)

    const screenNameInput = screen.getByLabelText(/screen name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText('Password:')
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
    const submitButton = screen.getByRole('button', { name: /create account/i })

    await user.type(screenNameInput, 'testuser')
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'password123')
    // Don't check terms checkbox

    expect(submitButton).toBeDisabled()
  })
})