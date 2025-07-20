import { useState } from 'react';
import { LoginWindow } from './LoginWindow';
import { RegistrationWindow } from './RegistrationWindow';

type AuthMode = 'login' | 'register';

export function AuthContainer() {
  const [mode, setMode] = useState<AuthMode>('login');

  const switchToLogin = () => setMode('login');
  const switchToRegister = () => setMode('register');

  return (
    <>
      {mode === 'login' && (
        <LoginWindow onSwitchToRegister={switchToRegister} />
      )}
      {mode === 'register' && (
        <RegistrationWindow onSwitchToLogin={switchToLogin} />
      )}
    </>
  );
}