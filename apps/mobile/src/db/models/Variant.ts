import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class Variant extends Model {
  static override table = 'variants';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('product_id') productId!: string;
  @text('name') name!: string;
  @text('sku') sku!: string | null;
  @text('barcode') barcode!: string | null;
  @field('price_cents') priceCents!: number;
  @readonly @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
