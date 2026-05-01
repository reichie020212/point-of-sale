import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class Modifier extends Model {
  static override table = 'modifiers';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('product_id') productId!: string;
  @text('name') name!: string;
  @field('price_cents') priceCents!: number;
  @field('multi_select') multiSelect!: number;
  @readonly @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
