import { render, screen, fireEvent } from '@testing-library/react';
import InstallPanel from '../InstallPanel';

describe('InstallPanel', () => {
  const baseProps = {
    reaperPath: '/home/user/REAPER',
    installedIcons: ['existing-icon', 'another-icon'],
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
      screen.getByText('REAPER path not detected.'),
    ).toBeInTheDocument();
  });

  it('renders the installed icons list', () => {
    render(<InstallPanel {...baseProps} />);

    expect(screen.getByText('existing-icon')).toBeInTheDocument();
    expect(screen.getByText('another-icon')).toBeInTheDocument();
  });

  it('allows selecting and deselecting icons', () => {
    render(<InstallPanel {...baseProps} />);

    // Click "Select all"
    fireEvent.click(screen.getByText('Select all'));
    expect(screen.getByText('Deselect all')).toBeInTheDocument();
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

    // Click "Deselect all"
    fireEvent.click(screen.getByText('Deselect all'));
    expect(screen.getByText('Select all')).toBeInTheDocument();
  });

  it('renders thumbnail placeholders for icons', () => {
    const { container } = render(<InstallPanel {...baseProps} />);

    const placeholders = container.querySelectorAll('.install-installed-thumb--placeholder');
    expect(placeholders.length).toBe(2);
  });
});
