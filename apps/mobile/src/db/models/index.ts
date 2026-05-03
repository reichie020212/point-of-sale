/**
 * Watermelon model class registry.
 *
 * Order matters only for documentation: registration is by class
 * reference, not name. Tables that aren't covered here (e.g.
 * `sync_queue`) keep working via raw `database.get('table_name')`
 * collection access.
 */
export { Category } from './Category';
export { Customer } from './Customer';
export { InventoryMovement } from './InventoryMovement';
export { Modifier } from './Modifier';
export { LoyaltyProgram } from './LoyaltyProgram';
export { LoyaltyPunch } from './LoyaltyPunch';
export { Order } from './Order';
export { OrderItem } from './OrderItem';
export { Product } from './Product';
export { Refund } from './Refund';
export { Shift } from './Shift';
export { User } from './User';
export { Variant } from './Variant';
