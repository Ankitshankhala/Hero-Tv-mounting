
interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
}

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
    tvConfigurations?: TvConfiguration[];
    services?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
  };
}
