/**
 * BLE thermal printer — interface scaffold.
 *
 * Real implementation requires:
 *   - react-native-ble-plx
 *   - A paired Star TSP143 / Epson TM-series device
 *   - ESC/POS encoder for the receipt payload
 *
 * All three land in W5 field work. The scaffold here lets mobile code
 * call `new BLEThermalPrinter(deviceId)` today.
 */
import type { ReceiptItem, ReceiptOrder, ReceiptPrinter } from './types';

export interface BLEThermalPrinterOptions {
  /** Paired peripheral id from BleManager.connectedDevices(). */
  deviceId: string;
}

export class BLEThermalPrinter implements ReceiptPrinter {
  readonly type = 'ble' as const;
  readonly label = 'Thermal (BLE)';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts: BLEThermalPrinterOptions) {
    // TODO(W5): pair with the device, request the print characteristic,
    // negotiate ESC/POS encoding.
  }

  async print(_order: ReceiptOrder, _items: ReceiptItem[]): Promise<void> {
    throw new Error('BLEThermalPrinter not implemented yet — needs hardware');
  }
}
