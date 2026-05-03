import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class Order extends Model {
  static override table = 'orders';

  @text('server_id') serverId!: string;
  @text('client_op_id') clientOpId!: string;
  @text('org_id') orgId!: string;
  @text('customer_id') customerId!: string | null;
  @text('shift_id') shiftId!: string | null;
  @text('device_id') deviceId!: string;
  @text('cashier_id') cashierId!: string | null;
  @text('status') status!: string;
  @text('payment_method') paymentMethod!: string;
  @field('subtotal_cents') subtotalCents!: number;
  @field('tax_cents') taxCents!: number;
  @field('tip_cents') tipCents!: number;
  @field('discount_cents') discountCents!: number;
  @field('total_cents') totalCents!: number;
  @readonly @date('created_at') createdAtMs!: number;
  @date('synced_at') syncedAt!: number | null;
}
