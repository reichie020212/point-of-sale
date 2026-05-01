import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export class Shift extends Model {
  static override table = 'shifts';

  @text('server_id') serverId!: string;
  @text('org_id') orgId!: string;
  @text('device_id') deviceId!: string;
  @text('user_id') userId!: string;
  @date('opened_at') openedAt!: number;
  @date('closed_at') closedAt!: number | null;
  @field('opening_cash_cents') openingCashCents!: number;
  @field('closing_cash_cents') closingCashCents!: number | null;
  @field('variance_cents') varianceCents!: number | null;
}
