
interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
  soundbar: boolean;
  wireHiding?: boolean;
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
    soundbar?: boolean;
    wireHiding?: boolean;
    tvConfigurations?: TvConfiguration[];
    services?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
  };
}
