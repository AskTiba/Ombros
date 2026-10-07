import type { DeviceSignals } from './qualityTiers';

interface SignalableNavigator extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: DeviceSignals['effectiveType'];
    saveData?: boolean;
  };
}

/**
 * Reads the capability signals exposed by the browser, tolerating their
 * absence. Firefox and Safari expose neither `deviceMemory` nor `connection`,
 * and some Chromium builds report `deviceMemory: 0` for unknown — all of these
 * cases must degrade to "no evidence", letting the tier default honestly.
 */
export function readDeviceSignals(): DeviceSignals {
  const navigatorWithSignals = navigator as SignalableNavigator;
  const memory = navigatorWithSignals.deviceMemory;
  const connection = navigatorWithSignals.connection;

  const signals: DeviceSignals = {};
  if (typeof memory === 'number' && memory > 0) {
    signals.deviceMemoryGb = memory;
  }
  if (connection?.effectiveType) {
    signals.effectiveType = connection.effectiveType;
  }
  if (connection?.saveData !== undefined) {
    signals.saveData = connection.saveData;
  }
  return signals;
}
