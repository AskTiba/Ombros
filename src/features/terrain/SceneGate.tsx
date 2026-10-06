import { Component, Suspense, useState, type ComponentType, type ReactNode } from 'react';

import { supportsWebGl2 } from './supportsWebGl2';

type SceneGateProps = {
  scene: ComponentType;
  fallback: ReactNode;
  loading?: ReactNode;
};

type SceneErrorBoundaryProps = {
  fallback: ReactNode;
  children: ReactNode;
};

type SceneErrorBoundaryState = {
  failed: boolean;
};

class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  override state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function SceneGate({ scene: Scene, fallback, loading = null }: SceneGateProps) {
  const [webGl2] = useState(() => supportsWebGl2());

  if (!webGl2) {
    return <>{fallback}</>;
  }

  return (
    <SceneErrorBoundary fallback={fallback}>
      <Suspense fallback={loading}>
        <Scene />
      </Suspense>
    </SceneErrorBoundary>
  );
}
