export type KostImage = {
  id: number;
  kost_id: number;
  image_url: string;
  sort_order: number;
  created_at: string;
};

export type KostFacility = {
  id: number;
  name: string;
};

export type KostDetail = {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  price: number;
  address: string;
  city: string;
  province: string;
  available_rooms: number;
  status: string;
  images: KostImage[];
  facilities: KostFacility[];
  owner: {
    name: string;
    phone: string | null;
  };
};