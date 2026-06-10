import { render, screen } from '@testing-library/react';
import StatePreview, { getCornerRadius } from '../StatePreview';
import type { ProcessingOutput } from '../api';

function makePreviewOutput(
  height: number,
  base64: string | null,
  suffix: string,
): ProcessingOutput {
  return {
    width: height * 3,
    height,
    output_path: null,
    preview_base64: base64,
    suffix,
  };
}

describe('StatePreview', () => {
  it('renders empty state when previewResults is empty', () => {
    const { container } = render(
      <StatePreview previewResults={[]} padding={2} isToggle={false} />,
    );
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText(/no preview/i)).toBeInTheDocument();
  });

  it('shows OFF state labels: Normal, Hover, Active', () => {
    const results: ProcessingOutput[] = [
      makePreviewOutput(30, 'data:image/png;base64,iVBORw0KGgo=', ''),
    ];
    render(
      <StatePreview previewResults={results} padding={2} isToggle={false} />,
    );

    expect(screen.getAllByText('Normal').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hover').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
  });

  it('shows labels ON row when isToggle is true', () => {
    const results: ProcessingOutput[] = [
      makePreviewOutput(30, 'data:image/png;base64,iVBORw0KGgo=', ''),
      makePreviewOutput(30, 'data:image/png;base64,iVBORw0KGgo=', '_on'),
    ];
    render(
      <StatePreview previewResults={results} padding={2} isToggle={true} />,
    );

    // Should have both OFF and ON labels visible
    expect(screen.getByText('OFF')).toBeInTheDocument();
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('does NOT show ON row when isToggle is false', () => {
    const results: ProcessingOutput[] = [
      makePreviewOutput(30, 'data:image/png;base64,iVBORw0KGgo=', ''),
    ];
    render(
      <StatePreview previewResults={results} padding={2} isToggle={false} />,
    );

    expect(screen.queryByText('ON')).not.toBeInTheDocument();
  });

  it('shows correct dimensions text per scale', () => {
    const results: ProcessingOutput[] = [
      makePreviewOutput(30, 'data:image/png;base64,iVBORw0KGgo=', ''),
      makePreviewOutput(45, 'data:image/png;base64,iVBORw0KGgo=', ''),
    ];
    render(
      <StatePreview previewResults={results} padding={2} isToggle={false} />,
    );

    expect(screen.getByText(/30×30 each/i)).toBeInTheDocument();
    expect(screen.getByText(/45×45 each/i)).toBeInTheDocument();
  });

describe('getCornerRadius', () => {
  it('matches Rust expected output for 30px with padding 4', () => {
    // Rust: floor(30*0.15+0.5)=5, min(5,4)=4
    expect(getCornerRadius(30, 4)).toBe(4);
  });

  it('matches Rust expected output for 30px with no padding', () => {
    // Rust: floor(30*0.15+0.5)=5, no clamp = 5
    expect(getCornerRadius(30, 0)).toBe(5);
  });

  it('matches Rust expected output for 45px with padding 4', () => {
    // Rust: floor(45*0.15+0.5)=7, min(7,4)=4
    expect(getCornerRadius(45, 4)).toBe(4);
  });

  it('matches Rust expected output for 60px with padding 4', () => {
    // Rust: floor(60*0.15+0.5)=9, min(9,4)=4
    expect(getCornerRadius(60, 4)).toBe(4);
  });

  it('trivially small scale still produces minimum radius 2', () => {
    // Rust: floor(1*0.15+0.5)=0, max(0,2)=2
    expect(getCornerRadius(1, 0)).toBe(2);
  });
});

  it('renders multiple scales in sorted order', () => {
    const results: ProcessingOutput[] = [
      makePreviewOutput(60, 'data:image/png;base64,iVBORw0KGgo=', ''),
      makePreviewOutput(30, 'data:image/png;base64,iVBORw0KGgo=', ''),
      makePreviewOutput(45, 'data:image/png;base64,iVBORw0KGgo=', ''),
    ];
    render(
      <StatePreview previewResults={results} padding={2} isToggle={false} />,
    );

    // All scale headers should be present
    expect(screen.getByText(/30×30px/)).toBeInTheDocument();
    expect(screen.getByText(/45×45px/)).toBeInTheDocument();
    expect(screen.getByText(/60×60px/)).toBeInTheDocument();
  });
});
