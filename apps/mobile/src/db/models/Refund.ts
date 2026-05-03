import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class Refund extends Model {
  static override table = 'refunds';

  @text('server_id') serverId!: string;
  @text('client_op_id') clientOpId!: string;
  @text('org_id') orgId!: string;
  @text('order_id') orderId!: string;
  @field('amount_cents') amountCents!: number;
  @field('subtotal_cents') subtotalCents!: number;
  @field('tax_cents') taxCents!: number;
  @field('tip_cents') tipCents!: number;
  @field('discount_cents') discountCents!: number;
  @text('reason') reason!: string | null;
  @text('processed_by_id') processedById!: string | null;
  @text('payment_reference') paymentReference!: string | null;
  @readonly @date('created_at') createdAtMs!: number;
}
