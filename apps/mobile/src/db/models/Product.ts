import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export class Product extends Model {
  static override table = 'products';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('category_id') categoryId!: string | null;
  @text('name') name!: string;
  @text('description') description!: string | null;
  @text('image_path') imagePath!: string | null;
  @text('status') status!: string;
  @readonly @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
