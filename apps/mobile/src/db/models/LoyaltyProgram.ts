import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export class LoyaltyProgram extends Model {
  static override table = 'loyalty_programs';

  @text('server_id') serverId!: string;
  @text('client_op_id') clientOpId!: string;
  @text('org_id') orgId!: string;
  @text('name') name!: string;
  @text('target_type') targetType!: string;
  @text('target_id') targetId!: string;
  @field('threshold') threshold!: number;
  @text('status') status!: string;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
