import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class OrderItem extends Model {
  static override table = 'order_items';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('order_id') orderId!: string;
  @text('variant_id') variantId!: string;
  @text('name_snapshot') nameSnapshot!: string;
  @field('qty') qty!: number;
  @field('unit_price_cents') unitPriceCents!: number;
  @field('subtotal_cents') subtotalCents!: number;
  @text('modifiers_json') modifiersJson!: string | null;
}
