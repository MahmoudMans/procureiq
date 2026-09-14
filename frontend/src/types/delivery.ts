import type {
  PurchaseOrderStatus,
} from "@/types/purchase-order";

export interface GoodsReceiptLine {
  id: string | null;
  purchaseOrderLineId: string;
  lineNumber: number;
  itemName: string;
  orderedQuantity: number;
  quantityReceived: number;
  unit: string;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  receivedDate: string;
  deliveryReference: string | null;
  notes: string | null;
  lateReceipt: boolean;
  recordedByUserId: string;
  recordedByName: string;
  lines: GoodsReceiptLine[];
  createdAt: string;
}

export interface GoodsReceiptLineInput {
  purchaseOrderLineId: string;
  quantityReceived: number;
}

export interface GoodsReceiptInput {
  receivedDate: string;
  deliveryReference?: string;
  notes?: string;
  lines: GoodsReceiptLineInput[];
}

export interface PurchaseOrderReceivingLine {
  purchaseOrderLineId: string;
  lineNumber: number;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unit: string;
  complete: boolean;
}

export interface PurchaseOrderReceiving {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  status: PurchaseOrderStatus;
  expectedDeliveryDate: string;
  overdue: boolean;
  lines: PurchaseOrderReceivingLine[];
}

export interface SupplierDeliveryPerformance {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  trackedOrders: number;
  completedOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  orderedQuantity: number;
  receivedQuantity: number;
  onTimeDeliveryRate: number;
  fulfillmentRate: number;
  lastReceiptDate: string | null;
  updatedAt: string | null;
}

export interface DeliverySummary {
  totalReceipts: number;
  openOrders: number;
  partiallyReceivedOrders: number;
  completedOrders: number;
  overdueOrders: number;
}
