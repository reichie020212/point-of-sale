import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export class LoyaltyPunch extends Model {
  static override table = 'loyalty_punches';

  @text('server_id') serverId!: string;
  @text('client_op_id') clientOpId!: string;
  @text('org_id') orgId!: string;
  @text('customer_id') customerId!: string;
  @text('program_id') programId!: string;
  @text('order_item_id') orderItemId!: string | null;
  @field('is_redemption') isRedemption!: boolean;
  @readonly @date('created_at') createdAtMs!: number;
  @date('deleted_at') deletedAt!: number | null;
}
