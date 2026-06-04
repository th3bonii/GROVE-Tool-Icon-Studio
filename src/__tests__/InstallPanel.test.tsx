import { render, screen, fireEvent } from '@testing-library/react';
import InstallPanel from '../InstallPanel';

describe('InstallPanel', () => {
  const baseProps = {
    reaperPath: '/home/user/REAPER',
    onInstall: vi.fn(),
    installedIcons: ['existing-icon', 'another-icon'],
    disabled: false,
    iconName: '',
    installEnabled: false,
    onIconNameChange: vi.fn(),
    onInstallEnabledChange: vi.fn(),
  };

  it('renders the target path when reaperPath is provided', () => {
    render(<InstallPanel {...baseProps} />);

    expect(
      screen.getByText('/home/user/REAPER/Data/toolbar_icons/'),
    ).toBeInTheDocument();
  });

  it('shows a message when reaperPath is null', () => {
    render(
      <InstallPanel
        {...baseProps}
        reaperPath={null}
      />,
    );

    expect(
      screen.getByText(
        'REAPER path not detected. Install will not be available.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the installed icons list', () => {
    render(<InstallPanel {...baseProps} />);

    expect(screen.getByText('existing-icon')).toBeInTheDocument();
    expect(screen.getByText('another-icon')).toBeInTheDocument();
  });

  it('calls onInstall with the file name when Install button is clicked', () => {
    const onInstall = vi.fn();
    render(
      <InstallPanel
        {...baseProps}
        onInstall={onInstall}
        iconName="my-custom-icon"
        installEnabled={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /install/i }));

    expect(onInstall).toHaveBeenCalledWith('my-custom-icon');
  });

  it('calls onIconNameChange when typing in the input', () => {
    const onIconNameChange = vi.fn();
    render(
      <InstallPanel
        {...baseProps}
        onIconNameChange={onIconNameChange}
      />,
    );

    const input = screen.getByPlaceholderText('icon-name');
    fireEvent.change(input, { target: { value: 'test-icon' } });

    expect(onIconNameChange).toHaveBeenCalledWith('test-icon');
  });

  it('disables the Install button when disabled prop is true', () => {
    render(<InstallPanel {...baseProps} disabled={true} />);

    expect(screen.getByRole('button', { name: /install/i })).toBeDisabled();
  });

  it('disables the Install button when reaperPath is null', () => {
    render(
      <InstallPanel
        {...baseProps}
        reaperPath={null}
      />,
    );

    expect(screen.getByRole('button', { name: /install/i })).toBeDisabled();
  });

  it('disables the Install button when file name is empty', () => {
    render(<InstallPanel {...baseProps} iconName="" />);

    expect(screen.getByRole('button', { name: /install/i })).toBeDisabled();
  });

  it('renders the "Install to REAPER" toggle checkbox', () => {
    render(<InstallPanel {...baseProps} />);

    expect(
      screen.getByLabelText(/install to reaper/i),
    ).toBeInTheDocument();
  });

  it('renders the toggle checked when installEnabled is true', () => {
    render(<InstallPanel {...baseProps} installEnabled={true} />);

    expect(
      screen.getByLabelText(/install to reaper/i),
    ).toBeChecked();
  });

  it('renders the toggle unchecked when installEnabled is false', () => {
    render(<InstallPanel {...baseProps} installEnabled={false} />);

    expect(
      screen.getByLabelText(/install to reaper/i),
    ).not.toBeChecked();
  });

  it('calls onInstallEnabledChange when toggling the checkbox', () => {
    const onInstallEnabledChange = vi.fn();
    render(
      <InstallPanel
        {...baseProps}
        installEnabled={false}
        onInstallEnabledChange={onInstallEnabledChange}
      />,
    );

    fireEvent.click(screen.getByLabelText(/install to reaper/i));

    expect(onInstallEnabledChange).toHaveBeenCalledWith(true);
  });
});
