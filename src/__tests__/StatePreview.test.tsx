import { render, screen } from '@testing-library/react';
import StatePreview from '../StatePreview';

describe('StatePreview', () => {
  it('renders nothing when previewBase64 is null', () => {
    const { container } = render(
      <StatePreview previewBase64={null} stateSize={30} />,
    );
    // Should show empty/placeholder state — no image
    expect(container.querySelector('img')).not.toBeInTheDocument();
    // Should show a fallback message
    expect(screen.getByText(/no preview/i)).toBeInTheDocument();
  });

  it('renders the preview image when base64 is provided', () => {
    render(
      <StatePreview
        previewBase64="data:image/png;base64,iVBORw0KGgo="
        stateSize={30}
      />,
    );

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(img).toHaveAttribute('alt', '3-state icon preview');
  });

  it('shows state labels: Normal, Hover, Click', () => {
    render(
      <StatePreview
        previewBase64="data:image/png;base64,iVBORw0KGgo="
        stateSize={30}
      />,
    );

    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Hover')).toBeInTheDocument();
    expect(screen.getByText('Click')).toBeInTheDocument();
  });

  it('shows correct dimensions text for stateSize 30', () => {
    render(
      <StatePreview
        previewBase64="data:image/png;base64,iVBORw0KGgo="
        stateSize={30}
      />,
    );

    expect(
      screen.getByText(
        '30×30 each · 90×30 total',
      ),
    ).toBeInTheDocument();
  });

  it('shows correct dimensions text for stateSize 38', () => {
    render(
      <StatePreview
        previewBase64="data:image/png;base64,iVBORw0KGgo="
        stateSize={38}
      />,
    );

    expect(
      screen.getByText(
        '38×38 each · 114×38 total',
      ),
    ).toBeInTheDocument();
  });
});
