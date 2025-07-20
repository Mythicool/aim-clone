import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { PreferencesWindow } from '../PreferencesWindow';
import { UserPreferencesProvider } from '../../../contexts/UserPreferencesContext';

describe('PreferencesWindow', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the preferences window with sound tab active by default', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    // Check if the window title is rendered
    expect(screen.getByText('Preferences')).toBeInTheDocument();

    // Check if the sound tab is active by default
    expect(screen.getByText('Enable Sounds')).toBeInTheDocument();

    // Check if all tabs are present
    expect(screen.getByText('Sounds')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('should switch to notifications tab when clicked', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    // Click on notifications tab
    fireEvent.click(screen.getByText('Notifications'));
    
    // Check if notifications content is displayed
    expect(screen.getByText('Flash Window on New Messages')).toBeInTheDocument();
  });

  it('should toggle sound settings when checkboxes are clicked', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    // Get the "Enable Sounds" checkbox
    const enableSoundsCheckbox = screen.getByLabelText('Enable Sounds');
    
    // Initially it should be checked (default preference)
    expect(enableSoundsCheckbox).toBeChecked();
    
    // Toggle it off
    fireEvent.click(enableSoundsCheckbox);
    
    // Now it should be unchecked
    expect(enableSoundsCheckbox).not.toBeChecked();
  });

  it('should close the window when OK button is clicked', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    // Click the OK button
    fireEvent.click(screen.getByText('OK'));
    
    // Check if onClose was called
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should close the window when X button is clicked', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    // Click the X button
    fireEvent.click(screen.getByText('X'));

    // Check if onClose was called
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should switch to appearance tab when clicked', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    const appearanceTab = screen.getByText('Appearance');
    fireEvent.click(appearanceTab);

    // Check if appearance tab content is visible
    expect(screen.getByText('Font Settings')).toBeInTheDocument();
    expect(screen.getByText('Color Settings')).toBeInTheDocument();
    expect(screen.getByText('Layout Settings')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('should display font family selector in appearance tab', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    const appearanceTab = screen.getByText('Appearance');
    fireEvent.click(appearanceTab);

    // Check if font family selector is present by looking for the option
    expect(screen.getByText('MS Sans Serif')).toBeInTheDocument();
    expect(screen.getByText('Arial')).toBeInTheDocument();
  });

  it('should display color pickers in appearance tab', () => {
    render(
      <UserPreferencesProvider>
        <PreferencesWindow onClose={onCloseMock} />
      </UserPreferencesProvider>
    );

    const appearanceTab = screen.getByText('Appearance');
    fireEvent.click(appearanceTab);

    // Check if color inputs are present
    const colorInputs = screen.getAllByDisplayValue('#000000');
    expect(colorInputs.length).toBeGreaterThan(0);
  });
});