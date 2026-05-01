/**
 * Category — server-mirrored catalog grouping.
 *
 * Properties are camelCase; the underlying SQLite columns stay
 * snake_case (matches server schema, keeps `_raw` queries from the
 * sync_queue working unchanged).
 */
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class Category extends Model {
  static override table = 'categories';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('name') name!: string;
  @field('sort_order') sortOrder!: number;
  @readonly @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
