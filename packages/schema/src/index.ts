// Auth + tenancy
export {
  organizations,
  users,
  region,
  tier,
  userRole,
  type Organization,
  type NewOrganization,
  type User,
  type NewUser,
  type Region,
  type Tier,
  type UserRole,
} from './auth';

// Catalog & inventory
export {
  categories,
  products,
  variants,
  modifiers,
  inventoryMovements,
  productStatus,
  inventoryReason,
  type Category,
  type NewCategory,
  type Product,
  type NewProduct,
  type Variant,
  type NewVariant,
  type Modifier,
  type NewModifier,
  type InventoryMovement,
  type NewInventoryMovement,
  type ProductStatus,
  type InventoryReason,
} from './catalog';

// Customers
export { customers, type Customer, type NewCustomer } from './customers';

// Loyalty (punchcard)
export {
  loyaltyPrograms,
  loyaltyPunches,
  loyaltyTargetType,
  loyaltyProgramStatus,
  type LoyaltyProgram,
  type NewLoyaltyProgram,
  type LoyaltyPunch,
  type NewLoyaltyPunch,
  type LoyaltyTargetType,
  type LoyaltyProgramStatus,
} from './loyalty';

// Devices + shifts
export {
  devices,
  shifts,
  deviceStatus,
  type Device,
  type NewDevice,
  type Shift,
  type NewShift,
  type DeviceStatus,
} from './devices';

// Sales (orders, order_items, refunds)
export {
  orders,
  orderItems,
  refunds,
  orderStatus,
  paymentMethod,
  type Order,
  type NewOrder,
  type OrderItem,
  type NewOrderItem,
  type Refund,
  type NewRefund,
  type OrderStatus,
  type PaymentMethod,
} from './sales';

// Sync engine plumbing
export {
  syncIdempotency,
  type SyncIdempotency,
  type NewSyncIdempotency,
} from './sync';

// Billing (Stripe)
export {
  billingSubscriptions,
  type BillingSubscription,
  type NewBillingSubscription,
} from './billing';

// DB factory
export { createDb, type Db, type CreateDbOptions } from './db';
