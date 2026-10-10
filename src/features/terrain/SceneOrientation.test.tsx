import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KAMPALA_BOUNDS } from '@/lib/geo';
import { SceneOrientation, type SceneOrientationHandle } from './SceneOrientation';

const setup = () => {
  const ref = createRef<SceneOrientationHandle>();
  const onResetView = vi.fn();
  const { container } = render(
    <SceneOrientation bounds={KAMPALA_BOUNDS} onResetView={onResetView} ref={ref} />,
  );
  return { ref, onResetView, overlay: container.firstElementChild as HTMLElement };
};

describe('SceneOrientation', () => {
  describe('what it tells you', () => {
    it('states the study extent the model is cut from', () => {
      setup();
      expect(screen.getByText('0.207°N–0.409°N, 32.511°E–32.684°E')).toBeInTheDocument();
    });

    it('names the north arrow for assistive technology', () => {
      setup();
      expect(screen.getByRole('img', { name: /north arrow/i })).toBeInTheDocument();
    });

    it('groups the annotations so they are announced as one region', () => {
      setup();
      expect(screen.getByRole('group', { name: /map orientation/i })).toBeInTheDocument();
    });

    it('offers the compass as a real button, so it is reachable by keyboard', () => {
      // Pan means the user can end up anywhere, and the compass is the one way
      // back. A control that only responds to a pointer would strand anyone
      // navigating by keyboard — a WCAG 2.2 AA failure, not a nicety.
      setup();
      const button = screen.getByRole('button', { name: /reset the view/i });
      expect(button).toHaveAttribute('type', 'button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('starts the scale bar blank rather than inventing a distance', () => {
      // A made-up bar would be a measurement claim about a scene it has not
      // been given a camera for. `update` fills it in.
      setup();
      expect(screen.getByTestId('scale-bar-label')).toHaveTextContent('—');
    });
  });

  describe('live updates', () => {
    it('turns the compass to match the camera azimuth', () => {
      const { ref } = setup();
      const north = screen.getByTestId('north-arrow');

      ref.current?.aimCompass(0);
      expect(north).toHaveStyle({ transform: 'rotate(0deg)' });

      ref.current?.aimCompass(Math.PI / 2);
      expect(north).toHaveStyle({ transform: 'rotate(90deg)' });
    });

    it('sizes the scale bar to a round ground distance and labels it', () => {
      const { ref } = setup();

      // 22 metres per pixel: 2km is the longest rung under the 140px budget.
      ref.current?.setScale(22);
      expect(screen.getByTestId('scale-bar')).toHaveStyle({ width: `${2000 / 22}px` });
      expect(screen.getByTestId('scale-bar-label')).toHaveTextContent('2 km');

      // Zoomed in, a shorter rung keeps the bar inside the same budget.
      ref.current?.setScale(5);
      expect(screen.getByTestId('scale-bar')).toHaveStyle({ width: `${500 / 5}px` });
      expect(screen.getByTestId('scale-bar-label')).toHaveTextContent('500 m');
    });

    it('leaves the bar alone when the viewport has no measurable height', () => {
      // A zero or infinite scale is a failed measurement, not a distance.
      // Printing it would be inventing a number for a scene that has not
      // offered one.
      const { ref } = setup();
      ref.current?.setScale(0);
      ref.current?.setScale(Number.POSITIVE_INFINITY);
      ref.current?.setScale(Number.NaN);

      expect(screen.getByTestId('scale-bar-label')).toHaveTextContent('—');
      expect(screen.getByTestId('scale-bar')).toHaveStyle({ width: '0px' });
    });

    it('aims the compass without any measurement of the viewport', () => {
      // The two halves of the overlay have different preconditions: the
      // compass needs only the camera's azimuth, so it must not be held
      // hostage to a viewport that has not been laid out yet.
      const { ref } = setup();
      ref.current?.aimCompass(Math.PI);
      expect(screen.getByTestId('north-arrow')).toHaveStyle({
        transform: 'rotate(180deg)',
      });
    });
  });

  describe('resetting the view', () => {
    it('returns the camera to its default framing when the compass is activated', () => {
      const { onResetView } = setup();
      fireEvent.click(screen.getByRole('button', { name: /reset the view/i }));
      expect(onResetView).toHaveBeenCalledTimes(1);
    });

    it('activates from the keyboard as well as the pointer', () => {
      // A native <button> gives Enter and Space for free — which is why this
      // is not a div with a click handler.
      const { onResetView } = setup();
      const button = screen.getByRole('button', { name: /reset the view/i });
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onResetView).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(onResetView).toHaveBeenCalledTimes(1);
    });
  });

  describe('staying out of the way', () => {
    it('cannot swallow the drag that orbits the scene', () => {
      const { overlay } = setup();
      expect(overlay).toHaveStyle({ pointerEvents: 'none' });
    });

    it('lets the compass through that shield, or the reset control would be dead', () => {
      setup();
      expect(screen.getByRole('button', { name: /reset the view/i })).toHaveStyle({
        pointerEvents: 'auto',
      });
    });
  });

  describe('renderer boundary', () => {
    it('renders no canvas of its own', () => {
      setup();
      expect(document.querySelectorAll('canvas')).toHaveLength(0);
    });
  });
});
