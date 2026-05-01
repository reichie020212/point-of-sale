import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class InventoryMovement extends Model {
  static override table = 'inventory_movements';

  @text('server_id') serverId!: string;
  @text('client_op_id') clientOpId!: string;
  @text('org_id') orgId!: string;
  @text('variant_id') variantId!: string;
  @field('delta') delta!: number;
  @text('reason') reason!: string;
  @text('device_id') deviceId!: string;
  @readonly @date('created_at') createdAtMs!: number;
}
