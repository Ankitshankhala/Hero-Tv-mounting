
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: {
    over65?: boolean;
    frameMount?: boolean;
    numberOfTvs?: number;
    wallType?: string;
    services?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
  };
}
