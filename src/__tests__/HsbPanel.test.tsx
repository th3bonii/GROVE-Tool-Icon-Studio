import { render, screen, fireEvent } from '@testing-library/react';
import HsbPanel from '../HsbPanel';
import type { HsbAdjustment } from '../api';

describe('HsbPanel', () => {
  const defaultAdj: HsbAdjustment = { hue_shift: 0, sat_delta: 0, bri_delta: 0 };

  it('renders the label', () => {
    render(
      <HsbPanel label="OFF Normal" adjustment={defaultAdj} onChange={() => {}} />,
    );
    expect(screen.getByText('OFF Normal')).toBeInTheDocument();
  });

  it('renders three sliders for Hue, Saturation, Brightness', () => {
    render(
      <HsbPanel label="Test" adjustment={defaultAdj} onChange={() => {}} />,
    );
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('displays current values next to each slider', () => {
    const adj: HsbAdjustment = { hue_shift: 45, sat_delta: 20, bri_delta: -10 };
    render(
      <HsbPanel label="Values" adjustment={adj} onChange={() => {}} />,
    );
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('-10')).toBeInTheDocument();
  });

  it('calls onChange when hue slider changes', () => {
    const handleChange = vi.fn();
    render(
      <HsbPanel label="H" adjustment={defaultAdj} onChange={handleChange} />,
    );
    // Hue slider is the first range input
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '30' } });
    expect(handleChange).toHaveBeenCalledWith({
      hue_shift: 30,
      sat_delta: 0,
      bri_delta: 0,
    });
  });

  it('calls onChange when saturation slider changes', () => {
    const handleChange = vi.fn();
    render(
      <HsbPanel label="S" adjustment={defaultAdj} onChange={handleChange} />,
    );
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[1], { target: { value: '-50' } });
    expect(handleChange).toHaveBeenCalledWith({
      hue_shift: 0,
      sat_delta: -50,
      bri_delta: 0,
    });
  });

  it('calls onChange when brightness slider changes', () => {
    const handleChange = vi.fn();
    render(
      <HsbPanel label="B" adjustment={defaultAdj} onChange={handleChange} />,
    );
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[2], { target: { value: '75' } });
    expect(handleChange).toHaveBeenCalledWith({
      hue_shift: 0,
      sat_delta: 0,
      bri_delta: 75,
    });
  });

  it('applies CSS classes for styling', () => {
    const { container } = render(
      <HsbPanel label="CSS" adjustment={defaultAdj} onChange={() => {}} />,
    );
    expect(container.querySelector('.hsb-panel')).toBeInTheDocument();
    expect(container.querySelector('.hsb-panel-label')).toBeInTheDocument();
    expect(container.querySelectorAll('.hsb-slider-row').length).toBe(3);
  });
});
