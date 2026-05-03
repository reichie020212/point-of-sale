import { Model } from '@nozbe/watermelondb';
import { date, text } from '@nozbe/watermelondb/decorators';

export class User extends Model {
  static override table = 'users';

  @text('server_id') serverId!: string;
  @text('active_org_id') activeOrgId!: string;
  @text('name') name!: string | null;
  @text('email') email!: string | null;
  @text('role') role!: string;
  @text('pin_hash') pinHash!: string | null;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt!: number | null;
}
