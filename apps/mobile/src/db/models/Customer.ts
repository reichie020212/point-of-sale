import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class Customer extends Model {
  static override table = 'customers';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('name') name!: string | null;
  @text('email') email!: string | null;
  @text('phone') phone!: string | null;
  @field('loyalty_points') loyaltyPoints!: number;
  @readonly @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
